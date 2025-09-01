// Meta Events Type Definitions for Facebook/Instagram Ad Tracking

/**
 * Base Meta event properties interface
 */
export interface MetaEventProperties {
  [key: string]: string | number | boolean;
}

/**
 * Booking event data for Meta tracking
 */
export interface BookingEventData {
  restaurantId: string;
  restaurantName: string;
  bookingDate: string;
  partySize: number;
  tableType?: string;
  currency?: string;
  value?: number;
}

/**
 * Loyalty points earned event data for Meta tracking
 */
export interface LoyaltyEventData {
  restaurantId: string;
  restaurantName: string;
  pointsEarned: number;
  totalPoints: number;
  activityType: string;
}

/**
 * User registration event data for Meta tracking
 */
export interface RegistrationEventData {
  method: "email" | "google" | "apple";
  hasProfileData: boolean;
}

/**
 * Search event data for Meta tracking
 */
export interface SearchEventData {
  query: string;
  resultCount: number;
}

/**
 * Restaurant view event data for Meta tracking
 */
export interface RestaurantViewEventData {
  restaurantId: string;
  restaurantName: string;
}

/**
 * Screen view event data for Meta tracking
 */
export interface ScreenViewEventData {
  screenName: string;
  [key: string]: any;
}

/**
 * Waitlist event data for Meta tracking
 */
export interface WaitlistEventData {
  restaurantId: string;
  restaurantName: string;
}

/**
 * User properties for audience targeting
 */
export interface UserProperties {
  [key: string]: string | number | boolean;
}

/**
 * Meta tracking service interface
 */
export interface MetaTrackingServiceInterface {
  // Core tracking methods
  trackAppInstall(): void;
  trackRegistration(data: RegistrationEventData): void;
  trackFirstBooking(data: BookingEventData): void;
  trackBookingConfirmation(data: BookingEventData): void;
  trackLoyaltyPointsEarned(data: LoyaltyEventData): void;

  // Additional tracking methods
  trackScreenView(screenName: string): void;
  trackSearchPerformed(query: string, resultCount: number): void;
  trackRestaurantViewed(restaurantId: string, restaurantName: string): void;
  trackBookingCancelled(data: BookingEventData): void;
  trackWaitlistJoined(restaurantId: string, restaurantName: string): void;

  // User management
  setUserId(userId: string): void;
  clearUserId(): void;
  setUserProperties(properties: UserProperties): void;

  // Utility methods
  flush(): void;
  getDebugInfo(): {
    isInitialized: boolean;
    userId?: string;
  };
}

/**
 * Standard Facebook App Events Constants
 * These correspond to the events that Meta recognizes for ad optimization
 */
export const META_STANDARD_EVENTS = {
  // Core conversion events
  APP_INSTALL: "fb_mobile_activate_app",
  REGISTRATION: "fb_mobile_complete_registration",
  FIRST_BOOKING: "fb_mobile_purchase", // First booking is treated as a purchase
  BOOKING_CONFIRMATION: "fb_mobile_add_to_cart", // Booking confirmation is like adding to cart
  LOYALTY_POINTS: "fb_mobile_unlock_achievement", // Points earning is an achievement

  // Additional engagement events
  SCREEN_VIEW: "fb_mobile_content_view",
  SEARCH: "fb_mobile_search",
  RESTAURANT_VIEW: "fb_mobile_content_view",
  BOOKING_CANCELLED: "fb_mobile_remove_from_cart",
  WAITLIST_JOINED: "fb_mobile_add_to_wishlist",
} as const;

/**
 * Custom event names for more specific tracking
 */
export const META_CUSTOM_EVENTS = {
  FIRST_BOOKING_COMPLETED: "FirstBookingCompleted",
  BOOKING_CONFIRMED: "BookingConfirmed",
  LOYALTY_POINTS_EARNED: "LoyaltyPointsEarned",
  BOOKING_CANCELLED: "BookingCancelled",
  WAITLIST_JOINED: "WaitlistJoined",
} as const;

/**
 * Standard Facebook parameters
 */
export const META_PARAMETERS = {
  CONTENT_TYPE: "fb_content_type",
  CONTENT_ID: "fb_content_id",
  CURRENCY: "fb_currency",
  DESCRIPTION: "fb_description",
  SEARCH_STRING: "fb_search_string",
  NUM_ITEMS: "fb_num_items",
  REGISTRATION_METHOD: "fb_registration_method",
} as const;

/**
 * Event tracking options
 */
export interface MetaEventOptions {
  flush?: boolean; // Whether to immediately flush events
  debugMode?: boolean; // Whether to log debug information
}

/**
 * Meta tracking configuration
 */
export interface MetaTrackingConfig {
  autoLogAppEvents: boolean;
  advertiserIdCollection: boolean;
  debugMode: boolean;
}
