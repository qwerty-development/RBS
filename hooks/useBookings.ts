import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TabType = "upcoming" | "past";

export function useBookings() {
  const router = useRouter();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [bookings, setBookings] = useState<{
    upcoming: Booking[];
    past: Booking[];
  }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(
    null,
  );

  const hasInitialLoad = useRef(false);

  // Data Fetching Functions
  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const now = new Date().toISOString();

      // Fetch upcoming bookings (pending, confirmed)
      const { data: upcomingData, error: upcomingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", profile.id)
        .in("status", ["pending", "confirmed"])
        .gte("booking_time", now)
        .order("booking_time", { ascending: true });

      if (upcomingError) throw upcomingError;

      // Fetch past bookings (all statuses, past dates or completed/cancelled)
      const { data: pastData, error: pastError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", profile.id)
        .or(
          `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`,
        )
        .order("booking_time", { ascending: false })
        .limit(50);

      if (pastError) throw pastError;

      setBookings({
        upcoming: upcomingData || [],
        past: pastData || [],
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to load bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Navigation Functions
  const navigateToBookingDetails = useCallback(
    (bookingId: string) => {
      router.push({
        pathname: "/booking/[id]",
        params: { id: bookingId },
      });
    },
    [router],
  );

  const navigateToRestaurant = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    },
    [router],
  );

  const navigateToSearch = useCallback(() => {
    router.push("/search");
  }, [router]);

  // Quick Actions
  const cancelBooking = useCallback(
    async (bookingId: string) => {
      Alert.alert(
        "Cancel Booking",
        "Are you sure you want to cancel this booking?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              setProcessingBookingId(bookingId);

              try {
                const { error } = await supabase
                  .from("bookings")
                  .update({
                    status: "cancelled_by_user",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", bookingId);

                if (error) throw error;

                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );

                fetchBookings();
                Alert.alert("Success", "Your booking has been cancelled");
              } catch (error) {
                console.error("Error cancelling booking:", error);
                Alert.alert("Error", "Failed to cancel booking");
              } finally {
                setProcessingBookingId(null);
              }
            },
          },
        ],
      );
    },
    [fetchBookings],
  );

  const rebookRestaurant = useCallback(
    (booking: Booking) => {
      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: booking.restaurant_id,
          restaurantName: booking.restaurant.name,
          partySize: booking.party_size.toString(),
          quickBook: "true",
        },
      });
    },
    [router],
  );

  const reviewBooking = useCallback(
    (booking: Booking) => {
      router.push({
        pathname: "/review/create",
        params: {
          bookingId: booking.id,
          restaurantId: booking.restaurant_id,
          restaurantName: booking.restaurant.name,
        },
      });
    },
    [router],
  );

  // Refresh Handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  // Lifecycle Management
  useEffect(() => {
    if (!hasInitialLoad.current && profile) {
      fetchBookings();
      hasInitialLoad.current = true;
    }
  }, [profile, fetchBookings]);

  return {
    // State
    activeTab,
    setActiveTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,

    // Actions
    fetchBookings,
    handleRefresh,
    navigateToBookingDetails,
    navigateToRestaurant,
    navigateToSearch,
    cancelBooking,
    rebookRestaurant,
    reviewBooking,
  };
}