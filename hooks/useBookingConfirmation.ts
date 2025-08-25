// hooks/useBookingConfirmation.ts
import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { AvailabilityService } from "@/lib/AvailabilityService";

interface BookingConfirmationProps {
  restaurantId: string;
  bookingTime: Date;
  partySize: number;
  specialRequests?: string;
  occasion?: string;
  dietaryNotes?: string[];
  tablePreferences?: string[];
  bookingPolicy: "instant" | "request";
  expectedLoyaltyPoints?: number;
  appliedOfferId?: string;
  loyaltyRuleId?: string;
  tableIds?: string; // JSON string of table IDs array
  requiresCombination?: boolean;
  turnTime?: number;
  isGroupBooking?: boolean;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
}

interface BookingResult {
  booking: {
    id: string;
    confirmation_code: string;
    restaurant_name?: string;
    status: string;
    booking_time: string;
    party_size: number;
    loyalty_points_earned?: number;
    restaurant?: {
      name: string;
      id: string;
    };
  };
  tables?: {
    id: string;
    table_number: string;
    table_type: string;
  }[];
  is_duplicate_attempt?: boolean;
  debug_info?: any;
}

export const useBookingConfirmation = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [debugMode] = useState(process.env.NODE_ENV === 'development');

  // Add refs to prevent double submission
  const isSubmittingRef = useRef(false);
  const lastSubmissionRef = useRef<{
    restaurantId: string;
    bookingTime: string;
    partySize: number;
    timestamp: number;
  } | null>(null);

  /**
   * Parse table IDs from JSON string safely
   */
  const parseTableIds = useCallback((tableIdsJson?: string): string[] => {
    if (!tableIdsJson) return [];

    try {
      const parsed = JSON.parse(tableIdsJson);
      return Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string")
        : [];
    } catch (e) {
      console.error("Error parsing table IDs:", e);
      return [];
    }
  }, []);

  /**
   * Check if this is a duplicate submission attempt (double-click prevention)
   */
  const isDuplicateSubmission = useCallback(
    (restaurantId: string, bookingTime: Date, partySize: number): boolean => {
      const now = Date.now();
      const bookingTimeStr = bookingTime.toISOString();

      if (lastSubmissionRef.current) {
        const last = lastSubmissionRef.current;
        const timeSinceLastSubmission = now - last.timestamp;

        // If same booking details submitted within 3 seconds, it's likely a duplicate
        if (
          last.restaurantId === restaurantId &&
          last.bookingTime === bookingTimeStr &&
          last.partySize === partySize &&
          timeSinceLastSubmission < 3000
        ) {
          console.log("Duplicate submission detected (double-click), ignoring...");
          return true;
        }
      }

      // Update last submission
      lastSubmissionRef.current = {
        restaurantId,
        bookingTime: bookingTimeStr,
        partySize,
        timestamp: now,
      };

      return false;
    },
    [],
  );

  /**
   * Handle loyalty points and offers for confirmed bookings
   */
  const handleLoyaltyAndOffers = useCallback(
    async (
      bookingId: string,
      loyaltyRuleId?: string,
      appliedOfferId?: string,
      userId?: string,
    ) => {
      try {
        // Award loyalty points if rule exists
        if (loyaltyRuleId) {
          const { error: loyaltyError } = await supabase.rpc(
            "award_restaurant_loyalty_points",
            { p_booking_id: bookingId },
          );

          if (loyaltyError) {
            console.error("Failed to award loyalty points:", loyaltyError);
            // Don't fail the booking, just log the error
          }
        }

        // Apply offer if selected
        if (appliedOfferId && userId) {
          const { error: offerError } = await supabase
            .from("user_offers")
            .update({
              used_at: new Date().toISOString(),
              booking_id: bookingId,
            })
            .eq("id", appliedOfferId)
            .is("booking_id", null); // Only update if not already used

          if (offerError) {
            console.error("Failed to apply offer:", offerError);
          }
        }
      } catch (error) {
        console.error("Error handling loyalty and offers:", error);
      }
    },
    [],
  );

  /**
   * Main booking confirmation function with improved error handling
   */
  const confirmBooking = useCallback(
    async (props: BookingConfirmationProps) => {
      // Check if already submitting
      if (isSubmittingRef.current) {
        console.log("Already submitting booking, ignoring duplicate request");
        return false;
      }

      if (!profile?.id) {
        Alert.alert("Error", "Please sign in to make a booking");
        return false;
      }

      const {
        restaurantId,
        bookingTime,
        partySize,
        specialRequests,
        occasion,
        dietaryNotes,
        tablePreferences,
        bookingPolicy,
        expectedLoyaltyPoints,
        appliedOfferId,
        loyaltyRuleId,
        tableIds,
        requiresCombination,
        turnTime = 120,
        isGroupBooking = false,
      } = props;

      // Check for duplicate submission (double-click)
      if (isDuplicateSubmission(restaurantId, bookingTime, partySize)) {
        console.log("Double-click detected, ignoring");
        return false;
      }

      // Set submission flag
      isSubmittingRef.current = true;
      setLoading(true);

      try {
        // Parse table IDs
        const parsedTableIds = parseTableIds(tableIds);
        
        if (debugMode) {
          console.log("Booking confirmation - Details:", {
            restaurantId,
            bookingTime: bookingTime.toISOString(),
            partySize,
            tableIds: parsedTableIds,
            bookingPolicy,
          });
        }

        // Call the improved RPC function
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "create_booking_with_tables",
          {
            p_user_id: profile.id,
            p_restaurant_id: restaurantId,
            p_booking_time: bookingTime.toISOString(),
            p_party_size: partySize,
            p_table_ids: parsedTableIds.length > 0 ? parsedTableIds : null,
            p_turn_time: turnTime,
            p_special_requests: specialRequests || null,
            p_occasion: occasion !== "none" ? occasion : null,
            p_dietary_notes: dietaryNotes || null,
            p_table_preferences: tablePreferences || null,
            p_is_group_booking: isGroupBooking,
            p_applied_offer_id: appliedOfferId || null,
            p_booking_policy: bookingPolicy,
            p_expected_loyalty_points: expectedLoyaltyPoints || 0,
            p_applied_loyalty_rule_id: loyaltyRuleId || null,
          },
        );

        if (rpcError) {
          // Log debug info if available
          if (debugMode) {
            console.error("RPC Error Details:", {
              code: rpcError.code,
              message: rpcError.message,
              details: rpcError.details,
              hint: rpcError.hint,
            });
          }

          // Improved error handling
          const errorMessage = rpcError.message || "";
          const errorCode = rpcError.code;

          // Handle specific error cases
          if (errorCode === "P0001") {
            // Custom error from our RPC
            if (errorMessage.includes("no longer available") || 
                errorMessage.includes("selected tables are no longer available")) {
              Alert.alert(
                "Tables Unavailable",
                "The selected tables were just booked by another user. Please select a different time or table combination.",
                [{ text: "OK" }]
              );
            } else if (errorMessage.includes("not all selected tables can be combined")) {
              Alert.alert(
                "Invalid Table Combination",
                "The selected tables cannot be combined. Please choose different tables or contact the restaurant.",
                [{ text: "OK" }]
              );
            } else if (errorMessage.includes("do not have enough capacity")) {
              Alert.alert(
                "Insufficient Capacity",
                `The selected tables don't have enough seats for ${partySize} guests. Please select different tables or reduce party size.`,
                [{ text: "OK" }]
              );
            } else if (errorMessage.includes("not available")) {
              Alert.alert(
                "Table Unavailable",
                "One or more selected tables are not available. Please try a different selection.",
                [{ text: "OK" }]
              );
            } else {
              // Generic P0001 error
              Alert.alert(
                "Booking Error",
                errorMessage || "Unable to complete your booking. Please try again.",
                [{ text: "OK" }]
              );
            }
            return false;
          }

          // Handle duplicate key errors
          if (errorCode === "23505") {
            // This shouldn't happen with our improved RPC, but handle it gracefully
            console.warn("Unexpected duplicate key error");
            
            // Try to fetch the existing booking
            const { data: existingBooking } = await supabase
              .from("bookings")
              .select(`
                id, 
                confirmation_code, 
                status,
                restaurant:restaurants(name)
              `)
              .eq("user_id", profile.id)
              .eq("restaurant_id", restaurantId)
              .eq("booking_time", bookingTime.toISOString())
              .eq("party_size", partySize)
              .in("status", ["pending", "confirmed"])
              .single();

            if (existingBooking) {
              Alert.alert(
                "Booking Already Exists",
                `You already have a booking for this time.\nConfirmation code: ${existingBooking.confirmation_code}`,
                [
                  {
                    text: "View Booking",
                    onPress: () => router.replace(`/booking/${existingBooking.id}`),
                  },
                ],
              );
            } else {
              Alert.alert(
                "Booking Error",
                "Unable to create booking. Please try selecting a different time.",
                [{ text: "OK" }],
              );
            }
            return false;
          }

          // Handle permission errors
          if (errorCode === "42501") {
            Alert.alert(
              "Permission Error",
              "You don't have permission to complete this booking. Please try logging out and back in.",
              [{ text: "OK" }]
            );
            return false;
          }

          // Handle other errors
          Alert.alert(
            "Booking Failed",
            errorMessage || "Unable to create booking. Please try again.",
            [{ text: "OK" }]
          );
          return false;
        }

        // Check if we got a valid result
        if (!rpcResult?.booking) {
          throw new Error("No booking data returned from server");
        }

        const bookingResult: BookingResult = rpcResult;

        // Log debug info if available
        if (debugMode && bookingResult.debug_info) {
          console.log("Booking Debug Info:", bookingResult.debug_info);
        }

        // Check if this was a duplicate attempt that returned existing booking
        if (bookingResult.is_duplicate_attempt) {
          console.log("Duplicate booking returned (user already has this booking)");
          
          // Still navigate to success page with existing booking
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );

          if (bookingPolicy === "instant") {
            router.replace({
              pathname: "/booking/success",
              params: {
                bookingId: bookingResult.booking.id,
                restaurantName: bookingResult.booking.restaurant?.name || "Restaurant",
                bookingTime: bookingTime.toISOString(),
                partySize: partySize.toString(),
                confirmationCode: bookingResult.booking.confirmation_code,
                loyaltyPoints: (expectedLoyaltyPoints || 0).toString(),
                tableInfo: requiresCombination ? "combined" : "single",
                earnedPoints: (expectedLoyaltyPoints || 0).toString(),
              },
            });
          } else {
            router.replace({
              pathname: "/booking/request-sent",
              params: {
                bookingId: bookingResult.booking.id,
                restaurantName: bookingResult.booking.restaurant?.name || "Restaurant",
                bookingTime: bookingTime.toISOString(),
                partySize: partySize.toString(),
              },
            });
          }
          return true;
        }

        // Handle loyalty points and offers for new bookings
        if (bookingPolicy === "instant" && !bookingResult.is_duplicate_attempt) {
          await handleLoyaltyAndOffers(
            bookingResult.booking.id,
            loyaltyRuleId,
            appliedOfferId,
            profile.id,
          );
        }

        // Success feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // Clear availability cache
        try {
          const availabilityService = AvailabilityService.getInstance();
          availabilityService.clearRestaurantCacheForDate(
            restaurantId,
            bookingTime,
          );
          console.log("Availability cache cleared after successful booking");
        } catch (cacheError) {
          console.warn("Failed to clear availability cache:", cacheError);
        }

        // Navigate based on booking type
        if (bookingPolicy === "instant") {
          router.replace({
            pathname: "/booking/success",
            params: {
              bookingId: bookingResult.booking.id,
              restaurantName: bookingResult.booking.restaurant?.name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
              confirmationCode: bookingResult.booking.confirmation_code,
              loyaltyPoints: (expectedLoyaltyPoints || 0).toString(),
              tableInfo: requiresCombination ? "combined" : "single",
              earnedPoints: (bookingResult.booking.loyalty_points_earned || expectedLoyaltyPoints || 0).toString(),
            },
          });
        } else {
          router.replace({
            pathname: "/booking/request-sent",
            params: {
              bookingId: bookingResult.booking.id,
              restaurantName: bookingResult.booking.restaurant?.name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
            },
          });
        }

        return true;
      } catch (error: any) {
        console.error("Booking confirmation error:", error);

        // Generic error handling
        Alert.alert(
          "Booking Failed",
          "An unexpected error occurred. Please try again or contact support if the issue persists.",
          [{ text: "OK" }],
        );

        return false;
      } finally {
        // Reset submission flag after a delay to prevent rapid retries
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 2000);
        setLoading(false);
      }
    },
    [
      profile,
      router,
      parseTableIds,
      handleLoyaltyAndOffers,
      isDuplicateSubmission,
      debugMode,
    ],
  );

  /**
   * Handle booking status change (for request bookings)
   */
  const handleBookingStatusChange = useCallback(
    async (
      bookingId: string,
      newStatus: "confirmed" | "declined_by_restaurant",
    ) => {
      try {
        // Update booking status
        const { error: statusError } = await supabase
          .from("bookings")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bookingId);

        if (statusError) throw statusError;

        // If confirmed and has loyalty rule, award points
        if (newStatus === "confirmed") {
          const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .select("applied_loyalty_rule_id, user_id, applied_offer_id")
            .eq("id", bookingId)
            .single();

          if (!bookingError && booking) {
            await handleLoyaltyAndOffers(
              bookingId,
              booking.applied_loyalty_rule_id,
              booking.applied_offer_id,
              booking.user_id,
            );
          }
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return true;
      } catch (error: any) {
        console.error("Error updating booking status:", error);
        Alert.alert(
          "Update Failed",
          error.message || "Unable to update booking status.",
        );
        return false;
      }
    },
    [handleLoyaltyAndOffers],
  );

  /**
   * Handle booking cancellation
   */
  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      // Get booking details first
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select(
          "status, applied_loyalty_rule_id, loyalty_points_earned, user_id, booking_time, restaurant_id",
        )
        .eq("id", bookingId)
        .single();

      if (fetchError) throw fetchError;

      // Check if cancellation is allowed (e.g., not too close to booking time)
      const bookingTime = new Date(booking.booking_time);
      const now = new Date();
      const hoursUntilBooking =
        (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilBooking < 2) {
        Alert.alert(
          "Cancellation Not Allowed",
          "Bookings cannot be cancelled less than 2 hours before the reservation time.",
          [{ text: "OK" }],
        );
        return false;
      }

      // Update booking status
      const { error: cancelError } = await supabase
        .from("bookings")
        .update({
          status: "cancelled_by_user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (cancelError) throw cancelError;

      // Clear availability cache for this restaurant and time
      try {
        const availabilityService = AvailabilityService.getInstance();
        availabilityService.clearRestaurantCacheForDate(
          booking.restaurant_id,
          new Date(booking.booking_time),
        );
      } catch (cacheError) {
        console.warn("Failed to clear availability cache:", cacheError);
      }

      // If points were awarded, refund them
      if (
        booking.loyalty_points_earned > 0 &&
        booking.applied_loyalty_rule_id
      ) {
        const { error: refundError } = await supabase.rpc(
          "refund_restaurant_loyalty_points",
          { p_booking_id: bookingId },
        );

        if (refundError) {
          console.error("Failed to refund loyalty points:", refundError);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "Booking Cancelled",
        "Your booking has been successfully cancelled.",
        [{ text: "OK" }],
      );

      return true;
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      Alert.alert(
        "Cancellation Failed",
        error.message || "Unable to cancel booking. Please try again.",
      );
      return false;
    }
  }, []);

  /**
   * Reset submission tracking (useful for testing or after navigation)
   */
  const resetSubmissionTracking = useCallback(() => {
    isSubmittingRef.current = false;
    lastSubmissionRef.current = null;
  }, []);

  return {
    confirmBooking,
    handleBookingStatusChange,
    cancelBooking,
    loading,
    isSubmitting: isSubmittingRef.current,
    resetSubmissionTracking,
  };
};