// hooks/useWaitlist.ts
// Updated hook for your mobile app

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Alert } from "react-native";
import type { Database } from "@/types/supabase";

type WaitlistRow = Database["public"]["Tables"]["waitlist"]["Row"];

interface WaitlistEntry {
  restaurantId: string;
  userId: string;
  desiredDate: string;
  desiredTimeRange: string;
  partySize: number;
  table_type: "any" | "indoor" | "outdoor" | "bar" | "private";
  special_requests?: string;
}

interface WaitlistItem extends WaitlistRow {
  restaurant?: {
    id: string;
    name: string;
    address?: string;
    main_image_url?: string;
  };
}

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

      // Get active entries
      const { data, error } = await supabase
        .from("waitlist")
        .select(
          `
          *,
          restaurant:restaurants(id, name, address, main_image_url)
        `,
        )
        .eq("user_id", user.id)
        .in("status", ["active", "notified"])
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
          })
          .select(
            `
            *,
            restaurant:restaurants(id, name, address, main_image_url)
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


  // Leave waitlist
  const leaveWaitlist = useCallback(
    async (waitlistId: string): Promise<boolean> => {
      if (!user) {
        Alert.alert("Error", "Please sign in to manage your waitlist");
        return false;
      }

      try {
        const { error } = await supabase
          .from("waitlist")
          .update({ status: "cancelled" })
          .eq("id", waitlistId)
          .eq("user_id", user.id);

        if (error) {
          console.error("Failed to leave waitlist:", error);
          Alert.alert("Error", "Failed to leave waitlist");
          return false;
        }

        Alert.alert("Success", "You've been removed from the waitlist");

        // Refresh list
        await getMyWaitlist();

        return true;
      } catch (error) {
        console.error("Error leaving waitlist:", error);
        Alert.alert("Error", "Something went wrong");
        return false;
      }
    },
    [user, getMyWaitlist],
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

  // Listen for real-time updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel(`waitlist:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waitlist",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Waitlist update:", payload);

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
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, getMyWaitlist]);

  return {
    // New API
    joinWaitlist,
    getMyWaitlist,
    leaveWaitlist,
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
