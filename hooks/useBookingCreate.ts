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
import {
  calculateBookingWindow,
  validateTableAssignment,
} from "@/lib/tableManagementUtils";

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
  tableIds?: string;
  requiresCombination?: string;
}

export function useBookingCreate() {
  const params = useLocalSearchParams<any>();
  const { profile } = useAuth();
  const router = useRouter();

  // Core state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(null);
  const [availableOffers, setAvailableOffers] = useState<UserOfferWithDetails[]>([]);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [turnTime, setTurnTime] = useState<number>(120);
  const [lastFormData, setLastFormData] = useState<BookingFormData | null>(null);

  // Parse and validate parameters with better error handling
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
  const rawEarnablePoints = params.earnablePoints;
  const preselectedOfferId = params.offerId || params.preselectedOfferId;
  
  // Enhanced table information parsing with validation
  const selectedTableIds = useMemo(() => {
    if (!params.tableIds) return [];
    
    try {
      const parsed = JSON.parse(params.tableIds);
      if (!Array.isArray(parsed)) {
        console.error("Table IDs must be an array");
        return [];
      }
      
      // Validate that all elements are strings/numbers
      const validated = parsed.filter(id => 
        typeof id === 'string' || typeof id === 'number'
      );
      
      if (validated.length !== parsed.length) {
        console.warn("Some table IDs were invalid and filtered out");
      }
      
      return validated;
    } catch (e) {
      console.error("Error parsing table IDs:", e);
      return [];
    }
  }, [params.tableIds]);

  const requiresCombination = params.requiresCombination === "true";

  // User data
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";

  // Parsed booking details with memoization
  const bookingDate = useMemo(() => parseDate(rawDate), [rawDate]);
  const bookingTime = useMemo(() => 
    isValidTime(rawTime) ? rawTime! : "19:00", [rawTime]
  );
  const partySize = useMemo(() => 
    rawPartySize ? Math.max(1, parseInt(rawPartySize, 10)) || 2 : 2, 
    [rawPartySize]
  );
  const earnablePoints = useMemo(() => 
    rawEarnablePoints ? Math.max(0, parseInt(rawEarnablePoints, 10)) || 0 : 0,
    [rawEarnablePoints]
  );
  

  // Enhanced parameter validation
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

    // Validate table selection logic
    if (requiresCombination && selectedTableIds.length < 2) {
      Alert.alert("Error", "Table combination requires at least 2 tables");
      router.back();
      return;
    }
  }, [restaurantId, rawDate, rawTime, requiresCombination, selectedTableIds.length, router]);

  // Enhanced error handler for booking submission
  const handleBookingError = useCallback((error: any) => {
    console.error("Error creating booking:", error);
    
    const errorCode = error.code;
    const errorMessage = error.message || '';
    
    // Handle specific database errors
    if (errorCode === '23505') {
      Alert.alert(
        "Booking Conflict",
        "A booking already exists for this time. Please refresh and try again.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } else if (errorCode === 'P0001') {
      if (errorMessage.includes('no longer available')) {
        Alert.alert(
          "Table No Longer Available",
          "Sorry, the selected time slot was just booked by another customer. Please select a different time.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else if (errorMessage.includes('not all selected tables can be combined')) {
        Alert.alert(
          "Invalid Table Selection",
          "The selected tables cannot be combined. Please try a different time slot.",
          [{ text: "OK" }]
        );
      } else if (errorMessage.includes('do not have enough capacity')) {
        Alert.alert(
          "Insufficient Capacity",
          "The selected tables don't have enough seats for your party size. Please select a different time.",
          [{ text: "OK" }]
        );
      } else if (errorMessage.includes('generate unique confirmation code')) {
        Alert.alert(
          "System Error",
          "Unable to generate booking confirmation. Please try again.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Booking Error", errorMessage);
      }
    } else if (errorCode === '23503') {
      Alert.alert(
        "Invalid Selection",
        "Some of the selected options are no longer valid. Please refresh and try again.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } else if (errorCode === '22P02') {
      Alert.alert(
        "Invalid Data",
        "Some of the booking information is invalid. Please check your selections.",
        [{ text: "OK" }]
      );
    } else if (error.name === 'AbortError') {
      Alert.alert(
        "Request Timeout",
        "The booking request took too long. Please check your connection and try again.",
        [{ text: "OK" }]
      );
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      Alert.alert(
        "Connection Error",
        "Unable to connect to the server. Please check your internet connection and try again.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Booking Failed",
        "An unexpected error occurred while creating your booking. Please try again later.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => lastFormData && submitBooking(lastFormData) }
        ]
      );
    }
  }, [router, lastFormData]);

  // Helper functions for post-booking operations
  const handleFriendInvitations = useCallback(async (bookingId: string, friendIds: string[]) => {
    if (!profile?.id || !restaurant) return;
    
    const invites = friendIds.map((friendId) => ({
      booking_id: bookingId,
      from_user_id: profile.id,
      to_user_id: friendId,
      message: `Join me at ${restaurant.name} on ${bookingDate.toLocaleDateString()} at ${bookingTime}!`,
    }));

    const { error } = await supabase.from("booking_invites").insert(invites);
    
    if (error) throw error;

    await supabase.from("booking_attendees").insert({
      booking_id: bookingId,
      user_id: profile.id,
      status: "confirmed",
      is_organizer: true,
    });
  }, [profile, restaurant, bookingDate, bookingTime]);

  const markOfferAsUsed = useCallback(async (offerUserId: string, bookingId: string) => {
    if (!profile?.id) return;
    
    const { error } = await supabase
      .from("user_offers")
      .update({ 
        used_at: new Date().toISOString(),
        booking_id: bookingId 
      })
      .eq("id", offerUserId)
      .eq("user_id", profile.id);

    if (error) throw error;
  }, [profile]);

  const awardLoyaltyPoints = useCallback(async (userId: string, points: number) => {
    const { error } = await supabase.rpc("award_loyalty_points", {
      p_user_id: userId,
      p_points: points,
    });

    if (error) throw error;
  }, []);

  const createSuccessParams = useCallback((booking: any, selectedOffer: any) => ({
    bookingId: booking.id,
    restaurantName: restaurant?.name || '',
    confirmationCode: booking.confirmation_code,
    earnedPoints: earnablePoints.toString(),
    appliedOffer: selectedOffer ? "true" : "false",
    invitedFriends: invitedFriends.length.toString(),
    isGroupBooking: invitedFriends.length > 0 ? "true" : "false",
    userTier,
    tableInfo: requiresCombination ? "combined" : "single",
    ...(selectedOffer && {
      offerTitle: selectedOffer.special_offer.title,
      offerDiscount: selectedOffer.special_offer.discount_percentage.toString(),
    }),
  }), [restaurant, earnablePoints, invitedFriends.length, userTier, requiresCombination]);

  // Enhanced data fetching with optimized dependencies

  const basePartySize = rawPartySize
    ? Math.max(1, parseInt(rawPartySize, 10)) || 2
    : 2;

  // Calculate total party size (will update when friends are invited)
  const totalPartySize = basePartySize + invitedFriends.length;

  // Data fetching - use basePartySize for initial turn time calculation
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

      // Use basePartySize for initial turn time calculation
      const bookingWindow = await calculateBookingWindow(
        restaurantId,
        bookingDate,
        bookingTime,
        basePartySize // FIX: Use base party size, not total
      );
      setTurnTime(bookingWindow.turnTimeMinutes);

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
            .gte("expires_at", new Date().toISOString())
            .gte("special_offer.valid_until", new Date().toISOString());

          if (!offersError && userOffersData) {
            const restaurantOffers = userOffersData
              .filter(
                (offer) => offer.special_offer?.restaurant_id === restaurantId
              )
              .filter((offer) => offer.special_offer !== null)
              .map((offer) => ({
                ...offer,
                special_offer: offer.special_offer!,
              })) as unknown as UserOfferWithDetails[];

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
  }, [restaurantId, preselectedOfferId, profile, bookingDate, bookingTime, basePartySize]);


  const submitBooking = useCallback(
    async (formData: BookingFormData) => {
      if (!restaurant || !profile?.id) return;

      setSubmitting(true);
      setLastFormData(formData);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // Build booking date/time
        const bookingDateTime = new Date(bookingDate);
        const [hours, minutes] = bookingTime.split(":").map(Number);
        
        if (isNaN(hours) || isNaN(minutes)) {
          throw new Error("Invalid booking time format");
        }
        
        bookingDateTime.setHours(hours, minutes, 0, 0);

        // Get selected offer
        const selectedOffer = selectedOfferUserId
          ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
          : null;

        // REMOVED redundant table validation - database function handles it atomically
        
        // Create booking with abort signal
        const { data: bookingResult, error: bookingError } = await supabase.rpc(
          'create_booking_with_tables',
          {
            p_user_id: profile.id,
            p_restaurant_id: restaurant.id,
            p_booking_time: bookingDateTime.toISOString(),
            p_party_size: totalPartySize, // Use total party size including friends
            p_table_ids: selectedTableIds.length > 0 ? selectedTableIds : [],
            p_turn_time: turnTime,
            p_special_requests: formData.specialRequests || null,
            p_occasion: formData.occasion !== "none" ? formData.occasion : null,
            p_dietary_notes: formData.dietaryRestrictions.length > 0 ? formData.dietaryRestrictions : null,
            p_table_preferences: formData.tablePreferences.length > 0 ? formData.tablePreferences : null,
            p_is_group_booking: invitedFriends.length > 0,
            p_applied_offer_id: selectedOffer?.special_offer.id || null,
          }
        );

        clearTimeout(timeoutId);

        if (bookingError) {
          throw bookingError;
        }

        if (!bookingResult?.booking) {
          throw new Error('No booking data returned');
        }

        const booking = bookingResult.booking;

        // Handle post-booking operations with error recovery
        const postBookingPromises = [];

        // Friend invitations
        if (invitedFriends.length > 0) {
          postBookingPromises.push(
            handleFriendInvitations(booking.id, invitedFriends).catch(err => {
              console.error("Failed to send friend invitations:", err);
              // Don't fail the booking for this
            })
        );
        }

        // Mark offer as used
        if (selectedOfferUserId && selectedOffer) {
          postBookingPromises.push(
            markOfferAsUsed(selectedOfferUserId, booking.id).catch(err => {
              console.error("Failed to mark offer as used:", err);
              // Don't fail the booking for this
            })
          );
        }

        // Award loyalty points
        if (earnablePoints > 0) {
          postBookingPromises.push(
            awardLoyaltyPoints(profile.id, earnablePoints).catch(err => {
              console.error("Failed to award loyalty points:", err);
              // Don't fail the booking for this
            })
          );
        }

        // Wait for all post-booking operations
        await Promise.allSettled(postBookingPromises);

        // Success haptic feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        // Navigate to success
        router.replace({
          pathname: "/booking/success",
          params: createSuccessParams(booking, selectedOffer),
        });

      } catch (error: any) {
        handleBookingError(error);
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
      turnTime,
      selectedTableIds,
      requiresCombination,
      handleBookingError,
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
  const selectedOffer = useMemo(() => 
    selectedOfferUserId
      ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
      : null,
    [selectedOfferUserId, availableOffers]
  );

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
    turnTime,

    // Table information
    selectedTableIds,
    requiresCombination,

    // Actions
    submitBooking,
    setSelectedOfferUserId,
    handleInvitesSent,
  };
}