import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useBookingsStore } from "@/stores";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";
import type { Database } from "@/types/supabase";

// Enhanced booking type that includes invitation info
interface EnhancedBooking {
  id: string;
  user_id: string;
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  status: string;
  special_requests?: string;
  occasion?: string;
  dietary_notes?: string[];
  confirmation_code?: string;
  table_preferences?: string[];
  reminder_sent?: boolean;
  checked_in_at?: string;
  loyalty_points_earned?: number;
  created_at?: string;
  updated_at?: string;
  applied_offer_id?: string;
  expected_loyalty_points?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  is_group_booking?: boolean;
  organizer_id?: string;
  attendees?: number;
  turn_time_minutes: number;
  applied_loyalty_rule_id?: string;
  actual_end_time?: string;
  seated_at?: string;
  meal_progress?: any;
  request_expires_at?: string;
  auto_declined?: boolean;
  acceptance_attempted_at?: string;
  acceptance_failed_reason?: string;
  suggested_alternative_time?: string;
  suggested_alternative_tables?: string[];
  source: string;
  is_shared_booking?: boolean;
  restaurant: {
    id: string;
    name: string;
    main_image_url?: string;
    address?: string;
    [key: string]: any;
  };
  // Invitation-related fields for bookings where user was invited
  invitation_id?: string;
  invited_by?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  is_invitee?: boolean;
}

type TabType = "upcoming" | "past";

export function useBookings() {
  const router = useRouter();
  const { user, isGuest } = useAuth();

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

      // Fetch both owned bookings and accepted invitations
      const [
        upcomingResult,
        pastResult,
        invitedUpcomingResult,
        invitedPastResult,
      ] = await Promise.allSettled([
        // Owned upcoming bookings
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

        // Owned past bookings
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

        // Accepted invitations - upcoming bookings
        supabase
          .from("booking_invites")
          .select(
            `
            id,
            booking_id,
            from_user_id,
            from_user:profiles!booking_invites_from_user_id_fkey (
              id,
              full_name,
              avatar_url
            ),
            booking:bookings!inner (
              *,
              restaurant:restaurants (*)
            )
          `,
          )
          .eq("to_user_id", userId)
          .eq("status", "accepted")
          .gte("booking.booking_time", now)
          .in("booking.status", ["pending", "confirmed"])
          .order("booking.booking_time", { ascending: true }),

        // Accepted invitations - past bookings
        supabase
          .from("booking_invites")
          .select(
            `
            id,
            booking_id,
            from_user_id,
            from_user:profiles!booking_invites_from_user_id_fkey (
              id,
              full_name,
              avatar_url
            ),
            booking:bookings!inner (
              *,
              restaurant:restaurants (*)
            )
          `,
          )
          .eq("to_user_id", userId)
          .eq("status", "accepted")
          .or(
            `booking.booking_time.lt.${now},booking.status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`,
          )
          .order("booking.booking_time", { ascending: false })
          .limit(25),
      ]);

      // Process all results and combine data
      let upcomingData: EnhancedBooking[] = [];
      let pastData: EnhancedBooking[] = [];

      // Handle owned upcoming bookings
      if (
        upcomingResult.status === "fulfilled" &&
        !upcomingResult.value.error
      ) {
        const ownedUpcoming = upcomingResult.value.data || [];
        upcomingData.push(
          ...ownedUpcoming.map(
            (booking: any): EnhancedBooking => ({
              ...booking,
              invitation_id: null,
              invited_by: null,
              is_invitee: false,
            }),
          ),
        );
      } else {
        console.error(
          "Error fetching owned upcoming bookings:",
          upcomingResult.status === "fulfilled"
            ? upcomingResult.value.error
            : upcomingResult.reason,
        );
      }

      // Handle owned past bookings
      if (pastResult.status === "fulfilled" && !pastResult.value.error) {
        const ownedPast = pastResult.value.data || [];
        pastData.push(
          ...ownedPast.map(
            (booking: any): EnhancedBooking => ({
              ...booking,
              invitation_id: null,
              invited_by: null,
              is_invitee: false,
            }),
          ),
        );
      } else {
        console.error(
          "Error fetching owned past bookings:",
          pastResult.status === "fulfilled"
            ? pastResult.value.error
            : pastResult.reason,
        );
      }

      // Handle invited upcoming bookings
      if (
        invitedUpcomingResult.status === "fulfilled" &&
        !invitedUpcomingResult.value.error
      ) {
        const invitedUpcoming = invitedUpcomingResult.value.data || [];
        upcomingData.push(
          ...invitedUpcoming.map(
            (invite: any): EnhancedBooking => ({
              ...invite.booking,
              invitation_id: invite.id,
              invited_by: Array.isArray(invite.from_user)
                ? invite.from_user[0]
                : invite.from_user,
              is_invitee: true,
            }),
          ),
        );
      } else {
        console.error(
          "Error fetching invited upcoming bookings:",
          invitedUpcomingResult.status === "fulfilled"
            ? invitedUpcomingResult.value.error
            : invitedUpcomingResult.reason,
        );
      }

      // Handle invited past bookings
      if (
        invitedPastResult.status === "fulfilled" &&
        !invitedPastResult.value.error
      ) {
        const invitedPast = invitedPastResult.value.data || [];
        pastData.push(
          ...invitedPast.map(
            (invite: any): EnhancedBooking => ({
              ...invite.booking,
              invitation_id: invite.id,
              invited_by: Array.isArray(invite.from_user)
                ? invite.from_user[0]
                : invite.from_user,
              is_invitee: true,
            }),
          ),
        );
      } else {
        console.error(
          "Error fetching invited past bookings:",
          invitedPastResult.status === "fulfilled"
            ? invitedPastResult.value.error
            : invitedPastResult.reason,
        );
      }

      // Sort combined data
      upcomingData.sort(
        (a, b) =>
          new Date(a.booking_time).getTime() -
          new Date(b.booking_time).getTime(),
      );
      pastData.sort(
        (a, b) =>
          new Date(b.booking_time).getTime() -
          new Date(a.booking_time).getTime(),
      );

      // Update store with combined data
      setUpcomingBookings(upcomingData);
      setPastBookings(pastData);

      console.log(
        `Fetched ${upcomingData.length} upcoming and ${pastData.length} past bookings (including invitations)`,
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
    refreshing,
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

  const leaveBooking = useCallback(
    async (booking: EnhancedBooking) => {
      if (!user?.id) {
        Alert.alert("Error", "Please log in to leave bookings");
        return;
      }

      if (!booking.is_invitee || !booking.invitation_id) {
        Alert.alert("Error", "You can only leave bookings you were invited to");
        return;
      }

      Alert.alert(
        "Leave Booking",
        `Are you sure you want to leave this booking at ${booking.restaurant?.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, Leave",
            style: "destructive",
            onPress: async () => {
              setProcessingBookingId(booking.id);

              try {
                // Update invitation status to declined
                const { error: inviteError } = await supabase
                  .from("booking_invites")
                  .update({
                    status: "declined",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", booking.invitation_id)
                  .eq("to_user_id", user.id);

                if (inviteError) throw inviteError;

                // Decrease party size by 1
                const { error: bookingError } = await supabase
                  .from("bookings")
                  .update({
                    party_size: booking.party_size - 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", booking.id);

                if (bookingError) throw bookingError;

                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );

                Alert.alert(
                  "Success",
                  "You have left the booking successfully",
                );

                // Refresh bookings to reflect changes
                await fetchBookings();
              } catch (err) {
                console.error("Error leaving booking:", err);
                Alert.alert(
                  "Error",
                  "Failed to leave booking. Please try again.",
                );
              } finally {
                setProcessingBookingId(null);
              }
            },
          },
        ],
      );
    },
    [user?.id, fetchBookings],
  );

  const rebookRestaurant = useCallback(
    (booking: EnhancedBooking) => {
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
    (booking: EnhancedBooking) => {
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

  // Real-time subscriptions for bookings
  useEffect(() => {
    if (!user?.id || isGuest) {
      return;
    }

    console.log("Setting up real-time subscriptions for user:", user.id);

    const unsubscribe = realtimeSubscriptionService.subscribeToUser({
      userId: user.id,
      onBookingChange: (payload) => {
        console.log("Real-time booking change:", payload.eventType, payload.new);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          // New booking created - refresh data to get complete booking with restaurant info
          handleRefresh();
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          // Booking updated - update in store
          updateBooking(payload.new.id, payload.new);
          
          // If status changed significantly, refresh to ensure data consistency
          if (payload.old?.status !== payload.new.status) {
            handleRefresh();
          }
        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Booking deleted - refresh to remove from lists
          handleRefresh();
        }
      },
      onBookingInviteChange: (payload) => {
        console.log("Real-time booking invite change:", payload.eventType, payload.new);
        
        // Booking invitations affect bookings list, refresh to get updated data
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          handleRefresh();
        }
      }
    });

    return () => {
      console.log("Cleaning up booking real-time subscriptions for user:", user.id);
      unsubscribe();
    };
  }, [user?.id, isGuest, handleRefresh, updateBooking]);

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
    leaveBooking,
    rebookRestaurant,
    reviewBooking,
  };
}
