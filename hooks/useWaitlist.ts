import { useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { WaitlistEntry } from "@/components/booking/WaitlistConfirmationModal";
import { NotificationHelpers } from "@/lib/NotificationHelpers";
import type { Database } from "@/types/supabase";

type WaitlistRow = Database["public"]["Tables"]["waitlist"]["Row"];
type WaitlistInsert = Database["public"]["Tables"]["waitlist"]["Insert"];

export const useWaitlist = () => {
  const { user } = useAuth();

  const joinWaitlist = useCallback(
    async (entry: WaitlistEntry): Promise<WaitlistRow> => {
      if (!user) {
        throw new Error("Authentication required to join waitlist");
      }

      // Parse the desired date to ensure it's a valid date
      const desiredDate = new Date(entry.desiredDate)
        .toISOString()
        .split("T")[0];

      // Parse the time range and create a PostgreSQL tstzrange
      // Expected format: [HH:MM,HH:MM) or HH:MM-HH:MM
      let timeRange: string;

      if (
        entry.desiredTimeRange.startsWith("[") &&
        entry.desiredTimeRange.endsWith(")")
      ) {
        // Format: [14:30,15:30) - extract times and convert to full timestamps
        const rangeContent = entry.desiredTimeRange.slice(1, -1); // Remove [ and )
        const [startTime, endTime] = rangeContent.split(",");
        const startDateTime = `${desiredDate}T${startTime.trim()}:00.000Z`;
        const endDateTime = `${desiredDate}T${endTime.trim()}:00.000Z`;
        timeRange = `["${startDateTime}","${endDateTime}")`;
      } else if (entry.desiredTimeRange.includes("-")) {
        // Format: 14:30-15:30
        const [startTime, endTime] = entry.desiredTimeRange.split("-");
        const startDateTime = `${desiredDate}T${startTime.trim()}:00.000Z`;
        const endDateTime = `${desiredDate}T${endTime.trim()}:00.000Z`;
        timeRange = `["${startDateTime}","${endDateTime}")`;
      } else {
        // If it's just a single time, create a 1-hour range
        const time = entry.desiredTimeRange.trim();
        const startDateTime = `${desiredDate}T${time}:00.000Z`;
        const endDate = new Date(`${desiredDate}T${time}:00.000Z`);
        endDate.setHours(endDate.getHours() + 1);
        const endDateTime = endDate.toISOString();
        timeRange = `["${startDateTime}","${endDateTime}")`;
      }

      const waitlistData: WaitlistInsert = {
        user_id: entry.userId,
        restaurant_id: entry.restaurantId,
        desired_date: desiredDate,
        desired_time_range: timeRange,
        party_size: entry.partySize,
        table_type: entry.table_type,
        status: "active",
      };

      const { data, error } = await supabase
        .from("waitlist")
        .insert(waitlistData)
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .single();

      if (error) {
        console.error("Failed to join waitlist:", error);
        throw new Error(error.message || "Failed to join waitlist");
      }

      // Send waitlist joined notification
      try {
        const timeSlotStart = entry.desiredTimeRange.includes('-')
          ? entry.desiredTimeRange.split('-')[0].trim()
          : entry.desiredTimeRange;
        const timeSlotEnd = entry.desiredTimeRange.includes('-')
          ? entry.desiredTimeRange.split('-')[1].trim()
          : timeSlotStart;

        await NotificationHelpers.createWaitlistNotification({
          entryId: data.id,
          restaurantId: entry.restaurantId,
          restaurantName: data.restaurant?.name || "Restaurant",
          requestedDate: entry.desiredDate,
          timeSlotStart,
          timeSlotEnd,
          partySize: entry.partySize,
          action: 'joined',
          priority: 'default',
        });
      } catch (notificationError) {
        console.warn("Failed to send waitlist joined notification:", notificationError);
      }

      return data;
    },
    [user],
  );

  const getUserWaitlistEntries = useCallback(
    async (userId?: string): Promise<WaitlistRow[]> => {
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        throw new Error("User ID required to fetch waitlist entries");
      }

      const { data, error } = await supabase
        .from("waitlist")
        .select(
          `
        *,
        restaurant:restaurants(id, name, address, image_url)
      `,
        )
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch waitlist entries:", error);
        throw new Error(error.message || "Failed to fetch waitlist entries");
      }

      return data || [];
    },
    [user],
  );

  const removeFromWaitlist = useCallback(
    async (waitlistId: string): Promise<void> => {
      if (!user) {
        throw new Error("Authentication required to remove from waitlist");
      }

      // Get waitlist details before removing for notification
      const { data: waitlistEntry } = await supabase
        .from("waitlist")
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .eq("id", waitlistId)
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase
        .from("waitlist")
        .update({ status: "expired" })
        .eq("id", waitlistId)
        .eq("user_id", user.id); // Ensure user can only remove their own entries

      if (error) {
        console.error("Failed to remove from waitlist:", error);
        throw new Error(error.message || "Failed to remove from waitlist");
      }

      // Send waitlist removed notification
      if (waitlistEntry) {
        try {
          // Parse time range from PostgreSQL tstzrange format
          const timeRange = waitlistEntry.desired_time_range;
          const timeSlotStart = "12:00 PM"; // Default fallback
          const timeSlotEnd = "1:00 PM"; // Default fallback

          await NotificationHelpers.createWaitlistNotification({
            entryId: waitlistId,
            restaurantId: waitlistEntry.restaurant_id,
            restaurantName: waitlistEntry.restaurant?.name || "Restaurant",
            requestedDate: waitlistEntry.desired_date,
            timeSlotStart,
            timeSlotEnd,
            partySize: waitlistEntry.party_size,
            action: 'removed',
            priority: 'default',
          });
        } catch (notificationError) {
          console.warn("Failed to send waitlist removed notification:", notificationError);
        }
      }
    },
    [user],
  );

  const updateWaitlistStatus = useCallback(
    async (
      waitlistId: string,
      status: "active" | "notified" | "booked" | "expired",
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
    },
    [user],
  );

  return {
    joinWaitlist,
    getUserWaitlistEntries,
    removeFromWaitlist,
    updateWaitlistStatus,
    canJoinWaitlist: !!user,
  };
};
