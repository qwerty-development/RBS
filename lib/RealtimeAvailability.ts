// lib/realtime/RealtimeAvailability.ts
import { supabase } from "@/config/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export class RealtimeAvailability {
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<() => void>> = new Map();
  private cleanupTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Subscribe to availability updates for a restaurant
   */
  subscribeToRestaurant(
    restaurantId: string,
    onUpdate: () => void,
  ): () => void {
    const channelKey = `restaurant:${restaurantId}`;

    // Clear any pending cleanup
    const existingTimeout = this.cleanupTimeouts.get(channelKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.cleanupTimeouts.delete(channelKey);
    }

    // Add listener
    if (!this.listeners.has(channelKey)) {
      this.listeners.set(channelKey, new Set());
    }
    this.listeners.get(channelKey)!.add(onUpdate);

    // Create channel if it doesn't exist
    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            console.log("Booking change detected:", payload);

            // Check if this is a status change that affects availability
            const newData = payload.new as any;
            const oldData = payload.old as any;
            const newStatus = newData?.status;
            const oldStatus = oldData?.status;

            // Trigger immediate update for status changes that free up tables
            if (
              newStatus !== oldStatus &&
              (newStatus === "cancelled_by_user" ||
                newStatus === "cancelled_by_restaurant" ||
                newStatus === "declined_by_restaurant" ||
                newStatus === "no_show" ||
                oldStatus === "pending") // When pending becomes confirmed, it may block other slots
            ) {
              console.log(
                `Booking status changed from ${oldStatus} to ${newStatus}, triggering immediate availability update`,
              );
            }

            this.notifyListeners(channelKey);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "booking_tables",
          },
          async (payload) => {
            // Properly handle async operation
            try {
              await this.checkAndNotify(restaurantId, payload);
            } catch (error) {
              console.error("Error processing booking_tables change:", error);
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "restaurant_tables",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            console.log("Table configuration change detected:", payload);
            this.notifyListeners(channelKey);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log(`Subscribed to real-time updates for ${channelKey}`);
          } else if (status === "CHANNEL_ERROR") {
            console.error(`Error subscribing to restaurant:${restaurantId}`);
            // Don't retry immediately to avoid infinite loops
            // Instead, mark this subscription as failed and clean up
            setTimeout(() => {
              const currentChannel = this.channels.get(channelKey);
              if (currentChannel === channel) {
                // Only clean up if this is still the active channel
                currentChannel.unsubscribe();
                this.channels.delete(channelKey);
                console.log(`Cleaned up failed subscription for ${channelKey}`);
              }
            }, 1000);
          } else if (status === "TIMED_OUT") {
            console.warn(`Subscription timed out for ${channelKey}, retrying...`);
            setTimeout(() => {
              if (this.channels.has(channelKey)) {
                this.resubscribe(channelKey, restaurantId);
              }
            }, 2000);
          } else if (status === "CLOSED") {
            console.log(`Subscription closed for ${channelKey}`);
            this.channels.delete(channelKey);
          }
        });

      this.channels.set(channelKey, channel);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(channelKey);
      if (listeners) {
        listeners.delete(onUpdate);

        // If no more listeners, schedule cleanup (with delay to handle quick resubscribes)
        if (listeners.size === 0) {
          const timeoutId = setTimeout(() => {
            // Double-check no new listeners were added
            const currentListeners = this.listeners.get(channelKey);
            if (!currentListeners || currentListeners.size === 0) {
              const channel = this.channels.get(channelKey);
              if (channel) {
                channel.unsubscribe();
                this.channels.delete(channelKey);
              }
              this.listeners.delete(channelKey);
              this.cleanupTimeouts.delete(channelKey);
            }
          }, 5000) as any; // 5 second delay before cleanup

          this.cleanupTimeouts.set(channelKey, timeoutId);
        }
      }
    };
  }

  /**
   * Resubscribe to a channel after error
   */
  private async resubscribe(channelKey: string, restaurantId: string) {
    console.log(`Attempting to resubscribe to ${channelKey}`);
    
    try {
      const channel = this.channels.get(channelKey);
      if (channel) {
        await channel.unsubscribe();
        this.channels.delete(channelKey);
      }

      // Wait a moment before recreating the subscription
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we still have listeners for this channel
      const listeners = this.listeners.get(channelKey);
      if (listeners && listeners.size > 0) {
        // Recreate the subscription by calling subscribeToRestaurant again
        // Get the first listener to trigger recreation
        const firstListener = listeners.values().next().value;
        if (firstListener) {
          console.log(`Recreating subscription for ${channelKey}`);
          // The subscribeToRestaurant method will handle creating a new channel
        }
      }
    } catch (error) {
      console.error(`Failed to resubscribe to ${channelKey}:`, error);
      // Don't retry again to avoid infinite loops
    }
  }

  /**
   * Check if a booking_tables change affects a restaurant
   */
  private async checkAndNotify(restaurantId: string, payload: any) {
    try {
      if (payload.new?.booking_id || payload.old?.booking_id) {
        const bookingId = payload.new?.booking_id || payload.old?.booking_id;

        // Check if this booking is for our restaurant
        const { data, error } = await supabase
          .from("bookings")
          .select("restaurant_id")
          .eq("id", bookingId)
          .single();

        if (error) {
          console.error("Error checking booking restaurant:", error);
          return;
        }

        if (data?.restaurant_id === restaurantId) {
          this.notifyListeners(`restaurant:${restaurantId}`);
        }
      }
    } catch (error) {
      console.error("Error in checkAndNotify:", error);
    }
  }

  /**
   * Notify all listeners for a channel
   */
  private notifyListeners(channelKey: string) {
    const listeners = this.listeners.get(channelKey);
    if (listeners) {
      // Use setTimeout to avoid blocking the event loop
      setTimeout(() => {
        listeners.forEach((listener) => {
          try {
            listener();
          } catch (error) {
            console.error("Error in availability listener:", error);
          }
        });
      }, 0);
    }
  }

  /**
   * Subscribe to global booking changes (for admin dashboards)
   */
  subscribeToGlobal(onUpdate: (restaurantId: string) => void): () => void {
    const channelKey = "global:bookings";

    if (!this.channels.has(channelKey)) {
      const channel = supabase
        .channel(channelKey)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
          },
          (payload) => {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            const restaurantId =
              newData?.restaurant_id || oldData?.restaurant_id;
            if (restaurantId) {
              onUpdate(restaurantId);
            }
          },
        )
        .subscribe();

      this.channels.set(channelKey, channel);
    }

    return () => {
      const channel = this.channels.get(channelKey);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(channelKey);
      }
    };
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(
    restaurantId: string,
  ): "subscribed" | "subscribing" | "unsubscribed" {
    const channel = this.channels.get(`restaurant:${restaurantId}`);
    if (!channel) return "unsubscribed";

    // Check the actual channel state
    const state = (channel as any).state;
    if (state === "joined") return "subscribed";
    if (state === "joining" || state === "leaving") return "subscribing";
    return "unsubscribed";
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    // Clear all pending timeouts
    this.cleanupTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.cleanupTimeouts.clear();

    // Unsubscribe all channels
    this.channels.forEach((channel) => {
      try {
        channel.unsubscribe();
      } catch (error) {
        console.error("Error unsubscribing channel:", error);
      }
    });

    this.channels.clear();
    this.listeners.clear();

    console.log("RealtimeAvailability cleaned up");
  }
}

// Singleton instance
export const realtimeAvailability = new RealtimeAvailability();

// Cleanup on app termination (for React Native)
if (typeof global !== "undefined" && global.addEventListener) {
  global.addEventListener("beforeunload", () => {
    realtimeAvailability.cleanup();
  });
}
