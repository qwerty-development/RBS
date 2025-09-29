// lib/WaitingListNotifications.ts
import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useWaitingListStore } from "@/stores";
import * as Haptics from "expo-haptics";

export class WaitingListNotifications {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  /**
   * Initialize real-time listening for waiting list updates
   */
  initialize(userId: string) {
    this.userId = userId;

    // Clean up any existing channel
    if (this.channel) {
      this.channel.unsubscribe();
    }

    // Create channel for user's waiting list entries
    this.channel = supabase
      .channel(`waiting-list:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waiting_list",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          await this.handleWaitingListUpdate(payload);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Handle notifications specifically for waiting list
          const notification = payload.new;
          if (notification.type === "waiting_list_available") {
            await this.handleWaitingListNotification(payload);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
        }
      });
  }

  /**
   * Handle waiting list status updates
   */
  private async handleWaitingListUpdate(payload: any) {
    const oldStatus = payload.old?.status;
    const newStatus = payload.new?.status;
    const entryId = payload.new?.id;

    if (!oldStatus || !newStatus || oldStatus === newStatus) return;

    // Get waiting list entry details for notification
    const { data: entry } = await supabase
      .from("waiting_list")
      .select(
        `
        *,
        restaurant:restaurants(name, main_image_url)
      `,
      )
      .eq("id", entryId)
      .single();

    if (!entry) return;

    // Update the store with the new entry data
    useWaitingListStore.getState().updateWaitingListEntry(entryId, entry);

    // Handle different status transitions
    if (oldStatus === "active" && newStatus === "notified") {
      await this.showTableAvailableNotification(entry);
    } else if (newStatus === "expired") {
      await this.showExpiredNotification(entry);
    } else if (newStatus === "converted") {
      await this.showBookingConfirmedNotification(entry);
    } else if (newStatus === "cancelled") {
      // Clean up any pending notifications when entry is cancelled
      await WaitingListNotifications.cleanupCancelledEntryNotifications(
        entryId,
      );
    }
  }

  /**
   * Handle new waiting list notifications
   */
  private async handleWaitingListNotification(payload: any) {
    const notification = payload.new;
    if (!notification) return;

    // Show push notification based on type
    switch (notification.type) {
      case "waiting_list_available":
        await this.showPushNotification(
          "Table Available!",
          notification.message,
          notification.data,
        );
        break;
      case "waiting_list_expired":
        await this.showPushNotification(
          "Waiting List Expired",
          notification.message,
          notification.data,
        );
        break;
    }
  }

  /**
   * Show table available notification
   */
  private async showTableAvailableNotification(entry: any) {
    const requestedDate = new Date(entry.requested_date + "T00:00:00");
    const dateStr = requestedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    // Determine party size range for notification
    const partySizeText =
      entry.max_party_size && entry.max_party_size !== entry.min_party_size
        ? `${entry.min_party_size}-${entry.max_party_size} people`
        : `${entry.min_party_size} ${entry.min_party_size === 1 ? "person" : "people"}`;

    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await this.showPushNotification(
      "🎉 Table Available!",
      `A table for ${partySizeText} at ${entry.restaurant.name} is now available for ${dateStr} within your ${entry.time_slot_start}-${entry.time_slot_end} time range. Book within 15 minutes!`,
      {
        type: "waiting_list_available",
        entryId: entry.id,
        restaurantId: entry.restaurant_id,
        restaurantName: entry.restaurant.name,
        requestedDate: entry.requested_date,
        timeSlotStart: entry.time_slot_start,
        timeSlotEnd: entry.time_slot_end,
        requestedTime: entry.requested_time,
        minPartySize: entry.min_party_size,
        maxPartySize: entry.max_party_size,
        partySize: entry.party_size,
      },
    );
  }

  /**
   * Show expired notification
   */
  private async showExpiredNotification(entry: any) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    await this.showPushNotification(
      "⏰ Waiting List Expired",
      `Your waiting list entry at ${entry.restaurant.name} has expired. You can join the waiting list again if still interested.`,
      {
        type: "waiting_list_expired",
        entryId: entry.id,
        restaurantId: entry.restaurant_id,
        restaurantName: entry.restaurant.name,
      },
    );
  }

  /**
   * Show booking confirmed notification
   */
  private async showBookingConfirmedNotification(entry: any) {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await this.showPushNotification(
      "✅ Booking Confirmed!",
      `Your waiting list entry at ${entry.restaurant.name} has been converted to a confirmed booking!`,
      {
        type: "waiting_list_converted",
        entryId: entry.id,
        restaurantId: entry.restaurant_id,
        bookingId: entry.converted_booking_id,
      },
    );
  }

  /**
   * Show push notification
   */
  private async showPushNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  static async handleNotificationTap(data: any) {
    try {
      // Navigate based on notification type and data
      if (data.type === "waiting_list_available") {
        // Navigate to waiting list screen
        router.push("/(protected)/waiting-list");
      } else if (data.restaurantId) {
        // Navigate to restaurant page
        router.push(`/restaurant/${data.restaurantId}`);
      }
    } catch (error) {
      console.error("Failed to handle notification tap:", error);
    }
  }

  /**
   * Clean up notifications for a c ancelled waitlist entry
   */
  static async cleanupCancelledEntryNotifications(waitlistId: string) {
    try {
      // Call the database function to cleanup notifications
      await supabase.rpc("cleanup_waitlist_notifications", {
        p_waitlist_id: waitlistId,
      });
    } catch (error) {
      console.warn(
        "Failed to cleanup notifications for waitlist entry:",
        error,
      );
      // Don't throw - this is a cleanup operation that shouldn't fail the main action
    }
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
  }

  /**
   * Get singleton instance
   */
  private static instance: WaitingListNotifications | null = null;

  static getInstance(): WaitingListNotifications {
    if (!this.instance) {
      this.instance = new WaitingListNotifications();
    }
    return this.instance;
  }
}
