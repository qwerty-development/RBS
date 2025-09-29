// hooks/useWaitlist.ts
// Updated hook for your mobile app

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Alert } from "react-native";
import type { Database } from "@/types/supabase";
import type { TableType } from "@/types/waitlist";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";

type WaitlistRow = Database["public"]["Tables"]["waitlist"]["Row"];

export interface WaitlistEntry {
  userId: string;
  restaurantId: string;
  desiredDate: string;
  desiredTimeRange: string;
  partySize: number;
  table_type: TableType;
  special_requests?: string;
}

interface WaitlistItem extends WaitlistRow {
  restaurant?: {
    id: string;
    name: string;
    address?: string;
    main_image_url?: string;
    tier?: "basic" | "pro";
  };
}

// Helper function to get appropriate messaging for waitlist entries
export const getWaitlistEntryMessage = (
  entry: WaitlistItem,
): {
  title: string;
  description: string;
  badgeText?: string;
} => {
  const isScheduledEntry = entry.is_scheduled_entry === true;

  if (isScheduledEntry) {
    return {
      title: "Scheduled Waitlist Time",
      description: `You were automatically added to the waitlist during a scheduled waitlist period for ${entry.restaurant?.name || "this restaurant"}. You'll be notified if a table becomes available.`,
      badgeText: "Auto-Added",
    };
  } else {
    return {
      title: "Manual Waitlist Entry",
      description: `You joined the waitlist for ${entry.restaurant?.name || "this restaurant"}. You'll be notified when a table becomes available.`,
      badgeText: "Manual",
    };
  }
};

export const useWaitlist = () => {
  const { user } = useAuth();
  const [myWaitlist, setMyWaitlist] = useState<WaitlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Get user's waitlist entries
  const getMyWaitlist = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First run automation to update expired entries
      await supabase.rpc("process_waitlist_automation");

      // Get all entries (not just active/notified for waitlist page history)
      const { data, error } = await supabase
        .from("waitlist")
        .select(
          `
          *,
          restaurant:restaurants(id, name, address, main_image_url, tier)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch waitlist:", error);
        return;
      }

      setMyWaitlist(data || []);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Join waitlist
  const joinWaitlist = useCallback(
    async (entry: WaitlistEntry): Promise<WaitlistItem | null> => {
      if (!user) {
        Alert.alert("Error", "Please sign in to join the waitlist");
        return null;
      }

      try {
        setLoading(true);

        // Check if already on waitlist for this restaurant/date
        const { data: existing } = await supabase
          .from("waitlist")
          .select("id")
          .eq("user_id", user.id)
          .eq("restaurant_id", entry.restaurantId)
          .eq("desired_date", entry.desiredDate)
          .eq("status", "active")
          .single();

        if (existing) {
          Alert.alert(
            "Already on Waitlist",
            "You're already on the waitlist for this restaurant on this date",
          );
          return null;
        }

        // Convert time range format from [HH:MM,HH:MM) to HH:MM-HH:MM
        let timeRange = entry.desiredTimeRange;
        if (
          entry.desiredTimeRange.startsWith("[") &&
          entry.desiredTimeRange.endsWith(")")
        ) {
          const rangeContent = entry.desiredTimeRange.slice(1, -1);
          const [startTime, endTime] = rangeContent.split(",");
          timeRange = `${startTime.trim()}-${endTime.trim()}`;
        }

        // Add to waitlist
        const { data, error } = await supabase
          .from("waitlist")
          .insert({
            user_id: user.id,
            restaurant_id: entry.restaurantId,
            desired_date: entry.desiredDate,
            desired_time_range: timeRange,
            party_size: entry.partySize,
            table_type: entry.table_type,
            special_requests: entry.special_requests,
            status: "active",
            is_scheduled_entry: false, // Manual entry
          })
          .select(
            `
            *,
            restaurant:restaurants(id, name, address, main_image_url, tier)
          `,
          )
          .single();

        if (error) {
          console.error("Failed to join waitlist:", error);
          Alert.alert("Error", "Failed to join waitlist. Please try again.");
          return null;
        }

        Alert.alert(
          "Added to Waitlist!",
          "We'll notify you when a table becomes available.",
        );

        // Refresh my waitlist
        await getMyWaitlist();

        return data;
      } catch (error) {
        console.error("Error joining waitlist:", error);
        Alert.alert("Error", "Something went wrong. Please try again.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, getMyWaitlist],
  );

  // Leave waitlist (cancel with confirmation)
  const leaveWaitlist = useCallback(
    async (waitlistId: string): Promise<boolean> => {
      if (!user) {
        Alert.alert("Error", "Please sign in to manage your waitlist");
        return false;
      }

      try {
        setLoading(true);

        // First check the current status of the waitlist entry
        const { data: waitlistEntry, error: fetchError } = await supabase
          .from("waitlist")
          .select("status, converted_booking_id")
          .eq("id", waitlistId)
          .eq("user_id", user.id)
          .single();

        if (fetchError) {
          console.error("Failed to fetch waitlist entry:", fetchError);
          Alert.alert("Error", "Waitlist entry not found");
          return false;
        }

        // Prevent cancellation if already converted to booking
        if (
          waitlistEntry.status === "booked" ||
          waitlistEntry.converted_booking_id
        ) {
          Alert.alert(
            "Cannot Cancel",
            "This waitlist entry has already been converted to a booking. Please manage your booking instead.",
          );
          return false;
        }

        // Allow cancellation for all other statuses (active, notified, expired, even cancelled)
        const { error } = await supabase
          .from("waitlist")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", waitlistId)
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to leave waitlist:", error);
          Alert.alert("Error", "Failed to leave waitlist");
          return false;
        }

        // Clean up any pending notifications for this waitlist entry
        try {
          await supabase.rpc("cleanup_waitlist_notifications", {
            p_waitlist_id: waitlistId,
          });
        } catch (cleanupError) {
          // Don't fail the cancellation if cleanup fails, but log it
          console.warn("Failed to cleanup notifications:", cleanupError);
        }

        Alert.alert("Success", "You've been removed from the waitlist");

        // Refresh list
        await getMyWaitlist();

        return true;
      } catch (error) {
        console.error("Error leaving waitlist:", error);
        Alert.alert("Error", "Something went wrong");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, getMyWaitlist],
  );

  // Cancel waitlist with confirmation dialog
  const cancelWaitlist = useCallback(
    async (waitlistId: string, restaurantName?: string): Promise<boolean> => {
      return new Promise((resolve) => {
        Alert.alert(
          "Cancel Waitlist Entry",
          `Are you sure you want to cancel your waitlist entry${
            restaurantName ? ` for ${restaurantName}` : ""
          }? This action cannot be undone.`,
          [
            {
              text: "Keep Waiting",
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: "Cancel Entry",
              style: "destructive",
              onPress: async () => {
                const success = await leaveWaitlist(waitlistId);
                resolve(success);
              },
            },
          ],
        );
      });
    },
    [leaveWaitlist],
  );

  // Check if user can join waitlist for a specific restaurant/date
  const canJoinWaitlist = useCallback(
    async (restaurantId: string, date: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { data } = await supabase
          .from("waitlist")
          .select("id")
          .eq("user_id", user.id)
          .eq("restaurant_id", restaurantId)
          .eq("desired_date", date)
          .in("status", ["active", "notified"])
          .single();

        return !data; // Can join if no active entry exists
      } catch {
        return true; // If error (no rows), user can join
      }
    },
    [user],
  );

  // Legacy methods for backward compatibility
  const getUserWaitlistEntries = useCallback(async () => {
    await getMyWaitlist();
    return myWaitlist;
  }, [getMyWaitlist, myWaitlist]);

  const removeFromWaitlist = useCallback(
    async (waitlistId: string): Promise<void> => {
      await leaveWaitlist(waitlistId);
    },
    [leaveWaitlist],
  );

  const updateWaitlistStatus = useCallback(
    async (
      waitlistId: string,
      status: "active" | "notified" | "booked" | "expired" | "cancelled",
    ): Promise<void> => {
      if (!user) {
        throw new Error("Authentication required to update waitlist");
      }

      const { error } = await supabase
        .from("waitlist")
        .update({ status })
        .eq("id", waitlistId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to update waitlist status:", error);
        throw new Error(error.message || "Failed to update waitlist status");
      }

      // Refresh list after status update
      await getMyWaitlist();
    },
    [user, getMyWaitlist],
  );

  // Auto-refresh waitlist
  useEffect(() => {
    if (user) {
      getMyWaitlist();

      // Refresh every 30 seconds
      const interval = setInterval(getMyWaitlist, 30000);

      return () => clearInterval(interval);
    }
  }, [user, getMyWaitlist]);

  // Listen for real-time updates using centralized service
  useEffect(() => {
    if (!user) return;

    const unsubscribe = realtimeSubscriptionService.subscribeToUser({
      userId: user.id,
      onWaitlistChange: (payload: any) => {
        // Handle different events
        if (payload.eventType === "UPDATE") {
          const newStatus = payload.new.status;
          const oldStatus = payload.old?.status;

          if (oldStatus === "active" && newStatus === "notified") {
            Alert.alert(
              "🎉 Table Available!",
              "A table is now available! You have 15 minutes to confirm.",
              [
                { text: "View Details", onPress: () => getMyWaitlist() },
                { text: "OK" },
              ],
            );
          } else if (newStatus === "expired") {
            Alert.alert(
              "Waitlist Expired",
              "Your waitlist entry has expired.",
              [{ text: "OK" }],
            );
          }
        }

        // Refresh the list
        getMyWaitlist();
      },
    });

    return unsubscribe;
  }, [user, getMyWaitlist]);

  return {
    // New API
    joinWaitlist,
    getMyWaitlist,
    leaveWaitlist,
    cancelWaitlist,
    canJoinWaitlist,
    myWaitlist,
    loading,
    isAuthenticated: !!user,

    // Legacy API for backward compatibility
    getUserWaitlistEntries,
    removeFromWaitlist,
    updateWaitlistStatus,
  };
};
