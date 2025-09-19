import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase-generated";

type DatabaseTables = Database["public"]["Tables"];

// Type definitions for subscription callbacks
type TableChangeCallback<T = any> = (payload: {
  new?: T;
  old?: T;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}) => void;

// Subscription configuration
interface SubscriptionConfig {
  table: keyof DatabaseTables;
  filter?: string;
  callback: TableChangeCallback;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
}

interface UserSubscriptionConfig {
  userId: string;
  onBookingChange?: TableChangeCallback<DatabaseTables["bookings"]["Row"]>;
  onWaitlistChange?: TableChangeCallback<DatabaseTables["waitlist"]["Row"]>;
  onNotificationChange?: TableChangeCallback<
    DatabaseTables["notifications"]["Row"]
  >;
  onFriendRequestChange?: TableChangeCallback<
    DatabaseTables["friend_requests"]["Row"]
  >;
  onBookingInviteChange?: TableChangeCallback<
    DatabaseTables["booking_invites"]["Row"]
  >;
  onLoyaltyChange?: TableChangeCallback<
    DatabaseTables["loyalty_activities"]["Row"]
  >;
  onUserOfferChange?: TableChangeCallback<DatabaseTables["user_offers"]["Row"]>;
  onPostChange?: TableChangeCallback<DatabaseTables["posts"]["Row"]>;
  onReviewChange?: TableChangeCallback<DatabaseTables["reviews"]["Row"]>;
}

interface RestaurantSubscriptionConfig {
  restaurantId: string;
  onBookingChange?: TableChangeCallback<DatabaseTables["bookings"]["Row"]>;
  onTableChange?: TableChangeCallback<
    DatabaseTables["restaurant_tables"]["Row"]
  >;
  onWaitlistChange?: TableChangeCallback<DatabaseTables["waitlist"]["Row"]>;
  onSpecialOfferChange?: TableChangeCallback<
    DatabaseTables["special_offers"]["Row"]
  >;
  onReviewChange?: TableChangeCallback<DatabaseTables["reviews"]["Row"]>;
  onPostChange?: TableChangeCallback<DatabaseTables["posts"]["Row"]>;
}

/**
 * Centralized real-time subscription service for all database changes
 * Replaces polling patterns throughout the application with efficient real-time updates
 */
class RealtimeSubscriptionService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, SubscriptionConfig[]> = new Map();
  private cleanupTimeouts: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  private retryAttempts: Map<string, number> = new Map();
  private isInitialized = false;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds

  /**
   * Initialize the real-time service
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn("RealtimeSubscriptionService already initialized");
      return;
    }

    // Set up app lifecycle listeners for cleanup
    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this),
      );
    }

    this.isInitialized = true;
  
  }

  /**
   * Handle app visibility changes for performance optimization
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // App is in background, reduce subscription activity

    } else {
      // App is active, restore full subscription activity
   
    }
  }

  /**
   * Subscribe to user-specific data changes
   */
  subscribeToUser(config: UserSubscriptionConfig): () => void {
    const channelId = `user_${config.userId}`;
    this.unsubscribe(channelId);

    const subscriptions: SubscriptionConfig[] = [];

    // User bookings
    if (config.onBookingChange) {
      subscriptions.push({
        table: "bookings",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onBookingChange,
        event: "*",
      });
    }

    // User waitlist entries
    if (config.onWaitlistChange) {
      subscriptions.push({
        table: "waitlist",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onWaitlistChange,
        event: "*",
      });
    }

    // User notifications
    if (config.onNotificationChange) {
      subscriptions.push({
        table: "notifications",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onNotificationChange,
        event: "*",
      });
    }

    // Friend requests (both sent and received)
    if (config.onFriendRequestChange) {
      subscriptions.push({
        table: "friend_requests",
        filter: `or(from_user_id.eq.${config.userId},to_user_id.eq.${config.userId})`,
        callback: config.onFriendRequestChange,
        event: "*",
      });
    }

    // Booking invites (both sent and received)
    if (config.onBookingInviteChange) {
      subscriptions.push({
        table: "booking_invites",
        filter: `or(from_user_id.eq.${config.userId},to_user_id.eq.${config.userId})`,
        callback: config.onBookingInviteChange,
        event: "*",
      });
    }

    // Loyalty activities
    if (config.onLoyaltyChange) {
      subscriptions.push({
        table: "loyalty_activities",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onLoyaltyChange,
        event: "*",
      });
    }

    // User offers (claimed/used offers)
    if (config.onUserOfferChange) {
      subscriptions.push({
        table: "user_offers",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onUserOfferChange,
        event: "*",
      });
    }

    // User posts (social feed updates)
    if (config.onPostChange) {
      subscriptions.push({
        table: "posts",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onPostChange,
        event: "*",
      });
    }

    // User reviews
    if (config.onReviewChange) {
      subscriptions.push({
        table: "reviews",
        filter: `user_id=eq.${config.userId}`,
        callback: config.onReviewChange,
        event: "*",
      });
    }

    return this.createSubscription(channelId, subscriptions);
  }

  /**
   * Subscribe to restaurant-specific data changes
   */
  subscribeToRestaurant(config: RestaurantSubscriptionConfig): () => void {
    const channelId = `restaurant_${config.restaurantId}`;
    this.unsubscribe(channelId);

    const subscriptions: SubscriptionConfig[] = [];

    // Restaurant bookings
    if (config.onBookingChange) {
      subscriptions.push({
        table: "bookings",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onBookingChange,
        event: "*",
      });
    }

    // Restaurant tables
    if (config.onTableChange) {
      subscriptions.push({
        table: "restaurant_tables",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onTableChange,
        event: "*",
      });
    }

    // Restaurant waitlist
    if (config.onWaitlistChange) {
      subscriptions.push({
        table: "waitlist",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onWaitlistChange,
        event: "*",
      });
    }

    // Special offers for this restaurant
    if (config.onSpecialOfferChange) {
      subscriptions.push({
        table: "special_offers",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onSpecialOfferChange,
        event: "*",
      });
    }

    // Restaurant reviews
    if (config.onReviewChange) {
      subscriptions.push({
        table: "reviews",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onReviewChange,
        event: "*",
      });
    }

    // Restaurant posts (social content about this restaurant)
    if (config.onPostChange) {
      subscriptions.push({
        table: "posts",
        filter: `restaurant_id=eq.${config.restaurantId}`,
        callback: config.onPostChange,
        event: "*",
      });
    }

    return this.createSubscription(channelId, subscriptions);
  }

  /**
   * Subscribe to global special offers (all restaurants)
   */
  subscribeToGlobalOffers(
    onSpecialOfferChange: TableChangeCallback,
  ): () => void {
    const channelId = "global_offers";
    this.unsubscribe(channelId);

    const subscriptions: SubscriptionConfig[] = [
      {
        table: "special_offers",
        callback: onSpecialOfferChange,
        event: "*",
      },
    ];

    return this.createSubscription(channelId, subscriptions);
  }

  /**
   * Subscribe to specific table changes with custom filter
   */
  subscribeToTable<T extends keyof DatabaseTables>(
    table: T,
    callback: TableChangeCallback<DatabaseTables[T]["Row"]>,
    options: {
      channelId: string;
      filter?: string;
      event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    },
  ): () => void {
    this.unsubscribe(options.channelId);

    const subscriptions: SubscriptionConfig[] = [
      {
        table,
        filter: options.filter,
        callback,
        event: options.event || "*",
      },
    ];

    return this.createSubscription(options.channelId, subscriptions);
  }

  /**
   * Create and manage a real-time subscription
   */
  private createSubscription(
    channelId: string,
    subscriptions: SubscriptionConfig[],
  ): () => void {
    const channel = supabase.channel(channelId);

    // Set up all subscriptions on this channel
    subscriptions.forEach((sub) => {
      let subscription = channel.on(
        "postgres_changes" as any,
        {
          event: sub.event || "*",
          schema: "public",
          table: sub.table as string,
          ...(sub.filter && { filter: sub.filter }),
        },
        (payload: any) => {
          try {
            sub.callback({
              new: payload.new || undefined,
              old: payload.old || undefined,
              eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            });
          } catch (error) {
            console.error(
              `Error in ${sub.table} subscription callback:`,
              error,
            );
            // Don't crash the app if callback fails
          }
        },
      );
    });

    // Subscribe with enhanced status handling
    channel.subscribe((status) => {


      if (status === "SUBSCRIBED") {
 
        // Reset retry attempts on successful connection
        this.retryAttempts.delete(channelId);
      } else if (status === "CHANNEL_ERROR") {
        console.error(`❌ Real-time subscription error: ${channelId}`);
        this.handleSubscriptionError(channelId, subscriptions);
      } else if (status === "TIMED_OUT") {
        console.error(`⏰ Real-time subscription timeout: ${channelId}`);
        this.handleSubscriptionError(channelId, subscriptions);
      } else if (status === "CLOSED") {
        console.warn(`🔒 Real-time subscription closed: ${channelId}`);
      }
    });

    this.channels.set(channelId, channel);
    this.subscriptions.set(channelId, subscriptions);

    // Return unsubscribe function
    return () => this.unsubscribe(channelId);
  }

  /**
   * Handle subscription errors with retry logic
   */
  private handleSubscriptionError(
    channelId: string,
    subscriptions: SubscriptionConfig[],
  ): void {
    const currentAttempts = this.retryAttempts.get(channelId) || 0;

    if (currentAttempts < this.MAX_RETRY_ATTEMPTS) {
      this.retryAttempts.set(channelId, currentAttempts + 1);

      const retryDelay = this.RETRY_DELAY * Math.pow(2, currentAttempts); // Exponential backoff
   

      const retryTimeout = setTimeout(() => {
  
        this.unsubscribe(channelId);
        this.createSubscription(channelId, subscriptions);
      }, retryDelay);

      this.cleanupTimeouts.set(channelId, retryTimeout);
    } else {
      console.error(
        `💥 Max retry attempts reached for ${channelId}. Subscription failed permanently.`,
      );
      this.retryAttempts.delete(channelId);

      // Clean up the failed channel to prevent memory leaks
      this.unsubscribe(channelId);
    }
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelId: string): void {
    // Clear any pending retry timeouts
    const timeout = this.cleanupTimeouts.get(channelId);
    if (timeout) {
      clearTimeout(timeout);
      this.cleanupTimeouts.delete(channelId);
    }

    const channel = this.channels.get(channelId);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelId);
      this.subscriptions.delete(channelId);
      this.retryAttempts.delete(channelId);

    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    // Clear all timeouts
    this.cleanupTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.cleanupTimeouts.clear();

    // Remove all channels
    this.channels.forEach((channel, channelId) => {
      supabase.removeChannel(channel);
    });

    this.channels.clear();
    this.subscriptions.clear();
    this.retryAttempts.clear();

  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptions(): number {
    return this.channels.size;
  }

  /**
   * Get channel status
   */
  getChannelStatus(channelId: string): string | null {
    const channel = this.channels.get(channelId);
    return channel ? channel.state : null;
  }

  /**
   * Check if service is healthy (all channels connected)
   */
  isHealthy(): boolean {
    if (this.channels.size === 0) return true; // No subscriptions is healthy

    for (const [channelId, channel] of this.channels) {
      if (channel.state !== "joined") {
        console.warn(
          `Unhealthy channel detected: ${channelId} (state: ${channel.state})`,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    activeChannels: number;
    totalSubscriptions: number;
    retryingChannels: number;
    pendingTimeouts: number;
  } {
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (sum, subs) => sum + subs.length,
      0,
    );

    return {
      activeChannels: this.channels.size,
      totalSubscriptions,
      retryingChannels: this.retryAttempts.size,
      pendingTimeouts: this.cleanupTimeouts.size,
    };
  }

  /**
   * Cleanup service on app termination
   */
  cleanup(): void {
    this.unsubscribeAll();
    this.isInitialized = false;

  }

  /**
   * Debug: List all active channels
   */
  listActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Debug: Log detailed status of all subscriptions
   */
  debugStatus(): void {
    const stats = this.getStats();


    if (this.channels.size > 0) {
  
      this.channels.forEach((channel, channelId) => {
        const subscriptions = this.subscriptions.get(channelId) || [];
        const retryCount = this.retryAttempts.get(channelId) || 0;
   
      });
    }
 
  }
}

// Create singleton instance
export const realtimeSubscriptionService = new RealtimeSubscriptionService();

// Initialize service
realtimeSubscriptionService.initialize();

// Export types for use in other files
export type {
  UserSubscriptionConfig,
  RestaurantSubscriptionConfig,
  TableChangeCallback,
};
