// hooks/useBookingConfirmation.ts
import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { AvailabilityService } from "@/lib/AvailabilityService";
import { useUserRating } from "@/hooks/useUserRating";
import type { BookingEligibilityResult } from "@/types/database-functions";
import { notifyRestaurantWhatsAppNonBlocking } from "@/lib/whatsapp-notification";

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
  offerData?: {
    id: string;
    title: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
  };
  loyaltyRuleId?: string;
  tableIds?: string; // JSON string of table IDs array
  requiresCombination?: boolean;
  turnTime?: number;
  isGroupBooking?: boolean;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  invitedFriends?: string[]; // Array of friend user IDs
  preferredSection?: string; // Preferred seating section name
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
  const { checkBookingEligibility } = useUserRating();
  const [loading, setLoading] = useState(false);
  const [debugMode] = useState(process.env.NODE_ENV === "development");

  // Prevent double submission
  const isSubmittingRef = useRef(false);
  const submissionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
   * Main booking confirmation function
   */
  const confirmBooking = useCallback(
    async (props: BookingConfirmationProps) => {
      // Prevent double submission
      if (isSubmittingRef.current) {
        return false;
      }

      if (!profile?.id) {
        Alert.alert("Error", "Please sign in to make a booking");
        return false;
      }

      // Check rating-based booking eligibility
      let modifiedProps = props;
      try {
        const eligibility = await checkBookingEligibility(props.restaurantId);

        if (eligibility && !eligibility.can_book) {
          Alert.alert(
            "Booking Restricted",
            eligibility.restriction_reason ||
              "You cannot book at this restaurant due to your current rating.",
            [{ text: "OK" }],
          );
          return false;
        }

        // Force request-only booking if user rating requires it
        if (
          eligibility &&
          eligibility.forced_policy === "request_only" &&
          props.bookingPolicy === "instant"
        ) {
          // Show warning and convert to request booking
          Alert.alert(
            "Booking Policy Changed",
            eligibility.restriction_reason ||
              "Due to your current rating, this booking will be submitted as a request for restaurant approval.",
          );
          modifiedProps = { ...props, bookingPolicy: "request" as const };
        }
        // If forced_policy is "follows_restaurant", respect the original restaurant policy
      } catch (error) {
        console.error("Error checking booking eligibility:", error);
        // Continue with booking if eligibility check fails to avoid blocking legitimate bookings
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
        offerData,
        loyaltyRuleId,
        tableIds,
        requiresCombination,
        turnTime = 120,
        isGroupBooking = false,
        invitedFriends = [],
        preferredSection,
      } = modifiedProps;

      // --- BASIC TIER WAITLIST TIME CHECK ---
      // Check if this is a scheduled waitlist time for basic tier restaurants
      try {
        // Get restaurant info to check tier
        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("tier")
          .eq("id", restaurantId)
          .single();

        if (!restaurantError && restaurant?.tier === "basic") {
          // Check if this is a waitlist time
          const { data: isWaitlistTime, error: waitlistCheckError } =
            await supabase.rpc("is_waitlist_time", {
              restaurant_id: restaurantId,
              check_date: bookingTime.toISOString().split("T")[0],
              check_time: bookingTime.toTimeString().substring(0, 5),
            });

          if (!waitlistCheckError && isWaitlistTime) {
            // This is a scheduled waitlist time - redirect to waitlist creation
            Alert.alert(
              "Scheduled Waitlist Time",
              "This time slot is available through our waitlist system. You'll be automatically notified when a table becomes available during your selected time.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Join Waitlist",
                  onPress: async () => {
                    try {
                      // Create waitlist entry
                      const { error: waitlistError } = await supabase
                        .from("waitlist")
                        .insert({
                          user_id: profile.id,
                          restaurant_id: restaurantId,
                          desired_date: bookingTime.toISOString().split("T")[0],
                          desired_time_range: bookingTime
                            .toTimeString()
                            .substring(0, 5),
                          party_size: partySize,
                          table_type: "any",
                          status: "active",
                          special_requests: specialRequests || null,
                          is_scheduled_entry: true, // Mark as automatically created
                        });

                      if (waitlistError) {
                        throw waitlistError;
                      }

                      // Success feedback
                      await Haptics.notificationAsync(
                        Haptics.NotificationFeedbackType.Success,
                      );

                      Alert.alert(
                        "Added to Waitlist",
                        "You've been added to the waitlist! We'll notify you as soon as a table becomes available.",
                        [
                          {
                            text: "View Waitlist",
                            onPress: () => router.push("/(protected)/waitlist"),
                          },
                        ],
                      );
                    } catch (error: any) {
                      console.error("Error joining waitlist:", error);
                      Alert.alert(
                        "Error",
                        "Failed to join waitlist. Please try again.",
                      );
                    }
                  },
                },
              ],
            );

            // Stop the booking process
            setLoading(false);
            isSubmittingRef.current = false;
            if (submissionTimeoutRef.current) {
              clearTimeout(submissionTimeoutRef.current);
            }
            return false;
          }
        }
      } catch (error) {
        console.error("Error checking waitlist time:", error);
        // Continue with normal booking if waitlist check fails
      }

      // Parse table IDs
      const parsedTableIds = parseTableIds(tableIds);

      // Set submission flag with timeout protection
      isSubmittingRef.current = true;
      if (submissionTimeoutRef.current) {
        clearTimeout(submissionTimeoutRef.current);
      }
      submissionTimeoutRef.current = setTimeout(() => {
        isSubmittingRef.current = false;
      }, 5000); // Auto-reset after 5 seconds

      setLoading(true);

      try {
        if (debugMode) {
        }

        // PRE-FLIGHT CHECK: Simple availability verification
        if (parsedTableIds.length > 0) {
          const { data: bookedTables, error: conflictError } =
            await supabase.rpc("get_booked_tables_for_slot", {
              p_restaurant_id: restaurantId,
              p_start_time: bookingTime.toISOString(),
              p_end_time: new Date(
                bookingTime.getTime() + turnTime * 60000,
              ).toISOString(),
            });

          if (!conflictError && bookedTables) {
            const bookedTableIds = bookedTables.map((bt: any) => bt.table_id);
            const hasConflict = parsedTableIds.some((tableId) =>
              bookedTableIds.includes(tableId),
            );

            if (hasConflict) {
              Alert.alert(
                "Tables No Longer Available",
                "The selected tables have just been booked by someone else. Please choose different tables or time.",
                [{ text: "OK", style: "default" }],
              );
              return false;
            }
          }
        }

        // Call the RPC function with detailed error logging

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
            p_occasion: occasion && occasion !== "none" ? occasion : null,
            p_dietary_notes:
              dietaryNotes && dietaryNotes.length > 0 ? dietaryNotes : null,
            p_table_preferences:
              tablePreferences && tablePreferences.length > 0
                ? tablePreferences
                : null,
            p_is_group_booking: isGroupBooking,
            p_applied_offer_id: null, // Don't apply offer until booking is confirmed
            p_booking_policy: bookingPolicy,
            p_expected_loyalty_points: expectedLoyaltyPoints || 0,
            p_applied_loyalty_rule_id: loyaltyRuleId || null,
            p_preferred_section: preferredSection || null,
          },
        );

        if (rpcError) {
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

          // Handle specific error cases
          if (errorCode === "P0001") {
            // Time conflicts with other bookings (1 hour gap rule)
            if (
              errorMessage.includes(
                "leave at least 1 hour between reservations",
              )
            ) {
              const restaurantMatch = errorMessage.match(/booking at (.*?) at/);
              const timeMatch = errorMessage.match(/at (\d{2}:\d{2})/);
              const restaurantName = restaurantMatch
                ? restaurantMatch[1]
                : "another restaurant";
              const conflictTime = timeMatch ? timeMatch[1] : "";

              Alert.alert(
                "Booking Too Close",
                `You have another booking at ${restaurantName} at ${conflictTime}.\n\nPlease leave at least 1 hour between reservations to allow for travel and dining time.`,
                [
                  {
                    text: "View My Bookings",
                    onPress: () => router.push("/bookings"),
                  },
                  { text: "Choose Different Time", style: "cancel" },
                ],
              );
              return false;
            }

            // Table no longer available - Enhanced conflict resolution
            if (errorMessage.includes("tables are no longer available")) {
              // Clear cache immediately
              const availabilityService = AvailabilityService.getInstance();
              availabilityService.clearRestaurantCacheForDate(
                restaurantId,
                bookingTime,
              );

              // Check if there are alternative tables for the same time
              try {
                const { data: alternativeTables } = await supabase.rpc(
                  "get_available_tables",
                  {
                    p_restaurant_id: restaurantId,
                    p_start_time: bookingTime.toISOString(),
                    p_end_time: new Date(
                      bookingTime.getTime() + turnTime * 60000,
                    ).toISOString(),
                    p_party_size: partySize,
                  },
                );

                if (alternativeTables && alternativeTables.length > 0) {
                  Alert.alert(
                    "Tables Just Taken",
                    `The selected tables were just booked by another customer. However, we found ${alternativeTables.length} other table${alternativeTables.length === 1 ? "" : "s"} available for the same time.`,
                    [
                      {
                        text: "See Alternatives",
                        onPress: () => router.back(),
                      },
                      { text: "Choose Different Time", style: "cancel" },
                    ],
                  );
                } else {
                  Alert.alert(
                    "Time Slot Full",
                    "The selected tables were just booked and no other tables are available for this time. Please select a different time.",
                    [
                      {
                        text: "Choose Different Time",
                        onPress: () => router.back(),
                      },
                      { text: "OK", style: "cancel" },
                    ],
                  );
                }
              } catch (checkError) {
                console.error("Error checking alternatives:", checkError);
                Alert.alert(
                  "Tables Unavailable",
                  "The selected tables were just booked by another customer. Please select a different time or table.",
                  [
                    {
                      text: "Try Again",
                      onPress: () => router.back(),
                    },
                    { text: "OK", style: "cancel" },
                  ],
                );
              }
              return false;
            }

            // Booking window issues
            if (errorMessage.includes("beyond allowed window")) {
              const daysMatch = errorMessage.match(/(\d+) days/);
              const days = daysMatch ? daysMatch[1] : "30";
              Alert.alert(
                "Booking Too Far Ahead",
                `Bookings can only be made up to ${days} days in advance.`,
                [{ text: "OK" }],
              );
              return false;
            }

            // Timing issues
            if (errorMessage.includes("at least 15 minutes in the future")) {
              Alert.alert(
                "Invalid Booking Time",
                "Bookings must be made at least 15 minutes in advance.",
                [{ text: "OK" }],
              );
              return false;
            }

            // Restaurant issues
            if (
              errorMessage.includes("not currently accepting bookings") ||
              errorMessage.includes("Restaurant not found")
            ) {
              Alert.alert(
                "Restaurant Unavailable",
                "This restaurant is not currently accepting bookings. Please try again later.",
                [{ text: "OK", onPress: () => router.back() }],
              );
              return false;
            }

            // Generic P0001 error
            Alert.alert(
              "Booking Error",
              errorMessage ||
                "Unable to complete your booking. Please try again.",
              [{ text: "OK" }],
            );
            return false;
          }

          // Handle permission/auth errors
          if (errorCode === "42501" || errorMessage.includes("Unauthorized")) {
            Alert.alert(
              "Authentication Error",
              "Your session may have expired. Please sign in again.",
              [
                {
                  text: "Sign In",
                  onPress: () => {
                    supabase.auth.signOut();
                    router.replace("/sign-in");
                  },
                },
                { text: "Cancel", style: "cancel" },
              ],
            );
            return false;
          }

          // Handle network errors
          if (errorCode === "PGRST301" || errorMessage.includes("network")) {
            Alert.alert(
              "Connection Error",
              "Unable to connect to the server. Please check your internet connection and try again.",
              [{ text: "OK" }],
            );
            return false;
          }

          // Generic error handling
          Alert.alert(
            "Booking Failed",
            "An unexpected error occurred. Please try again.",
            [{ text: "OK" }],
          );
          return false;
        }

        // Check if we got a valid result
        if (!rpcResult?.booking) {
          throw new Error("No booking data returned from server");
        }

        const bookingResult: BookingResult = rpcResult;

        if (debugMode && bookingResult.debug_info) {
        }

        // Claim and redeem the selected offer if one was applied
        if (appliedOfferId && offerData) {
          try {
            // Check if offer is valid
            const now = new Date();
            const validUntil = new Date(offerData.valid_until);
            if (now > validUntil) {
              throw new Error("Offer has expired");
            }

            const claimDate = now.toISOString();
            // Calculate expiry date (30 days from claim or offer expiry, whichever is sooner)
            const thirtyDaysFromClaim = new Date(
              now.getTime() + 30 * 24 * 60 * 60 * 1000,
            );
            const expiryDate = new Date(
              Math.min(thirtyDaysFromClaim.getTime(), validUntil.getTime()),
            );

            // Insert user offer directly as used (claimed and redeemed in one step)
            const { data: userOfferData, error: userOfferError } =
              await supabase
                .from("user_offers")
                .insert({
                  user_id: profile.id,
                  offer_id: appliedOfferId,
                  booking_id: bookingResult.booking.id,
                  claimed_at: claimDate,
                  used_at: claimDate, // Mark as used immediately
                  expires_at: expiryDate.toISOString(),
                  status: "used",
                })
                .select()
                .single();

            if (userOfferError) {
              throw userOfferError;
            }

            // Update the booking record to include the applied offer
            await supabase
              .from("bookings")
              .update({ applied_offer_id: appliedOfferId })
              .eq("id", bookingResult.booking.id);
          } catch (offerError) {
            console.error("Failed to claim and redeem offer:", offerError);
            // Don't fail the entire booking if offer redemption fails
            // The booking is still valid, just without the discount
          }
        }

        // Send WhatsApp notification to restaurant (non-blocking)
        notifyRestaurantWhatsAppNonBlocking(bookingResult.booking.id);

        // Send friend invitations if any friends were invited
        if (invitedFriends.length > 0) {
          try {
            const invites = invitedFriends.map((friendId) => ({
              booking_id: bookingResult.booking.id,
              from_user_id: profile.id,
              to_user_id: friendId,
              message: `Join me at ${bookingResult.booking.restaurant?.name || "this restaurant"}!`,
              status: "pending",
            }));

            const { error: inviteError } = await supabase
              .from("booking_invites")
              .insert(invites);

            if (inviteError) {
              console.error("Failed to send booking invites:", inviteError);
              // Don't fail the entire booking if invites fail
            } else {
              // Update booking to mark as group booking
              await supabase
                .from("bookings")
                .update({
                  is_group_booking: true,
                  organizer_id: profile.id,
                })
                .eq("id", bookingResult.booking.id);
            }
          } catch (inviteError) {
            console.error("Error processing friend invitations:", inviteError);
            // Don't fail the entire booking if invites fail
          }
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
                bookingResult.booking.restaurant?.name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
              confirmationCode: bookingResult.booking.confirmation_code,
              loyaltyPoints: (expectedLoyaltyPoints || 0).toString(),
              tableInfo: requiresCombination ? "combined" : "single",
              earnedPoints: (
                bookingResult.booking.loyalty_points_earned ||
                expectedLoyaltyPoints ||
                0
              ).toString(),
            },
          });
        } else {
          router.replace({
            pathname: "/booking/request-sent",
            params: {
              bookingId: bookingResult.booking.id,
              restaurantName:
                bookingResult.booking.restaurant?.name || "Restaurant",
              bookingTime: bookingTime.toISOString(),
              partySize: partySize.toString(),
            },
          });
        }

        return true;
      } catch (error: any) {
        console.error("Booking confirmation error:", error);

        // Check for network errors
        if (
          error.message?.includes("NetworkError") ||
          error.message?.includes("fetch") ||
          error.code === "NetworkError"
        ) {
          Alert.alert(
            "Connection Error",
            "Unable to connect to the server. Please check your internet connection and try again.",
            [{ text: "OK" }],
          );
        } else {
          Alert.alert(
            "Booking Failed",
            "An unexpected error occurred. Please try again or contact support.",
            [{ text: "OK" }],
          );
        }

        return false;
      } finally {
        // Clean up
        isSubmittingRef.current = false;
        if (submissionTimeoutRef.current) {
          clearTimeout(submissionTimeoutRef.current);
        }
        setLoading(false);
      }
    },
    [profile, router, parseTableIds, debugMode],
  );

  /**
   * Cancel booking using the dedicated RPC function
   */
  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      const { data, error } = await supabase.rpc("cancel_booking", {
        p_booking_id: bookingId,
      });

      if (error) {
        console.error("Cancel booking error:", error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to cancel booking");
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

      let errorMessage = "Unable to cancel booking. ";

      if (error.message?.includes("less than 2 hours")) {
        errorMessage =
          "Cannot cancel bookings less than 2 hours before the reservation time.";
      } else if (error.message?.includes("not found")) {
        errorMessage = "Booking not found or already cancelled.";
      } else if (error.message?.includes("current status")) {
        errorMessage = "This booking has already been cancelled or completed.";
      } else {
        errorMessage += "Please try again or contact support.";
      }

      Alert.alert("Cancellation Failed", errorMessage);
      return false;
    }
  }, []);

  return {
    confirmBooking,
    cancelBooking,
    checkBookingEligibility,
    loading,
    isSubmitting: isSubmittingRef.current,
  };
};
