import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import {
  isValidDate,
  parseDate,
  isValidTime,
  TierType,
} from "@/lib/bookingUtils";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface UserOfferWithDetails {
  id: string;
  user_id: string;
  offer_id: string;
  claimed_at: string;
  used_at?: string;
  expires_at: string;
  special_offer: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
    minimum_party_size?: number;
    terms_conditions?: string[];
  };
}

interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

interface BookingCreateParams {
  restaurantId: string;
  restaurantName?: string;
  date?: string;
  time?: string;
  partySize?: string;
  earnablePoints?: string;
  offerId?: string;
  preselectedOfferId?: string;
}

export function useBookingCreate() {
  const params = useLocalSearchParams<BookingCreateParams>();
  const { profile } = useAuth();
  const router = useRouter();

  // Core state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(
    null
  );
  const [availableOffers, setAvailableOffers] = useState<
    UserOfferWithDetails[]
  >([]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  // Parse and validate parameters
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
  const rawEarnablePoints = params.earnablePoints;
  const preselectedOfferId = params.offerId || params.preselectedOfferId;

  // User data
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";

  // Parsed booking details
  const bookingDate = parseDate(rawDate);
  const bookingTime = isValidTime(rawTime) ? rawTime! : "19:00";
  const partySize = rawPartySize
    ? Math.max(1, parseInt(rawPartySize, 10)) || 2
    : 2;
  const earnablePoints = rawEarnablePoints
    ? Math.max(0, parseInt(rawEarnablePoints, 10)) || 0
    : 0;
  const totalPartySize = partySize + invitedFriends.length;

  // Parameter validation
  useEffect(() => {
    if (!restaurantId) {
      Alert.alert("Error", "Restaurant ID is required");
      router.back();
      return;
    }

    if (rawDate && !isValidDate(rawDate)) {
      Alert.alert("Error", "Invalid booking date provided");
      router.back();
      return;
    }

    if (rawTime && !isValidTime(rawTime)) {
      Alert.alert("Error", "Invalid booking time provided");
      router.back();
      return;
    }
  }, [restaurantId, rawDate, rawTime, router]);

  // Data fetching
  const fetchData = useCallback(async () => {
    try {
      // Fetch restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Fetch user's available offers
      if (profile?.id) {
        try {
          const { data: userOffersData, error: offersError } = await supabase
            .from("user_offers")
            .select(
              `
              id,
              user_id,
              offer_id,
              claimed_at,
              used_at,
              expires_at,
              special_offer:special_offers (
                id,
                title,
                description,
                discount_percentage,
                valid_until,
                restaurant_id,
                minimum_party_size,
                terms_conditions
              )
            `
            )
            .eq("user_id", profile.id)
            .is("used_at", null)
            .gte("expires_at", new Date().toISOString());

          if (!offersError && userOffersData) {
            const restaurantOffers = userOffersData
              .filter(
                (offer) => offer.special_offer?.restaurant_id === restaurantId
              )
              .filter((offer) => offer.special_offer !== null)
              .map((offer) => ({
                ...offer,
                special_offer: offer.special_offer!,
              })) as UserOfferWithDetails[];

            setAvailableOffers(restaurantOffers);

            // Auto-select preselected offer
            if (preselectedOfferId) {
              const matchingUserOffer = restaurantOffers.find(
                (offer) => offer.special_offer.id === preselectedOfferId
              );
              if (matchingUserOffer) {
                setSelectedOfferUserId(matchingUserOffer.id);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching offers:", error);
          setAvailableOffers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load booking details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [restaurantId, preselectedOfferId, profile]);

  // Booking submission
  const submitBooking = useCallback(
    async (formData: BookingFormData) => {
      if (!restaurant || !profile?.id) return;

      setSubmitting(true);

      try {
        // Validate booking time
        if (
          !isValidDate(bookingDate.toISOString()) ||
          !isValidTime(bookingTime)
        ) {
          throw new Error("Invalid booking date or time");
        }

        const bookingDateTime = new Date(bookingDate);
        const [hours, minutes] = bookingTime.split(":").map(Number);

        if (
          isNaN(hours) ||
          isNaN(minutes) ||
          hours < 0 ||
          hours > 23 ||
          minutes < 0 ||
          minutes > 59
        ) {
          throw new Error("Invalid booking time format");
        }

        bookingDateTime.setHours(hours, minutes, 0, 0);

        if (bookingDateTime <= new Date()) {
          throw new Error("Booking time must be in the future");
        }

        // Get selected offer
        const selectedOffer = selectedOfferUserId
          ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
          : null;

        // Create booking
        const bookingData = {
          user_id: profile.id,
          restaurant_id: restaurant.id,
          booking_time: bookingDateTime.toISOString(),
          party_size: totalPartySize,
          status:
            restaurant.booking_policy === "instant" ? "confirmed" : "pending",
          special_requests: formData.specialRequests,
          occasion: formData.occasion !== "none" ? formData.occasion : null,
          dietary_notes: formData.dietaryRestrictions,
          table_preferences: formData.tablePreferences,
          confirmation_code: `BK${Date.now().toString().slice(-8).toUpperCase()}`,
          is_group_booking: invitedFriends.length > 0,
          organizer_id: invitedFriends.length > 0 ? profile.id : null,
          attendees: totalPartySize,
          applied_offer_id: selectedOffer?.special_offer.id || null,
        };

        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert(bookingData)
          .select()
          .single();

        if (bookingError) throw bookingError;

        // Handle friend invitations
        if (invitedFriends.length > 0) {
          try {
            const invites = invitedFriends.map((friendId) => ({
              booking_id: booking.id,
              from_user_id: profile.id,
              to_user_id: friendId,
              message: `Join me at ${restaurant.name} on ${bookingDateTime.toLocaleDateString()} at ${bookingTime}!`,
            }));

            await supabase.from("booking_invites").insert(invites);
            await supabase.from("booking_attendees").insert({
              booking_id: booking.id,
              user_id: profile.id,
              status: "confirmed",
              is_organizer: true,
            });
          } catch (friendError) {
            console.error("Failed to handle friend invitations:", friendError);
          }
        }

        // Mark offer as used
        if (selectedOfferUserId && selectedOffer) {
          try {
            await supabase
              .from("user_offers")
              .update({ used_at: new Date().toISOString() })
              .eq("id", selectedOfferUserId)
              .eq("user_id", profile.id);
          } catch (offerError) {
            console.error("Failed to mark offer as used:", offerError);
          }
        }

        // Award loyalty points
        if (earnablePoints > 0) {
          try {
            await supabase.rpc("award_loyalty_points", {
              p_user_id: profile.id,
              p_points: earnablePoints,
            });
          } catch (pointsError) {
            console.error("Failed to award loyalty points:", pointsError);
          }
        }

        // Success haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        // Navigate to success
        const successParams = {
          bookingId: booking.id,
          restaurantName: restaurant.name,
          confirmationCode: booking.confirmation_code,
          earnedPoints: earnablePoints.toString(),
          appliedOffer: selectedOffer ? "true" : "false",
          invitedFriends: invitedFriends.length.toString(),
          isGroupBooking: invitedFriends.length > 0 ? "true" : "false",
          userTier,
          ...(selectedOffer && {
            offerTitle: selectedOffer.special_offer.title,
            offerDiscount:
              selectedOffer.special_offer.discount_percentage.toString(),
          }),
        };

        router.replace({
          pathname: "/booking/success",
          params: successParams,
        });
      } catch (error: any) {
        console.error("Error creating booking:", error);
        Alert.alert(
          "Booking Failed",
          error.message || "Failed to create booking. Please try again."
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      restaurant,
      profile,
      bookingDate,
      bookingTime,
      totalPartySize,
      router,
      selectedOfferUserId,
      availableOffers,
      earnablePoints,
      userTier,
      invitedFriends,
    ]
  );

  // Friend invitation handlers
  const handleInvitesSent = useCallback((friendIds: string[]) => {
    setInvitedFriends(friendIds);
  }, []);

  // Initialize data fetching
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get selected offer details
  const selectedOffer = selectedOfferUserId
    ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
    : null;

  return {
    // State
    restaurant,
    loading,
    submitting,
    availableOffers,
    invitedFriends,
    selectedOffer,
    selectedOfferUserId,

    // User data
    userPoints,
    userTier,
    profile,

    // Booking details
    bookingDate,
    bookingTime,
    partySize,
    totalPartySize,
    earnablePoints,

    // Actions
    submitBooking,
    setSelectedOfferUserId,
    handleInvitesSent,
  };
}
