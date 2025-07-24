// hooks/useBookingCreate.ts
import { useState, useCallback, useEffect, useMemo } from "react";
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
import { calculateBookingWindow } from "@/lib/tableManagementUtils";

// Type Definitions
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

/**
 * A comprehensive hook to manage the creation of both instant and request-based bookings.
 * It handles data fetching, state management, submission logic, error handling, and navigation.
 */
export function useBookingCreate() {
  const params = useLocalSearchParams<any>();
  const { profile } = useAuth();
  const router = useRouter();

  // Core State
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(
    null,
  );
  const [availableOffers, setAvailableOffers] = useState<
    UserOfferWithDetails[]
  >([]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [turnTime, setTurnTime] = useState<number>(120);
  const [lastFormData, setLastFormData] = useState<BookingFormData | null>(
    null,
  );

  // Booking Type State
  const [isRequestBooking, setIsRequestBooking] = useState<boolean>(false);

  // Parse and Memoize Route Parameters
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
  const rawEarnablePoints = params.earnablePoints;
  const preselectedOfferId = params.offerId || params.preselectedOfferId;

  const selectedTableIds = useMemo(() => {
    if (!params.tableIds) return [];
    try {
      const parsed = JSON.parse(params.tableIds);
      return Array.isArray(parsed)
        ? parsed.filter(
            (id) => typeof id === "string" || typeof id === "number",
          )
        : [];
    } catch (e) {
      console.error("Error parsing table IDs:", e);
      return [];
    }
  }, [params.tableIds]);

  const requiresCombination = params.requiresCombination === "true";

  // Memoized User & Booking Details
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";

  const bookingDate = useMemo(() => parseDate(rawDate), [rawDate]);
  const bookingTime = useMemo(
    () => (isValidTime(rawTime) ? rawTime! : "19:00"),
    [rawTime],
  );
  const basePartySize = useMemo(
    () => (rawPartySize ? Math.max(1, parseInt(rawPartySize, 10)) || 2 : 2),
    [rawPartySize],
  );
  const totalPartySize = useMemo(
    () => basePartySize + invitedFriends.length,
    [basePartySize, invitedFriends],
  );
  const earnablePoints = useMemo(
    () =>
      rawEarnablePoints ? Math.max(0, parseInt(rawEarnablePoints, 10)) || 0 : 0,
    [rawEarnablePoints],
  );

  const selectedOffer = useMemo(
    () =>
      selectedOfferUserId
        ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
        : null,
    [selectedOfferUserId, availableOffers],
  );

  // Initial Parameter Validation
  useEffect(() => {
    if (!restaurantId) {
      Alert.alert("Error", "Restaurant ID is required");
      router.back();
      return;
    }
    if (
      (rawDate && !isValidDate(rawDate)) ||
      (rawTime && !isValidTime(rawTime))
    ) {
      Alert.alert("Error", "Invalid date or time provided");
      router.back();
      return;
    }
    if (requiresCombination && selectedTableIds.length < 2) {
      Alert.alert("Error", "Table combination requires at least 2 tables");
      router.back();
      return;
    }
  }, [
    restaurantId,
    rawDate,
    rawTime,
    requiresCombination,
    selectedTableIds.length,
    router,
  ]);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    if (!restaurantId || !profile?.id) return;
    try {
      setLoading(true);
      // Fetch restaurant details, including its booking policy
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*, booking_policy")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);
      setIsRequestBooking(restaurantData.booking_policy === "request");

      // Calculate turn time based on base party size
      const bookingWindow = await calculateBookingWindow(
        restaurantId,
        bookingDate,
        bookingTime,
        basePartySize,
      );
      setTurnTime(bookingWindow.turnTimeMinutes);

      // Fetch user's available offers for this restaurant
      const { data: offersData, error: offersError } = await supabase
        .from("user_offers")
        .select("*, special_offer:special_offers(*)")
        .eq("user_id", profile.id)
        .eq("special_offer.restaurant_id", restaurantId)
        .is("used_at", null)
        .gte("expires_at", new Date().toISOString());

      if (offersError) throw offersError;

      const validOffers = (offersData as any[]).filter(
        (o) => o.special_offer,
      ) as UserOfferWithDetails[];
      setAvailableOffers(validOffers);

      if (preselectedOfferId) {
        const matchingOffer = validOffers.find(
          (o) => o.special_offer.id === preselectedOfferId,
        );
        if (matchingOffer) {
          setSelectedOfferUserId(matchingOffer.id);
        }
      }
    } catch (error) {
      console.error("Error fetching booking data:", error);
      Alert.alert("Error", "Failed to load booking details.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    restaurantId,
    profile?.id,
    bookingDate,
    bookingTime,
    basePartySize,
    preselectedOfferId,
  ]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Submission Logic ---

  /**
   * Centralized error handler for all submission types.
   */
  const handleBookingError = useCallback(
    (error: any) => {
      console.error("Booking submission error:", error);
      const errorCode = error?.code;
      const errorMessage = error?.message || "";

      // Handle specific database errors for instant bookings
      if (errorCode === "P0001") {
        if (errorMessage.includes("no longer available")) {
          Alert.alert(
            "Tables Unavailable",
            "Sorry, this time was just booked. Please select a different time.",
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else if (
          errorMessage.includes("not all selected tables can be combined")
        ) {
          Alert.alert(
            "Invalid Selection",
            "The selected tables cannot be combined. Please try another time slot.",
            [{ text: "OK" }],
          );
        } else if (errorMessage.includes("do not have enough capacity")) {
          Alert.alert(
            "Insufficient Capacity",
            "The tables don't have enough seats for your party. Please select another time.",
            [{ text: "OK" }],
          );
        } else {
          Alert.alert("Booking Error", errorMessage);
        }
      } else if (errorCode === "23505") {
        Alert.alert(
          "Booking Conflict",
          "A conflicting booking already exists. Please refresh and try again.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      } else if (error.name === "AbortError") {
        Alert.alert(
          "Request Timeout",
          "The request took too long. Please check your connection and try again.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert(
          "Booking Failed",
          "An unexpected error occurred. Please try again.",
          [{ text: "OK" }],
        );
      }
    },
    [router],
  );

  /**
   * The core logic that executes the booking or request after user confirmation.
   */
  const executeSubmit = useCallback(
    async (formData: BookingFormData) => {
      if (!profile || !restaurant) return;

      setSubmitting(true);
      setLastFormData(formData);

      const bookingDateTime = new Date(bookingDate);
      const [hours, minutes] = bookingTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      try {
        // --- INSTANT BOOKING LOGIC ---
        if (!isRequestBooking) {
          const { data: bookingResult, error: bookingError } =
            await supabase.rpc("create_booking_with_tables", {
              p_user_id: profile.id,
              p_restaurant_id: restaurant.id,
              p_booking_time: bookingDateTime.toISOString(),
              p_party_size: totalPartySize,
              p_table_ids: selectedTableIds,
              p_turn_time: turnTime,
              p_special_requests: formData.specialRequests || null,
              p_occasion:
                formData.occasion !== "none" ? formData.occasion : null,
              p_dietary_notes:
                formData.dietaryRestrictions.length > 0
                  ? formData.dietaryRestrictions
                  : null,
              p_table_preferences:
                formData.tablePreferences.length > 0
                  ? formData.tablePreferences
                  : null,
              p_is_group_booking: invitedFriends.length > 0,
              p_applied_offer_id: selectedOffer?.special_offer.id || null,
            });
          if (bookingError) throw bookingError;
          if (!bookingResult?.booking)
            throw new Error("No booking data returned from RPC.");

          const booking = bookingResult.booking;

          // Post-booking side-effects (non-blocking)
          const postBookingPromises = [];
          if (invitedFriends.length > 0) {
            postBookingPromises.push(
              supabase
                .from("booking_invites")
                .insert(
                  invitedFriends.map((friendId) => ({
                    booking_id: booking.id,
                    from_user_id: profile.id,
                    to_user_id: friendId,
                    message: `Join me at ${restaurant.name}!`,
                  })),
                )
                .catch((err) => console.error("Failed to send invites:", err)),
            );
          }
          if (selectedOffer) {
            postBookingPromises.push(
              supabase
                .from("user_offers")
                .update({
                  used_at: new Date().toISOString(),
                  booking_id: booking.id,
                })
                .eq("id", selectedOffer.id)
                .catch((err) =>
                  console.error("Failed to mark offer as used:", err),
                ),
            );
          }
          if (earnablePoints > 0) {
            postBookingPromises.push(
              supabase
                .rpc("award_loyalty_points", {
                  p_user_id: profile.id,
                  p_points: earnablePoints,
                })
                .catch((err) => console.error("Failed to award points:", err)),
            );
          }
          await Promise.allSettled(postBookingPromises);

          // Navigate to instant success screen
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          router.replace({
            pathname: "/booking/success",
            params: {
              bookingId: booking.id,
              confirmationCode: booking.confirmation_code,
              restaurantName: restaurant.name,
              earnedPoints: earnablePoints.toString(),
              appliedOffer: selectedOffer ? "true" : "false",
              offerTitle: selectedOffer?.special_offer.title,
              invitedFriends: invitedFriends.length.toString(),
            },
          });

          // --- REQUEST BOOKING LOGIC ---
        } else {
          const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .insert({
              user_id: profile.id,
              restaurant_id: restaurant.id,
              booking_time: bookingDateTime.toISOString(),
              party_size: totalPartySize,
              status: "pending", // Key difference: status is 'pending'
              special_requests: formData.specialRequests || null,
              occasion: formData.occasion !== "none" ? formData.occasion : null,
              dietary_notes: formData.dietaryRestrictions,
              applied_offer_id: selectedOffer?.special_offer.id || null,
              is_group_booking: invitedFriends.length > 0,
              turn_time_minutes: turnTime,
            })
            .select("id, confirmation_code")
            .single();

          if (bookingError) throw bookingError;

          // Navigate to request success screen
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          router.replace({
            pathname: "/booking/request-sent",
            params: {
              bookingId: booking.id,
              restaurantName: restaurant.name,
              bookingTime: bookingTime,
              bookingDate: bookingDate.toISOString(),
              partySize: totalPartySize.toString(),
            },
          });
        }
      } catch (error: any) {
        handleBookingError(error);
      } finally {
        setSubmitting(false);
      }
    },
    [
      profile,
      restaurant,
      bookingDate,
      bookingTime,
      totalPartySize,
      isRequestBooking,
      selectedTableIds,
      turnTime,
      invitedFriends,
      selectedOffer,
      earnablePoints,
      handleBookingError,
      router,
    ],
  );

  /**
   * Validates selections and shows a confirmation alert before submitting.
   * This is the function called by the UI.
   */
  const submitBooking = (formData: BookingFormData) => {
    // Offer validation
    if (selectedOffer) {
      if (new Date(selectedOffer.expires_at) < new Date()) {
        Alert.alert("Offer Expired", "This offer is no longer valid.");
        return;
      }
      if (
        selectedOffer.special_offer.minimum_party_size &&
        totalPartySize < selectedOffer.special_offer.minimum_party_size
      ) {
        Alert.alert(
          "Party Size Too Small",
          `This offer requires a minimum of ${selectedOffer.special_offer.minimum_party_size} guests.`,
        );
        return;
      }
    }

    // Tailor confirmation message based on booking type
    const confirmationTitle = isRequestBooking
      ? "Send Booking Request?"
      : "Confirm Your Booking";
    let confirmationMessage = `You are ${isRequestBooking ? "requesting" : "booking"} a table for ${totalPartySize} at ${restaurant?.name} on ${bookingDate.toLocaleDateString()} at ${bookingTime}.`;
    if (isRequestBooking) {
      confirmationMessage +=
        "\n\nThe restaurant will review your request and confirm shortly.";
    }
    if (selectedOffer) {
      confirmationMessage += `\n\nOffer Applied: ${selectedOffer.special_offer.title}`;
    }

    Alert.alert(confirmationTitle, confirmationMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: isRequestBooking ? "Send Request" : "Confirm",
        onPress: () => executeSubmit(formData),
      },
    ]);
  };

  // --- Callback Handlers ---
  const handleInvitesSent = useCallback((friendIds: string[]) => {
    setInvitedFriends(friendIds);
  }, []);

  return {
    // State & Data
    restaurant,
    loading,
    submitting,
    availableOffers,
    invitedFriends,
    selectedOffer,
    selectedOfferUserId,
    isRequestBooking,

    // User & Profile Data
    userPoints,
    userTier,
    profile,

    // Booking Details
    bookingDate,
    bookingTime,
    partySize: basePartySize, // The user's selected party size
    totalPartySize, // Party size including invited friends
    earnablePoints,
    turnTime,
    selectedTableIds,
    requiresCombination,

    // Actions
    submitBooking,
    setSelectedOfferUserId,
    handleInvitesSent,
  };
}
