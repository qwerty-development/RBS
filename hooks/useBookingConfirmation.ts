// hooks/useBookingConfirmation.ts
import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { AvailabilityService } from "@/lib/AvailabilityService";
import { NotificationHelpers } from "@/lib/NotificationHelpers";

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
}

export const useBookingConfirmation = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
   * Check if this is a duplicate submission attempt
   */
  const isDuplicateSubmission = useCallback(
    (restaurantId: string, bookingTime: Date, partySize: number): boolean => {
      const now = Date.now();
      const bookingTimeStr = bookingTime.toISOString();

      if (lastSubmissionRef.current) {
        const last = lastSubmissionRef.current;
        const timeSinceLastSubmission = now - last.timestamp;

        // If same booking details submitted within 5 seconds, it's likely a duplicate
        if (
          last.restaurantId === restaurantId &&
          last.bookingTime === bookingTimeStr &&
          last.partySize === partySize &&
          timeSinceLastSubmission < 5000
        ) {
          console.log("Duplicate submission detected, ignoring...");
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
   * Main booking confirmation function with duplicate prevention
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
        guestName,
        guestEmail,
        guestPhone,
      } = props;

      // Check for duplicate submission
      if (isDuplicateSubmission(restaurantId, bookingTime, partySize)) {
        console.log("Duplicate submission detected, ignoring");
        return false;
      }

      // Set submission flag
      isSubmittingRef.current = true;
      setLoading(true);

      try {
        // Parse table IDs
        const parsedTableIds = parseTableIds(tableIds);
        console.log("Booking confirmation - Parsed Table IDs:", parsedTableIds);

        let bookingResult: BookingResult;

        // Always use RPC function for consistency
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
          // Check if it's a DUPLICATE_BOOKING error that should be shown to user
          if (
            rpcError.code === "P0002" &&
            rpcError.message?.includes("DUPLICATE_BOOKING")
          ) {
            // This is an intentional duplicate booking prevention - show error to user
            console.log("Duplicate booking detected, showing error to user");
            throw rpcError;
          }
          // Check if it's a benign duplicate attempt from race conditions (exact same booking created seconds ago)
          else if (
            rpcError.message?.includes("already have a booking") &&
            !rpcError.message?.includes("DUPLICATE_BOOKING")
          ) {
            console.log(
              "Race condition duplicate detected, treating as success",
            );
            // Try to fetch the existing booking
            const { data: existingBooking } = await supabase
              .from("bookings")
              .select(
                `
                *,
                restaurant:restaurants(name, id)
              `,
              )
              .eq("user_id", profile.id)
              .eq("restaurant_id", restaurantId)
              .eq("booking_time", bookingTime.toISOString())
              .eq("party_size", partySize)
              .in("status", ["pending", "confirmed"])
              .single();

            if (existingBooking) {
              bookingResult = {
                booking: {
                  id: existingBooking.id,
                  confirmation_code: existingBooking.confirmation_code,
                  restaurant_name: existingBooking.restaurant?.name,
                  status: existingBooking.status,
                  booking_time: existingBooking.booking_time,
                  party_size: existingBooking.party_size,
                  loyalty_points_earned: existingBooking.loyalty_points_earned,
                  restaurant: existingBooking.restaurant,
                },
                is_duplicate_attempt: true,
              };
            } else {
              throw rpcError;
            }
          } else {
            throw rpcError;
          }
        } else {
          if (!rpcResult?.booking) {
            throw new Error("No booking data returned from RPC");
          }
          bookingResult = rpcResult;
        }

        // Check if this was a duplicate attempt that returned existing booking
        if (bookingResult.is_duplicate_attempt) {
          console.log(
            "This was a duplicate attempt, existing booking returned",
          );
        } else {
          // Handle loyalty points and offers for new bookings
          if (bookingPolicy === "instant") {
            await handleLoyaltyAndOffers(
              bookingResult.booking.id,
              loyaltyRuleId,
              appliedOfferId,
              profile.id,
            );
          }
        }

        // Success feedback
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        // Send booking notification
        try {
          const bookingDate = bookingTime.toLocaleDateString();
          const bookingTimeStr = bookingTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          // Note: Booking notifications are now handled by database triggers
          // This prevents duplicate notifications from client and server
          console.log(`Booking ${bookingPolicy === "instant" ? "confirmed" : "requested"} - notification will be sent by database trigger`);

          // TEMPORARY: Disable scheduled notifications due to Expo development issues
          // TODO: Re-enable for production build
          const ENABLE_SCHEDULED_NOTIFICATIONS = false;

          if (bookingPolicy === "instant" && ENABLE_SCHEDULED_NOTIFICATIONS) {
            // Schedule booking reminder (2 hours before booking time)
            const reminderTime = new Date(bookingTime.getTime() - (2 * 60 * 60 * 1000));
            const now = new Date();

            console.log('Booking time:', bookingTime.toISOString());
            console.log('Reminder time:', reminderTime.toISOString());
            console.log('Current time:', now.toISOString());
            console.log('Should schedule reminder:', reminderTime > now);

            if (reminderTime > now) {
              console.log('Scheduling booking reminder for:', reminderTime.toISOString());
              await NotificationHelpers.scheduleBookingReminder({
                bookingId: bookingResult.booking.id,
                restaurantId: restaurantId,
                restaurantName: bookingResult.booking.restaurant_name || "Restaurant",
                date: bookingDate,
                time: bookingTimeStr,
                partySize: partySize,
                action: 'reminder',
              }, reminderTime);
            } else {
              console.log('Booking reminder not scheduled - too close to booking time');
            }

            // Schedule review reminder (1 day after booking time)
            const reviewReminderTime = new Date(bookingTime.getTime() + (24 * 60 * 60 * 1000));
            console.log('Scheduling review reminder for:', reviewReminderTime.toISOString());

            await NotificationHelpers.scheduleReviewReminder({
              restaurantId: restaurantId,
              restaurantName: bookingResult.booking.restaurant_name || "Restaurant",
              visitDate: bookingDate,
              action: 'reminder',
              bookingId: bookingResult.booking.id,
            }, reviewReminderTime);
          } else {
            console.log('Scheduled notifications disabled in development mode');
          }
        } catch (notificationError) {
          console.warn("Failed to send booking notification:", notificationError);
        }

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
              restaurantName:
                bookingResult.booking.restaurant_name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
              confirmationCode: bookingResult.booking.confirmation_code,
              loyaltyPoints: (expectedLoyaltyPoints || 0).toString(),
              tableInfo: requiresCombination ? "combined" : "single",
              earnedPoints: (expectedLoyaltyPoints || 0).toString(),
            },
          });
        } else {
          // For request bookings
          router.replace({
            pathname: "/booking/request-sent",
            params: {
              bookingId: bookingResult.booking.id,
              restaurantName:
                bookingResult.booking.restaurant_name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
            },
          });
        }

        return true;
      } catch (error: any) {
        console.error("Booking confirmation error:", error);

        // Handle specific error types
        if (
          error.code === "P0002" &&
          error.message?.includes("DUPLICATE_BOOKING")
        ) {
          // Extract the user-friendly message from the database error
          const message =
            error.message.split("DUPLICATE_BOOKING: ")[1] ||
            "You already have a booking for this time. Please choose a different time slot.";

          Alert.alert("Duplicate Booking", message, [{ text: "OK" }]);
        } else if (
          error.code === "P0001" &&
          error.message?.includes("no longer available")
        ) {
          Alert.alert(
            "Table No Longer Available",
            "This time slot was just booked. Please select another time.",
            [{ text: "OK" }],
          );
        } else if (
          error.code === "23505" ||
          error.message?.includes("duplicate key")
        ) {
          // This shouldn't happen anymore, but if it does, handle gracefully
          console.warn(
            "Unexpected duplicate key error, attempting to recover...",
          );

          // Try to fetch the existing booking
          const { data: existingBooking } = await supabase
            .from("bookings")
            .select("id, confirmation_code, status")
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId)
            .eq("booking_time", bookingTime.toISOString())
            .eq("party_size", partySize)
            .in("status", ["pending", "confirmed"])
            .single();

          if (existingBooking) {
            Alert.alert(
              "Booking Already Exists",
              `You already have a booking for this time. Confirmation code: ${existingBooking.confirmation_code}`,
              [
                {
                  text: "View Booking",
                  onPress: () =>
                    router.replace(`/booking/${existingBooking.id}`),
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
        } else {
          Alert.alert(
            "Booking Failed",
            error.message || "Unable to create booking. Please try again.",
            [{ text: "OK" }],
          );
        }

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

        // Send status change notification
        try {
          const { data: bookingDetails, error: fetchError } = await supabase
            .from("bookings")
            .select(`
              *,
              restaurant:restaurants(name)
            `)
            .eq("id", bookingId)
            .single();

          // Note: Status change notifications are handled by database triggers
          console.log(`Booking status changed to ${newStatus} - notification will be sent by database trigger`);
        } catch (notificationError) {
          console.warn("Failed to send status change notification:", notificationError);
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
          "status, applied_loyalty_rule_id, loyalty_points_earned, user_id, booking_time",
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

      // Send cancellation notification
      try {
        const { data: bookingDetails, error: fetchError } = await supabase
          .from("bookings")
          .select(`
            *,
            restaurant:restaurants(name)
          `)
          .eq("id", bookingId)
          .single();

        // Note: Cancellation notifications are handled by database triggers
        console.log("Booking cancelled - notification will be sent by database trigger");
      } catch (notificationError) {
        console.warn("Failed to send cancellation notification:", notificationError);
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
