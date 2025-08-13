import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useBookingsStore } from "@/stores";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TabType = "upcoming" | "past";

export function useBookings() {
  const router = useRouter();
  const { profile, user, isGuest } = useAuth();

  // Use store instead of local state
  const {
    upcomingBookings,
    pastBookings,
    bookingsLoading,
    setUpcomingBookings,
    setPastBookings,
    setBookingsLoading,
    updateBooking,
  } = useBookingsStore();

  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const hasInitialLoad = useRef(false);
  const profileCheckAttempts = useRef(0);
  const MAX_PROFILE_CHECK_ATTEMPTS = 5;

  // Use store data for bookings
  const bookings = {
    upcoming: upcomingBookings || [],
    past: pastBookings || [],
  };

  // Check and create profile if needed for new users
  const ensureProfileExists = useCallback(async () => {
    if (!user?.id || isGuest) {
      console.log("No user or guest user, skipping profile check");
      return false;
    }

    try {
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (existingProfile) {
        console.log("Profile exists for user:", user.id);
        return true;
      }

      if (checkError && checkError.code === "PGRST116") {
        // Profile doesn't exist, create it
        console.log("Creating profile for new user:", user.id);

        const { error: createError } = await supabase.from("profiles").insert({
          id: user.id,
          full_name:
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "New User",
          email: user.email,
          created_at: new Date().toISOString(),
        });

        if (createError) {
          console.error("Error creating profile:", createError);
          throw createError;
        }

        console.log("Profile created successfully");

        // Give the database a moment to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return true;
      }

      throw checkError;
    } catch (err) {
      console.error("Error in ensureProfileExists:", err);
      profileCheckAttempts.current += 1;

      // Retry if we haven't exceeded max attempts
      if (profileCheckAttempts.current < MAX_PROFILE_CHECK_ATTEMPTS) {
        console.log(
          `Retrying profile check (attempt ${profileCheckAttempts.current})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return ensureProfileExists();
      }

      return false;
    }
  }, [user, isGuest]);

  // Data Fetching Functions
  const fetchBookings = useCallback(async () => {
    // Store user ID to prevent reference changes causing re-renders
    const userId = user?.id;

    // Don't fetch if guest or no user
    if (!userId || isGuest) {
      console.log("Skipping bookings fetch - no user or guest");
      setBookingsLoading(false);
      setRefreshing(false);
      return;
    }

    // Ensure profile exists before fetching bookings
    try {
      const profileExists = await ensureProfileExists();
      if (!profileExists) {
        console.error("Cannot fetch bookings - profile does not exist");
        setError(new Error("Profile not found. Please try logging in again."));
        setBookingsLoading(false);
        setRefreshing(false);
        return;
      }
    } catch (profileError) {
      console.error("Error checking profile:", profileError);
      setError(new Error("Unable to verify profile. Please try again."));
      setBookingsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const now = new Date().toISOString();

      // Use Promise.allSettled to handle errors gracefully and prevent crashes
      const [upcomingResult, pastResult] = await Promise.allSettled([
        supabase
          .from("bookings")
          .select(
            `
            *,
            restaurant:restaurants (*)
          `,
          )
          .eq("user_id", userId)
          .in("status", ["pending", "confirmed"])
          .gte("booking_time", now)
          .order("booking_time", { ascending: true }),

        supabase
          .from("bookings")
          .select(
            `
            *,
            restaurant:restaurants (*)
          `,
          )
          .eq("user_id", userId)
          .or(
            `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`,
          )
          .order("booking_time", { ascending: false })
          .limit(50),
      ]);

      // Handle upcoming bookings result
      let upcomingData = [];
      if (upcomingResult.status === "fulfilled") {
        if (upcomingResult.value.error) {
          console.error(
            "Error fetching upcoming bookings:",
            upcomingResult.value.error,
          );
        } else {
          upcomingData = upcomingResult.value.data || [];
        }
      } else {
        console.error(
          "Upcoming bookings request failed:",
          upcomingResult.reason,
        );
      }

      // Handle past bookings result
      let pastData = [];
      if (pastResult.status === "fulfilled") {
        if (pastResult.value.error) {
          console.error(
            "Error fetching past bookings:",
            pastResult.value.error,
          );
        } else {
          pastData = pastResult.value.data || [];
        }
      } else {
        console.error("Past bookings request failed:", pastResult.reason);
      }

      // Update store with fetched data (even if partially failed)
      setUpcomingBookings(upcomingData);
      setPastBookings(pastData);

      console.log(
        `Fetched ${upcomingData.length} upcoming and ${pastData.length} past bookings`,
      );

      // Only throw error if both requests failed
      if (
        upcomingResult.status === "rejected" &&
        pastResult.status === "rejected"
      ) {
        throw new Error("Failed to fetch both upcoming and past bookings");
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setError(error as Error);

      // Only show alert if not during initial load and not refreshing
      if (hasInitialLoad.current && !refreshing) {
        Alert.alert("Error", "Failed to load bookings. Please try again.");
      }
    } finally {
      setBookingsLoading(false);
      setRefreshing(false);
      setIsInitialized(true);
    }
  }, [
    user?.id,
    isGuest,
    ensureProfileExists,
    setUpcomingBookings,
    setPastBookings,
    setBookingsLoading,
  ]);

  // Navigation Functions with error handling
  const navigateToBookingDetails = useCallback(
    (bookingId: string) => {
      try {
        router.push({
          pathname: "/booking/[id]",
          params: { id: bookingId },
        });
      } catch (err) {
        console.error("Navigation error:", err);
      }
    },
    [router],
  );

  const navigateToRestaurant = useCallback(
    (restaurantId: string) => {
      try {
        router.push({
          pathname: "/restaurant/[id]",
          params: { id: restaurantId },
        });
      } catch (err) {
        console.error("Navigation error:", err);
      }
    },
    [router],
  );

  const navigateToSearch = useCallback(() => {
    try {
      router.push("/search");
    } catch (err) {
      console.error("Navigation error:", err);
    }
  }, [router]);

  const cancelBooking = useCallback(
    async (bookingId: string) => {
      if (!user?.id) {
        Alert.alert("Error", "Please log in to cancel bookings");
        return;
      }

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
                  .eq("id", bookingId)
                  .eq("user_id", user.id); // Extra safety check

                if (error) throw error;

                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );

                // Update store instead of refetching
                updateBooking(bookingId, {
                  status: "cancelled_by_user",
                  updated_at: new Date().toISOString(),
                });

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
    [updateBooking, user?.id],
  );

  const rebookRestaurant = useCallback(
    (booking: Booking) => {
      if (!booking?.restaurant) {
        console.error("Invalid booking data for rebooking");
        return;
      }

      try {
        router.push({
          pathname: "/booking/create",
          params: {
            restaurantId: booking.restaurant_id,
            restaurantName: booking.restaurant.name,
            partySize: booking.party_size.toString(),
            quickBook: "true",
          },
        });
      } catch (err) {
        console.error("Navigation error:", err);
      }
    },
    [router],
  );

  const reviewBooking = useCallback(
    (booking: Booking) => {
      if (!booking?.restaurant) {
        console.error("Invalid booking data for review");
        return;
      }

      try {
        router.push({
          pathname: "/review/create",
          params: {
            bookingId: booking.id,
            restaurantId: booking.restaurant_id,
            restaurantName: booking.restaurant.name,
          },
        });
      } catch (err) {
        console.error("Navigation error:", err);
      }
    },
    [router],
  );

  // Refresh Handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    profileCheckAttempts.current = 0; // Reset attempts on manual refresh
    fetchBookings();
  }, [fetchBookings]);

  // Lifecycle Management
  useEffect(() => {
    if (!hasInitialLoad.current && user && !isGuest) {
      console.log("Initial load for user:", user.id);
      setBookingsLoading(true);
      fetchBookings();
      hasInitialLoad.current = true;
    } else if (isGuest || !user) {
      // Reset state for guest users
      setUpcomingBookings([]);
      setPastBookings([]);
      setBookingsLoading(false);
      setIsInitialized(true);
      hasInitialLoad.current = false;
    }
  }, [
    user,
    isGuest,
    fetchBookings,
    setBookingsLoading,
    setUpcomingBookings,
    setPastBookings,
  ]);

  return {
    // State
    activeTab,
    setActiveTab,
    bookings,
    loading: bookingsLoading,
    refreshing,
    processingBookingId,
    error,
    isInitialized,

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
