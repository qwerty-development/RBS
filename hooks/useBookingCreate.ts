// hooks/useBookingCreate.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useBookingsStore } from "@/stores";
import { Database } from "@/types/supabase";
import { BookingEligibilityResult } from "@/types/database-functions";
import {
  isValidDate,
  parseDate,
  isValidTime,
  TierType,
} from "@/lib/bookingUtils";
import { calculateBookingWindow } from "@/lib/tableManagementUtils";
import { notifyRestaurantWhatsAppNonBlocking } from "@/lib/whatsapp-notification";

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
 * Integrates the new loyalty system for earning points.
 */
export function useBookingCreate() {
  const params = useLocalSearchParams<any>();
  const { profile } = useAuth();
  const router = useRouter();
  const { addNewBooking } = useBookingsStore();

  // --- Core State ---
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

  // --- Loyalty System State ---
  const [expectedLoyaltyPoints, setExpectedLoyaltyPoints] = useState<number>(0);
  const [loyaltyRuleId, setLoyaltyRuleId] = useState<string | null>(null);

  // --- Rating System State ---
  const [ratingEligibility, setRatingEligibility] =
    useState<BookingEligibilityResult | null>(null);
  const [ratingRestricted, setRatingRestricted] = useState<boolean>(false);
  const [ratingMessage, setRatingMessage] = useState<string>("");

  // --- Booking Type State ---
  const [isRequestBooking, setIsRequestBooking] = useState<boolean>(false);

  // --- Parse and Memoize Route Parameters ---
  const restaurantId = params.restaurantId;
  const rawDate = params.date;
  const rawTime = params.time;
  const rawPartySize = params.partySize;
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

  // --- Memoized User & Booking Details ---
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

  const selectedOffer = useMemo(
    () =>
      selectedOfferUserId
        ? availableOffers.find((offer) => offer.id === selectedOfferUserId)
        : null,
    [selectedOfferUserId, availableOffers],
  );

  // --- Initial Parameter Validation ---
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

  /**
   * Fetches the applicable loyalty rule and expected points for the current booking details.
   * This is a separate callback as it needs to be re-run when party size changes.
   */
  const fetchLoyaltyRule = useCallback(async () => {
    if (!restaurantId || !bookingDate || !bookingTime) return;
    try {
      // This is a hypothetical RPC function to calculate points based on various rules.
      // It encapsulates the business logic on the server.
      const { data, error } = await supabase.rpc(
        "get_applicable_loyalty_rule",
        {
          p_restaurant_id: restaurantId,
          p_booking_time: `${bookingDate.toISOString().split("T")[0]}T${bookingTime}:00`,
          p_party_size: totalPartySize,
          p_user_tier: userTier,
        },
      );

      if (error) {
        console.warn("Could not fetch or apply loyalty rule:", error.message);
        setExpectedLoyaltyPoints(0);
        setLoyaltyRuleId(null);
      } else if (data) {
        setExpectedLoyaltyPoints(data.points || 0);
        setLoyaltyRuleId(data.rule_id || null);
      }
    } catch (err) {
      console.error("Error fetching loyalty rule:", err);
      setExpectedLoyaltyPoints(0);
      setLoyaltyRuleId(null);
    }
  }, [restaurantId, bookingDate, bookingTime, totalPartySize, userTier]);

  /**
   * Checks user's booking eligibility based on their rating and restaurant requirements.
   * This prevents users with low ratings from attempting bookings they can't complete.
   */
  const checkBookingEligibility = useCallback(async () => {
    if (!profile || !restaurantId) return;

    try {
      const { data, error } = await supabase.rpc("check_booking_eligibility", {
        user_id_param: profile.id,
        restaurant_id_param: restaurantId,
        party_size_param: totalPartySize,
      });

      if (error) {
        console.warn("Could not check booking eligibility:", error.message);
        // Default to allow booking if check fails
        setRatingEligibility(null);
        setRatingRestricted(false);
        setRatingMessage("");
        return;
      }

      if (data && data.length > 0) {
        const eligibility = data[0];
        setRatingEligibility(eligibility);

        if (!eligibility.can_book) {
          setRatingRestricted(true);
          setRatingMessage(
            eligibility.restriction_reason ||
              "Your current rating doesn't allow bookings at this restaurant.",
          );
        } else {
          setRatingRestricted(false);
          setRatingMessage("");

          // Check if booking is forced to be request-only due to rating
          if (eligibility.forced_policy === "request_only") {
            setIsRequestBooking(true);
            setRatingMessage(
              "Due to your current rating, this will be submitted as a request for restaurant approval.",
            );
          }
        }
      }
    } catch (err) {
      console.error("Error checking booking eligibility:", err);
      // Default to allow booking if check fails
      setRatingEligibility(null);
      setRatingRestricted(false);
      setRatingMessage("");
    }
  }, [profile, restaurantId, totalPartySize]);

  /**
   * Fetches all initial data required for the booking screen.
   */
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

      // Initial booking policy check - will be overridden by rating restrictions if needed
      setIsRequestBooking(restaurantData.booking_policy === "request");

      // Check user's booking eligibility based on rating (this may force request-only booking)
      await checkBookingEligibility();

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
    checkBookingEligibility,
    preselectedOfferId,
  ]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Re-fetch loyalty points if party size changes (due to inviting friends)
  useEffect(() => {
    if (!loading) {
      // Avoid running on initial load before restaurant is set
      fetchLoyaltyRule();
    }
  }, [totalPartySize, loading, fetchLoyaltyRule]);

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

      // Check if user is blocked from booking at this restaurant
      if (ratingRestricted) {
        Alert.alert(
          "Booking Restricted",
          ratingMessage ||
            "Your current rating doesn't allow bookings at this restaurant.",
          [{ text: "OK" }],
        );
        return;
      }

      setSubmitting(true);
      setLastFormData(formData);

      const bookingDateTime = new Date(bookingDate);
      const [hours, minutes] = bookingTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);

      try {
        // --- INSTANT BOOKING LOGIC ---
        if (!isRequestBooking) {
          // This single RPC function handles booking creation, table assignment, and loyalty point awarding in one transaction.
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
              // New Loyalty System Parameters
              p_applied_loyalty_rule_id: loyaltyRuleId,
              p_expected_loyalty_points: expectedLoyaltyPoints,
            });
          if (bookingError) throw bookingError;
          if (!bookingResult?.booking)
            throw new Error("No booking data returned from RPC.");

          const booking = bookingResult.booking;

          // Update the booking store immediately
       
          addNewBooking(booking);

          // Post-booking side-effects (non-blocking)
          const postBookingPromises = [];
          if (invitedFriends.length > 0) {
            postBookingPromises.push(
              supabase.from("booking_invites").insert(
                invitedFriends.map((friendId) => ({
                  booking_id: booking.id,
                  from_user_id: profile.id,
                  to_user_id: friendId,
                  message: `Join me at ${restaurant.name}!`,
                })),
              ),
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
                .eq("id", selectedOffer.id),
            );
          }
          // The old point awarding RPC is removed as it's now handled transactionally within 'create_booking_with_tables'.
          await Promise.allSettled(postBookingPromises);

          // Send WhatsApp notification to restaurant (non-blocking)
        
          notifyRestaurantWhatsAppNonBlocking(booking.id);

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
              earnedPoints: expectedLoyaltyPoints.toString(), // Use new loyalty points state
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
              table_preferences:
                formData.tablePreferences.length > 0
                  ? formData.tablePreferences
                  : null,
              applied_offer_id: selectedOffer?.special_offer.id || null,
              is_group_booking: invitedFriends.length > 0,
              turn_time_minutes: turnTime,
              // New Loyalty System Fields: Stored for later processing upon confirmation
              applied_loyalty_rule_id: loyaltyRuleId,
              expected_loyalty_points: expectedLoyaltyPoints,
            })
            .select("id, confirmation_code")
            .single();

          if (bookingError) throw bookingError;

          // Update the booking store immediately
   
          addNewBooking(booking);

          // Send WhatsApp notification to restaurant (non-blocking)
         
          notifyRestaurantWhatsAppNonBlocking(booking.id);

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
              confirmationCode: booking.confirmation_code || "",
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
      expectedLoyaltyPoints,
      loyaltyRuleId, // Added new loyalty state
      ratingRestricted, // Added rating restriction state
      ratingMessage, // Added rating message state
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

    // Rating System State
    ratingEligibility,
    ratingRestricted,
    ratingMessage,

    // User & Profile Data
    userPoints,
    userTier,
    profile,

    // Booking Details
    bookingDate,
    bookingTime,
    partySize: basePartySize,
    totalPartySize,
    expectedLoyaltyPoints, // Replaced earnablePoints
    turnTime,
    selectedTableIds,
    requiresCombination,

    // Actions
    submitBooking,
    setSelectedOfferUserId,
    handleInvitesSent,
  };
}
