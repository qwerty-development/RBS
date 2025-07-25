// hooks/useBookingDetails.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TableInfo = {
  id: string;
  table_number: string;
  table_type: string;
  capacity: number;
};

type AppliedOfferDetails = {
  special_offer_id: string;
  special_offer_title: string;
  special_offer_description: string;
  discount_percentage: number;
  user_offer_id: string;
  redemption_code: string;
  used_at: string;
  claimed_at: string;
  estimated_savings: number;
  terms_conditions?: string[];
  valid_until: string;
  minimum_party_size?: number;
};

type LoyaltyActivity = {
  id: string;
  points_earned: number;
  activity_type: string;
  description: string;
  created_at: string;
  points_multiplier: number;
};

export const useBookingDetails = (bookingId: string) => {
  const { profile } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [loyaltyActivity, setLoyaltyActivity] =
    useState<LoyaltyActivity | null>(null);
  const [appliedOfferDetails, setAppliedOfferDetails] =
    useState<AppliedOfferDetails | null>(null);
  const [assignedTables, setAssignedTables] = useState<TableInfo[]>([]);

  // Enhanced fetch booking details with table information
  const fetchBookingDetails = useCallback(async () => {
    if (!bookingId) return;

    try {
      // Fetch booking with enhanced data
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("id", bookingId)
        .single();

      if (bookingError) throw bookingError;

      if (!bookingData) {
        throw new Error("Booking not found");
      }

      setBooking(bookingData);

      // NEW: Fetch assigned tables
      const { data: tablesData, error: tablesError } = await supabase
      .from("booking_tables")
      .select(`
        table_id,
        created_at,
        table:restaurant_tables (
          id,
          table_number,
          table_type,
          capacity
        )
      `)
      .eq("booking_id", bookingId);

      if (!tablesError && tablesData && tablesData.length > 0) {
        const tables = tablesData
          .map((bt) => bt.table)
          .filter((t): t is TableInfo => t !== null);
        setAssignedTables(tables);
      } else {
        console.log('No tables found for booking:', bookingId);
        setAssignedTables([]);
      }

      // Check if review exists for completed bookings
      if (bookingData.status === "completed") {
        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", bookingId)
          .single();

        setHasReview(!!reviewData);
      }

      // Fetch loyalty activity for this booking
      if (profile?.id) {
        try {
          const { data: loyaltyData } = await supabase
            .from("loyalty_activities")
            .select("*")
            .eq("user_id", profile.id)
            .eq("related_booking_id", bookingId)
            .eq("activity_type", "booking_completed")
            .single();

          if (loyaltyData) {
            setLoyaltyActivity(loyaltyData);
          }
        } catch (loyaltyError) {
          console.log(
            "Loyalty activities table not available or no data found"
          );
        }
      }

      // Enhanced: Fetch applied offer details using applied_offer_id
      if (bookingData.applied_offer_id) {
        console.log(
          "Fetching applied offer details for offer ID:",
          bookingData.applied_offer_id
        );

        try {
          // Get the special offer details
          const { data: specialOfferData, error: specialOfferError } =
            await supabase
              .from("special_offers")
              .select("*")
              .eq("id", bookingData.applied_offer_id)
              .single();

          if (specialOfferError) {
            console.error("Error fetching special offer:", specialOfferError);
          } else if (specialOfferData) {
            console.log("Found special offer:", specialOfferData.title);

            // Get the user_offer details for redemption code and usage info
            const { data: userOfferData, error: userOfferError } =
              await supabase
                .from("user_offers")
                .select("*")
                .eq("booking_id", bookingId)
                .eq("user_id", profile?.id)
                .single();

            if (userOfferError) {
              console.error("Error fetching user offer:", userOfferError);
            }

            // Calculate estimated savings based on party size and price range
            const estimatedSavings = Math.round(
              bookingData.party_size *
                ((bookingData.restaurant.price_range || 2) * 30) *
                (specialOfferData.discount_percentage / 100)
            );

            const offerDetails: AppliedOfferDetails = {
              special_offer_id: specialOfferData.id,
              special_offer_title: specialOfferData.title,
              special_offer_description: specialOfferData.description,
              discount_percentage: specialOfferData.discount_percentage,
              user_offer_id: userOfferData?.id || "",
              redemption_code: userOfferData?.id || specialOfferData.id,
              used_at:
                userOfferData?.used_at ||
                userOfferData?.claimed_at ||
                bookingData.created_at,
              claimed_at: userOfferData?.claimed_at || bookingData.created_at,
              estimated_savings: estimatedSavings,
              terms_conditions: specialOfferData.terms_conditions,
              valid_until: specialOfferData.valid_until,
              minimum_party_size: specialOfferData.minimum_party_size,
            };

            console.log("Applied offer details:", offerDetails);
            setAppliedOfferDetails(offerDetails);
          }
        } catch (offerError) {
          console.error("Error fetching applied offer details:", offerError);
        }
      } else {
        console.log("No applied offer for this booking");
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      Alert.alert("Error", "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  }, [bookingId, profile?.id]);

  // Enhanced cancel booking with loyalty points handling
  const cancelBooking = useCallback(async () => {
    if (!booking) return;

    Alert.alert(
      "Cancel Booking",
      appliedOfferDetails
        ? "Are you sure you want to cancel this booking? Your applied offer will be restored to your account."
        : "Are you sure you want to cancel this booking? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setProcessing(true);

            try {
              const { error } = await supabase
                .from("bookings")
                .update({
                  status: "cancelled_by_user",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", booking.id);

              if (error) throw error;

              // If there was an applied offer, restore it
              if (appliedOfferDetails?.user_offer_id) {
                try {
                  await supabase
                    .from("user_offers")
                    .update({
                      used_at: null,
                      booking_id: null,
                    })
                    .eq("id", appliedOfferDetails.user_offer_id);

                  console.log("Offer restored to user account");
                } catch (restoreError) {
                  console.error("Error restoring offer:", restoreError);
                }
              }

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );

              // Refresh booking data
              await fetchBookingDetails();

              Alert.alert(
                "Success",
                appliedOfferDetails
                  ? "Your booking has been cancelled and your offer has been restored."
                  : "Your booking has been cancelled"
              );
            } catch (error) {
              console.error("Error cancelling booking:", error);
              Alert.alert("Error", "Failed to cancel booking");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }, [booking, fetchBookingDetails, appliedOfferDetails]);

  // Copy offer redemption code
  const copyOfferCode = useCallback(async () => {
    if (!appliedOfferDetails?.redemption_code) return;

    await Clipboard.setStringAsync(appliedOfferDetails.redemption_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Copied!", "Offer redemption code copied to clipboard");
  }, [appliedOfferDetails]);

  // Helper functions
  const isUpcoming = useCallback(() => {
    if (!booking) return false;
    return (
      new Date(booking.booking_time) > new Date() &&
      (booking.status === "pending" || booking.status === "confirmed")
    );
  }, [booking]);

  const isToday = useCallback(() => {
    if (!booking) return false;
    return (
      new Date(booking.booking_time).toDateString() ===
      new Date().toDateString()
    );
  }, [booking]);

  const isTomorrow = useCallback(() => {
    if (!booking) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      new Date(booking.booking_time).toDateString() === tomorrow.toDateString()
    );
  }, [booking]);

  // Lifecycle
  useEffect(() => {
    fetchBookingDetails();
  }, [fetchBookingDetails]);

  return {
    booking,
    loading,
    processing,
    hasReview,
    loyaltyActivity,
    appliedOfferDetails,
    assignedTables,
    isUpcoming: isUpcoming(),
    isToday: isToday(),
    isTomorrow: isTomorrow(),
    cancelBooking,
    copyOfferCode,
    refresh: fetchBookingDetails,
  };
};