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
    tableIds: string[];
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
   * Now checks table IDs as well for more accurate detection
   */
  const isDuplicateSubmission = useCallback(
    (restaurantId: string, bookingTime: Date, partySize: number, tableIds: string[]): boolean => {
      const now = Date.now();
      const bookingTimeStr = bookingTime.toISOString();
      const tableIdsStr = JSON.stringify(tableIds.sort());

      if (lastSubmissionRef.current) {
        const last = lastSubmissionRef.current;
        const timeSinceLastSubmission = now - last.timestamp;

        // Check if exact same request within 2 seconds (reduced from 3)
        if (
          last.restaurantId === restaurantId &&
          last.bookingTime === bookingTimeStr &&
          last.partySize === partySize &&
          JSON.stringify(last.tableIds.sort()) === tableIdsStr &&
          timeSinceLastSubmission < 2000
        ) {
          console.log("Double-click detected, ignoring duplicate submission");
          return true;
        }
      }

      // Update last submission
      lastSubmissionRef.current = {
        restaurantId,
        bookingTime: bookingTimeStr,
        partySize,
        tableIds,
        timestamp: now,
      };

      return false;
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

      // Parse table IDs
      const parsedTableIds = parseTableIds(tableIds);

      // Check for duplicate submission (double-click)
      if (isDuplicateSubmission(restaurantId, bookingTime, partySize, parsedTableIds)) {
        return false;
      }

      // Set submission flag
      isSubmittingRef.current = true;
      setLoading(true);

      try {
        if (debugMode) {
          console.log("Booking confirmation - Details:", {
            restaurantId,
            bookingTime: bookingTime.toISOString(),
            partySize,
            tableIds: parsedTableIds,
            bookingPolicy,
          });
        }

        // Call the fixed RPC function
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

          const errorMessage = rpcError.message || "";
          const errorCode = rpcError.code;

          // Handle specific error cases with improved messages
          if (errorCode === "P0001") {
            // Custom errors from our RPC function
            
            // Check for existing booking conflict
            if (errorMessage.includes("You already have a booking at this time")) {
              Alert.alert(
                "Existing Booking",
                "You already have a booking at this time. Please cancel your existing booking first if you want to make changes.",
                [
                  {
                    text: "View Bookings",
                    onPress: () => router.push("/bookings"),
                  },
                  { text: "OK", style: "cancel" }
                ]
              );
              return false;
            }
            
            // Check for table unavailability
            if (errorMessage.includes("tables are no longer available") || 
                errorMessage.includes("table is not available")) {
              Alert.alert(
                "Tables Unavailable",
                "The selected tables were just booked. Please select a different time or refresh to see updated availability.",
                [
                  {
                    text: "Choose Different Time",
                    onPress: () => router.back()
                  },
                  { text: "OK", style: "cancel" }
                ]
              );
              return false;
            }
            
            // Check for table combination issues
            if (errorMessage.includes("cannot be combined")) {
              Alert.alert(
                "Invalid Table Selection",
                "The selected tables cannot be combined. Please choose different tables or book them separately.",
                [{ text: "OK" }]
              );
              return false;
            }
            
            // Check for capacity issues
            if (errorMessage.includes("insufficient for party") || 
                errorMessage.includes("enough capacity")) {
              Alert.alert(
                "Insufficient Capacity",
                `The selected tables don't have enough seats for ${partySize} guests. Please select different tables or reduce your party size.`,
                [{ text: "OK" }]
              );
              return false;
            }
            
            // Check for booking window issues
            if (errorMessage.includes("beyond allowed window")) {
              const daysMatch = errorMessage.match(/(\d+) days/);
              const days = daysMatch ? daysMatch[1] : "30";
              Alert.alert(
                "Booking Too Far Ahead",
                `Bookings can only be made up to ${days} days in advance.`,
                [{ text: "OK" }]
              );
              return false;
            }
            
            // Check for timing issues
            if (errorMessage.includes("at least 15 minutes in the future")) {
              Alert.alert(
                "Invalid Booking Time",
                "Bookings must be made at least 15 minutes in advance.",
                [{ text: "OK" }]
              );
              return false;
            }
            
            // Generic P0001 error
            Alert.alert(
              "Booking Error",
              errorMessage || "Unable to complete your booking. Please try again.",
              [{ text: "OK" }]
            );
            return false;
          }

          // Handle permission errors
          if (errorCode === "42501") {
            Alert.alert(
              "Permission Error",
              "You don't have permission to complete this booking. Please try logging out and back in.",
              [
                {
                  text: "Sign Out",
                  onPress: () => {
                    supabase.auth.signOut();
                    router.replace("/auth/login");
                  }
                },
                { text: "Cancel", style: "cancel" }
              ]
            );
            return false;
          }

          // Handle unauthorized access
          if (errorMessage.includes("Unauthorized")) {
            Alert.alert(
              "Unauthorized",
              "Your session may have expired. Please sign in again.",
              [
                {
                  text: "Sign In",
                  onPress: () => router.replace("/auth/login")
                },
                { text: "Cancel", style: "cancel" }
              ]
            );
            return false;
          }

          // Handle restaurant status issues
          if (errorMessage.includes("not currently accepting bookings") || 
              errorMessage.includes("Restaurant not found")) {
            Alert.alert(
              "Restaurant Unavailable",
              "This restaurant is not currently accepting bookings. Please try again later or choose another restaurant.",
              [{ text: "OK", onPress: () => router.back() }]
            );
            return false;
          }

          // Generic error handling
          Alert.alert(
            "Booking Failed",
            "An unexpected error occurred. Please try again or contact support if the issue persists.",
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
          console.log("Duplicate booking detected, navigating to success with existing booking");
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

        // Check for network errors
        if (error.message?.includes("NetworkError") || error.message?.includes("fetch")) {
          Alert.alert(
            "Connection Error",
            "Unable to connect to the server. Please check your internet connection and try again.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Booking Failed",
            "An unexpected error occurred. Please try again or contact support if the issue persists.",
            [{ text: "OK" }]
          );
        }

        return false;
      } finally {
        // Reset submission flag after a short delay to prevent rapid retries
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 1000); // Reduced from 2000ms
        setLoading(false);
      }
    },
    [profile, router, parseTableIds, isDuplicateSubmission, debugMode],
  );

  /**
   * Handle booking cancellation with improved error handling
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

      // Check if cancellation is allowed
      const bookingTime = new Date(booking.booking_time);
      const now = new Date();
      const hoursUntilBooking =
        (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilBooking < 2) {
        Alert.alert(
          "Cancellation Not Allowed",
          "Bookings cannot be cancelled less than 2 hours before the reservation time.",
          [{ text: "OK" }]
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

      // Clear availability cache
      try {
        const availabilityService = AvailabilityService.getInstance();
        availabilityService.clearRestaurantCacheForDate(
          booking.restaurant_id,
          new Date(booking.booking_time),
        );
      } catch (cacheError) {
        console.warn("Failed to clear availability cache:", cacheError);
      }

      // Handle loyalty points refund if applicable
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
          // Don't fail the cancellation, just log the error
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "Booking Cancelled",
        "Your booking has been successfully cancelled.",
        [{ text: "OK" }]
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
    cancelBooking,
    loading,
    isSubmitting: isSubmittingRef.current,
    resetSubmissionTracking,
  };
};