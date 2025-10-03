import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useBookingsStore } from "@/stores";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";
import type { Database } from "@/types/supabase";
import type { WaitingStatus, TableType } from "@/types/waitlist";

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
  decline_note?: string;
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

// Enhanced waitlist entry type for consistent display
interface EnhancedWaitlistEntry {
  id: string;
  user_id: string | null;
  restaurant_id: string;
  desired_date: string;
  desired_time_range: string;
  party_size: number;
  table_type: TableType;
  status: WaitingStatus;
  special_requests?: string | null;
  is_scheduled_entry?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
  notification_expires_at?: string | null;
  notified_at?: string | null;
  converted_booking_id?: string | null;
  guest_email?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  restaurant?: {
    id: string;
    name: string;
    main_image_url?: string;
    address?: string;
    tier?: "basic" | "pro";
    [key: string]: any;
  };
  // Mark as waitlist entry for UI differentiation
  isWaitlistEntry: true;
}

// Union type for items that can appear in bookings list
type BookingOrWaitlistItem = EnhancedBooking | EnhancedWaitlistEntry;

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

  // Pagination for past bookings
  const [pastBookingsPage, setPastBookingsPage] = useState(1);
  const [hasMorePastBookings, setHasMorePastBookings] = useState(true);
  const [loadingMorePastBookings, setLoadingMorePastBookings] = useState(false);
  const ITEMS_PER_PAGE = 10;

  const hasInitialLoad = useRef(false);
  const profileCheckAttempts = useRef(0);
  const MAX_PROFILE_CHECK_ATTEMPTS = 5;

  // Use store data for bookings
  const bookings = {
    upcoming: (upcomingBookings || []) as BookingOrWaitlistItem[],
    past: (pastBookings || []) as BookingOrWaitlistItem[],
  };

  // Check and create profile if needed for new users
  const ensureProfileExists = useCallback(async () => {
    if (!user?.id || isGuest) {
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
        return true;
      }

      if (checkError && checkError.code === "PGRST116") {
        // Profile doesn't exist, create it

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

      // Debug: Let's see ALL pending bookings first
      const { data: allPendingBookings, error: allPendingError } =
        await supabase
          .from("bookings")
          .select("id, booking_time, status")
          .eq("user_id", userId)
          .eq("status", "pending");

      if (allPendingBookings && allPendingBookings.length > 0) {
      } else {
      }

      const { data: expiredPendingBookings, error: expiredError } =
        await supabase
          .from("bookings")
          .select("id, booking_time, status")
          .eq("user_id", userId)
          .eq("status", "pending")
          .lt("booking_time", now);

      if (expiredError) {
        console.error("Error fetching expired pending bookings:", expiredError);
      } else if (expiredPendingBookings && expiredPendingBookings.length > 0) {
        // Update all expired pending bookings
        const updatePromises = expiredPendingBookings.map(async (booking) => {
          try {
            const { error: updateError } = await supabase
              .from("bookings")
              .update({
                status: "declined_by_restaurant",
                updated_at: new Date().toISOString(),
              })
              .eq("id", booking.id);

            if (updateError) {
              console.error(
                `Error updating booking ${booking.id}:`,
                updateError,
              );
            } else {
            }
          } catch (error) {
            console.error(
              `Error updating expired booking ${booking.id}:`,
              error,
            );
          }
        });

        await Promise.allSettled(updatePromises);
      } else {
      }

      // Debug: Let's first check if there are any accepted invitations at all

      const { data: debugAcceptedInvites, error: debugError } = await supabase
        .from("booking_invites")
        .select("id, booking_id, status, to_user_id, responded_at")
        .eq("to_user_id", userId)
        .eq("status", "accepted");

      // Debug: Check what bookings exist for these invitation booking_ids
      if (debugAcceptedInvites && debugAcceptedInvites.length > 0) {
        const bookingIds = debugAcceptedInvites.map((inv) => inv.booking_id);

        const { data: debugBookings, error: debugBookingsError } =
          await supabase
            .from("bookings")
            .select("id, booking_time, status, user_id, restaurant_id")
            .in("id", bookingIds);

        // Check which bookings meet the upcoming criteria
        if (debugBookings) {
          const upcomingBookings = debugBookings.filter(
            (booking) =>
              new Date(booking.booking_time) >= new Date(now) &&
              ["pending", "confirmed"].includes(booking.status),
          );
        }
      }

      // Helper function to get accepted invitation bookings
      const getAcceptedInvitationBookings = async (
        timeFilter: "upcoming" | "past",
      ) => {
        // First get accepted invitations
        const { data: acceptedInvites, error: inviteError } = await supabase
          .from("booking_invites")
          .select(
            `
            id,
            booking_id,
            from_user_id,
            status,
            created_at,
            responded_at,
            from_user:profiles!booking_invites_from_user_id_fkey (
              id,
              full_name,
              avatar_url
            )
          `,
          )
          .eq("to_user_id", userId)
          .eq("status", "accepted");

        if (inviteError) {
          console.error(
            `🎯 DEBUG: Error getting accepted invitations (${timeFilter}):`,
            inviteError,
          );
          return { data: [], error: inviteError };
        }

        if (!acceptedInvites || acceptedInvites.length === 0) {
          return { data: [], error: null };
        }

        // Then get the booking details for those invitations
        const bookingIds = acceptedInvites.map((inv) => inv.booking_id);
        let bookingQuery = supabase
          .from("bookings")
          .select(
            `
            *,
            restaurant:restaurants (*)
          `,
          )
          .in("id", bookingIds);

        if (timeFilter === "upcoming") {
          bookingQuery = bookingQuery
            .gte("booking_time", now)
            .in("status", ["pending", "confirmed"])
            .order("booking_time", { ascending: true });
        } else {
          bookingQuery = bookingQuery
            .or(
              `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,cancelled_by_restaurant,auto_declined,no_show)`,
            )
            .order("booking_time", { ascending: false })
            .limit(25);
        }

        const { data: bookings, error: bookingError } = await bookingQuery;

        if (bookingError) {
          console.error(
            `🎯 DEBUG: Error getting booking details (${timeFilter}):`,
            bookingError,
          );
          return { data: [], error: bookingError };
        }

        // Combine invitation and booking data
        const combinedData =
          bookings?.map((booking) => {
            const invitation = acceptedInvites.find(
              (inv) => inv.booking_id === booking.id,
            );
            return {
              ...invitation,
              booking: booking,
            };
          }) || [];

        return { data: combinedData, error: null };
      };

      // Helper function to fetch user's waitlist entries
      const fetchWaitlistEntries = async (): Promise<{
        upcoming: EnhancedWaitlistEntry[];
        past: EnhancedWaitlistEntry[];
      }> => {
        try {
          // First run automation to update expired entries
          await supabase.rpc("process_waitlist_automation");

          const { data: waitlistData, error: waitlistError } = await supabase
            .from("waitlist")
            .select(
              `
              *,
              restaurant:restaurants(id, name, address, main_image_url, tier)
            `,
            )
            .eq("user_id", userId);

          if (waitlistError) {
            console.error("Error fetching waitlist:", waitlistError);
            return { upcoming: [], past: [] };
          }

          const allWaitlist = waitlistData || [];
          const now = new Date();
          const todayDateString = now.toISOString().split("T")[0];

          // Categorize waitlist entries
          const upcomingWaitlist: EnhancedWaitlistEntry[] = [];
          const pastWaitlist: EnhancedWaitlistEntry[] = [];

          allWaitlist.forEach((entry) => {
            const enhancedEntry: EnhancedWaitlistEntry = {
              ...entry,
              restaurant: Array.isArray(entry.restaurant)
                ? entry.restaurant[0]
                : entry.restaurant,
              isWaitlistEntry: true,
            };

            // Determine if upcoming or past based on status and date
            const isPastStatus = ["expired", "cancelled", "booked"].includes(
              entry.status,
            );
            const isPastDate = entry.desired_date < todayDateString;

            if (isPastStatus || isPastDate) {
              pastWaitlist.push(enhancedEntry);
            } else {
              // active, notified status entries that haven't passed the date yet
              upcomingWaitlist.push(enhancedEntry);
            }
          });

          return {
            upcoming: upcomingWaitlist,
            past: pastWaitlist,
          };
        } catch (error) {
          console.error("Error fetching waitlist data:", error);
          return { upcoming: [], past: [] };
        }
      };

      // Fetch both owned bookings, accepted invitations, and waitlist entries
      const [
        upcomingResult,
        pastResult,
        invitedUpcomingResult,
        invitedPastResult,
        waitlistResult,
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

        // Owned past bookings with pagination
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
            `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,cancelled_by_restaurant,auto_declined,no_show)`,
          )
          .order("booking_time", { ascending: false })
          .range(0, ITEMS_PER_PAGE - 1), // For initial load, get first page

        // Accepted invitations - upcoming bookings
        getAcceptedInvitationBookings("upcoming"),

        // Accepted invitations - past bookings
        getAcceptedInvitationBookings("past"),

        // User's waitlist entries
        fetchWaitlistEntries(),
      ]);

      // Process all results and combine data
      let upcomingData: BookingOrWaitlistItem[] = [];
      let pastData: BookingOrWaitlistItem[] = [];

      // Helper function to update expired pending bookings to declined_by_restaurant
      const updateExpiredPendingBookings = async (bookings: any[]) => {
        const now = new Date();

        // Debug: Log all bookings and their status/time

        bookings.forEach((booking, index) => {
          const bookingTime = new Date(booking.booking_time);
          const isExpired = bookingTime < now;
        });

        const expiredPendingBookings = bookings.filter((booking) => {
          const bookingTime = new Date(booking.booking_time);
          const isExpired = bookingTime < now;
          const isPending = booking.status === "pending";

          return isPending && isExpired;
        });

        if (expiredPendingBookings.length > 0) {
          // Update each expired pending booking
          const updatePromises = expiredPendingBookings.map(async (booking) => {
            try {
              const { error } = await supabase
                .from("bookings")
                .update({
                  status: "declined_by_restaurant",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", booking.id);

              if (error) {
                console.error(`Error updating booking ${booking.id}:`, error);
              } else {
                // Update the local booking object
                booking.status = "declined_by_restaurant";
                booking.updated_at = new Date().toISOString();
              }
            } catch (error) {
              console.error(
                `Error updating expired booking ${booking.id}:`,
                error,
              );
            }
          });

          // Wait for all updates to complete
          await Promise.allSettled(updatePromises);
        } else {
        }
      };

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

        const mappedInvitations = invitedUpcoming
          .filter((invite: any) => invite.booking) // Filter out invitations without bookings
          .map(
            (invite: any): EnhancedBooking => ({
              ...invite.booking,
              invitation_id: invite.id,
              invited_by: Array.isArray(invite.from_user)
                ? invite.from_user[0]
                : invite.from_user,
              is_invitee: true,
            }),
          );

        upcomingData.push(...mappedInvitations);
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

        const mappedPastInvitations = invitedPast
          .filter((invite: any) => invite.booking) // Filter out invitations without bookings
          .map(
            (invite: any): EnhancedBooking => ({
              ...invite.booking,
              invitation_id: invite.id,
              invited_by: Array.isArray(invite.from_user)
                ? invite.from_user[0]
                : invite.from_user,
              is_invitee: true,
            }),
          );

        pastData.push(...mappedPastInvitations);
      } else {
        console.error(
          "Error fetching invited past bookings:",
          invitedPastResult.status === "fulfilled"
            ? invitedPastResult.value.error
            : invitedPastResult.reason,
        );
      }

      // Handle waitlist data
      if (waitlistResult.status === "fulfilled") {
        const waitlistData = waitlistResult.value;
        upcomingData.push(...waitlistData.upcoming);
        pastData.push(...waitlistData.past);
      } else {
        console.error("Error fetching waitlist data:", waitlistResult.reason);
      }

      // Sort combined data
      // Update expired pending bookings before sorting (check only booking items)
      const bookingItems = upcomingData.filter(
        (item): item is EnhancedBooking => !("isWaitlistEntry" in item),
      );
      const pastBookingItems = pastData.filter(
        (item): item is EnhancedBooking => !("isWaitlistEntry" in item),
      );
      await updateExpiredPendingBookings(bookingItems);
      await updateExpiredPendingBookings(pastBookingItems);

      // Helper function to get sortable date from booking or waitlist item
      const getSortableDate = (item: BookingOrWaitlistItem): Date => {
        if ("isWaitlistEntry" in item) {
          // For waitlist entries, combine desired_date and desired_time_range
          const timeRange = item.desired_time_range;
          const startTime = timeRange.includes("-")
            ? timeRange.split("-")[0].trim()
            : timeRange.split(",")[0]?.replace("[", "").trim() || "00:00";
          return new Date(`${item.desired_date}T${startTime}`);
        } else {
          // For bookings, use booking_time
          return new Date(item.booking_time);
        }
      };

      upcomingData.sort(
        (a, b) => getSortableDate(a).getTime() - getSortableDate(b).getTime(),
      );
      pastData.sort(
        (a, b) => getSortableDate(b).getTime() - getSortableDate(a).getTime(),
      );

      // Update store with combined data

      setUpcomingBookings(upcomingData);
      setPastBookings(pastData);

      // Debug: log declined bookings specifically
      const declinedBookings = pastData.filter(
        (b) =>
          b.status === "declined_by_restaurant" ||
          b.status === "cancelled_by_restaurant",
      );
      if (declinedBookings.length > 0) {
      }

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
        // Calculate a future date/time based on the original booking
        const originalDate = new Date(booking.booking_time);
        const now = new Date();

        // If the original booking time is in the past, schedule for the same time next week
        // If it's in the future, use the original time
        let suggestedDate = originalDate;
        if (originalDate < now) {
          suggestedDate = new Date(originalDate);
          suggestedDate.setDate(suggestedDate.getDate() + 7); // Same time next week
        }

        router.push({
          pathname: "/booking/availability",
          params: {
            restaurantId: booking.restaurant_id,
            restaurantName: booking.restaurant.name,
            partySize: booking.party_size.toString(),
            suggestedDate: suggestedDate.toISOString(),
            originalDate: originalDate.toISOString(),
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

  // Waitlist management functions
  const leaveWaitlist = useCallback(
    async (waitlistId: string, restaurantName?: string): Promise<boolean> => {
      if (!user?.id) {
        Alert.alert("Error", "Please log in to manage your waitlist");
        return false;
      }

      return new Promise((resolve) => {
        Alert.alert(
          "Leave Waitlist?",
          `Are you sure you want to leave the waitlist${
            restaurantName ? ` for ${restaurantName}` : ""
          }?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            {
              text: "Leave",
              style: "destructive",
              onPress: async () => {
                setProcessingBookingId(waitlistId);

                try {
                  const { error } = await supabase
                    .from("waitlist")
                    .update({ status: "cancelled" })
                    .eq("id", waitlistId)
                    .eq("user_id", user.id);

                  if (error) throw error;

                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );

                  Alert.alert(
                    "Success",
                    "You've been removed from the waitlist",
                  );

                  // Refresh bookings to reflect changes
                  handleRefresh();

                  resolve(true);
                } catch (error) {
                  console.error("Error leaving waitlist:", error);
                  Alert.alert("Error", "Failed to leave waitlist");
                  resolve(false);
                } finally {
                  setProcessingBookingId(null);
                }
              },
            },
          ],
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );

  const navigateToWaitlistBooking = useCallback(
    (waitlistEntry: EnhancedWaitlistEntry) => {
      if (waitlistEntry.status !== "notified") {
        return;
      }

      try {
        router.push({
          pathname: "/(protected)/booking/availability",
          params: {
            restaurantId: waitlistEntry.restaurant_id,
            date: waitlistEntry.desired_date,
            time: waitlistEntry.desired_time_range.split("-")[0],
            partySize: waitlistEntry.party_size.toString(),
            fromWaitlist: "true",
            waitlistId: waitlistEntry.id,
          },
        });
      } catch (err) {
        console.error("Navigation error:", err);
      }
    },
    [router],
  );

  // Load more past bookings function
  const loadMorePastBookings = useCallback(async () => {
    // Don't load more if we're already loading or there are no more bookings
    if (loadingMorePastBookings || !hasMorePastBookings || !user?.id || isGuest)
      return;

    setLoadingMorePastBookings(true);

    try {
      const nextPage = pastBookingsPage + 1;
      const startIndex = pastBookingsPage * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE - 1;

      const now = new Date().toISOString();

      // Fetch the next page of past bookings
      const { data: ownedPast, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", user.id)
        .or(
          `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,cancelled_by_restaurant,auto_declined,no_show)`,
        )
        .order("booking_time", { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;

      if (ownedPast && ownedPast.length > 0) {
        // Format the additional bookings
        const formattedBookings = ownedPast.map(
          (booking: any): EnhancedBooking => ({
            ...booking,
            invitation_id: null,
            invited_by: null,
            is_invitee: false,
          }),
        );

        // Append to existing past bookings
        setPastBookings([...pastBookings, ...formattedBookings]);
        setPastBookingsPage(nextPage);

        // Check if we have more bookings to load
        setHasMorePastBookings(formattedBookings.length === ITEMS_PER_PAGE);
      } else {
        setHasMorePastBookings(false);
      }
    } catch (error) {
      console.error("Error loading more past bookings:", error);
    } finally {
      setLoadingMorePastBookings(false);
    }
  }, [
    pastBookingsPage,
    loadingMorePastBookings,
    hasMorePastBookings,
    user,
    isGuest,
    pastBookings,
    setPastBookings,
    ITEMS_PER_PAGE,
  ]);

  // Refresh Handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    profileCheckAttempts.current = 0; // Reset attempts on manual refresh
    // Reset pagination when refreshing
    setPastBookingsPage(1);
    setHasMorePastBookings(true);
    fetchBookings();
  }, [fetchBookings]);

  // Lifecycle Management
  useEffect(() => {
    if (!hasInitialLoad.current && user && !isGuest) {
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

    const unsubscribe = realtimeSubscriptionService.subscribeToUser({
      userId: user.id,
      onBookingChange: (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          // New booking created - refresh data to get complete booking with restaurant info
          handleRefresh();
        } else if (payload.eventType === "UPDATE" && payload.new) {
          // Booking updated - update in store
          updateBooking(payload.new.id, payload.new);

          // If status changed significantly, refresh to ensure data consistency
          if (payload.old?.status !== payload.new.status) {
            handleRefresh();
          }
        } else if (payload.eventType === "DELETE" && payload.old) {
          // Booking deleted - refresh to remove from lists
          handleRefresh();
        }
      },
      onBookingInviteChange: (payload) => {
        // Booking invitations affect bookings list, refresh to get updated data
        if (
          payload.eventType === "INSERT" ||
          payload.eventType === "UPDATE" ||
          payload.eventType === "DELETE"
        ) {
          handleRefresh();
        }
      },
      onWaitlistChange: (payload) => {
        // Waitlist changes affect the bookings list, refresh to get updated data
        if (
          payload.eventType === "INSERT" ||
          payload.eventType === "UPDATE" ||
          payload.eventType === "DELETE"
        ) {
          // Handle specific status changes with user notifications
          if (payload.eventType === "UPDATE" && payload.new && payload.old) {
            const newStatus = payload.new.status;
            const oldStatus = payload.old?.status;

            if (oldStatus === "active" && newStatus === "notified") {
              // Don't show alert here as it's already handled by useWaitlist hook
              // Just refresh the data
            } else if (newStatus === "expired") {
              // Don't show alert here as it's already handled by useWaitlist hook
              // Just refresh the data
            }
          }

          handleRefresh();
        }
      },
    });

    return () => {
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

    // Waitlist management
    leaveWaitlist,
    navigateToWaitlistBooking,

    // Pagination for past bookings
    loadingMorePastBookings,
    hasMorePastBookings,
    loadMorePastBookings,
  };
}

// Export types for use in components
export type { EnhancedBooking, EnhancedWaitlistEntry, BookingOrWaitlistItem };
