// lib/realtime/BookingStatusUpdates.ts
import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useBookingStore } from "@/stores";

export class BookingStatusUpdates {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  /**
   * Initialize real-time listening for booking status updates
   */
  initialize(userId: string) {
    this.userId = userId;

    // Clean up any existing channel
    if (this.channel) {
      this.channel.unsubscribe();
    }

    // Create channel for user's bookings
    this.channel = supabase
      .channel(`user-bookings:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
    
          await this.handleBookingUpdate(payload);
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
    
          await this.handleNotification(payload);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
         
        }
      });
  }

  /**
   * Handle booking status updates
   */
  private async handleBookingUpdate(payload: any) {
    const oldStatus = payload.old?.status;
    const newStatus = payload.new?.status;
    const bookingId = payload.new?.id;

    if (!oldStatus || !newStatus || oldStatus === newStatus) return;

    // Get restaurant details for notification
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, restaurant:restaurants(name)")
      .eq("id", bookingId)
      .single();

    if (!booking) return;

    // Update the store with the new booking data
    useBookingStore.getState().updateBooking(bookingId, booking);

    // Handle different status transitions
    if (oldStatus === "pending" && newStatus === "confirmed") {
      await this.showBookingConfirmedNotification(booking);
    } else if (
      oldStatus === "pending" &&
      newStatus === "declined_by_restaurant"
    ) {
      await this.showBookingDeclinedNotification(booking);
    }
  }

  /**
   * Handle new notifications
   */
  private async handleNotification(payload: any) {
    const notification = payload.new;
    if (!notification) return;

    // Show push notification based on type
    switch (notification.type) {
      case "booking_confirmed":
      case "booking_cancelled":
      case "booking_reminder":
        await this.showPushNotification(
          notification.title,
          notification.message,
          notification.data,
        );
        break;
    }
  }

  /**
   * Show booking confirmed notification
   */
  private async showBookingConfirmedNotification(booking: any) {
    const bookingDate = new Date(booking.booking_time);
    const dateStr = bookingDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = bookingDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    await this.showPushNotification(
      "🎉 Booking Confirmed!",
      `Your table at ${booking.restaurant.name} for ${dateStr} at ${timeStr} is confirmed!`,
      {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        action: "view_booking",
      },
    );
  }

  /**
   * Show booking declined notification
   */
  private async showBookingDeclinedNotification(booking: any) {
    await this.showPushNotification(
      "😔 Booking Request Declined",
      `${booking.restaurant.name} couldn't accommodate your request. Try booking a different time.`,
      {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        action: "book_again",
      },
    );
  }

  /**
   * Show push notification
   */
  private async showPushNotification(title: string, body: string, data?: any) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error("Error showing push notification:", error);
    }
  }

  /**
   * Handle notification tap
   */
  static handleNotificationResponse(
    response: Notifications.NotificationResponse,
  ) {
    const data = response.notification.request.content.data;
    if (!data) return;

    switch (data.action) {
      case "view_booking":
        if (data.bookingId) {
          router.push({
            pathname: "/booking/[id]",
            params: { id: data.bookingId as string },
          });
        }
        break;
      case "book_again":
        if (data.restaurantId) {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: data.restaurantId as string },
          });
        }
        break;
    }
  }

  /**
   * Clean up subscriptions
   */
  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
  }

  /**
   * Check for expired pending bookings
   */
  static async checkExpiredPendingBookings(userId: string) {
    try {
      // Call the auto-decline function
      await supabase.rpc("auto_decline_expired_pending_bookings");

      // Refresh user's bookings
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lt(
          "created_at",
          new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        );

      return bookings || [];
    } catch (error) {
      console.error("Error checking expired bookings:", error);
      return [];
    }
  }
}

// Singleton instance
export const bookingStatusUpdates = new BookingStatusUpdates();
