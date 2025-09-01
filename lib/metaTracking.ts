import { AppEventsLogger, Settings } from "react-native-fbsdk-next";
import { appMonitor } from "./monitoring";
import { InputSanitizer } from "./security";
import {
  MetaEventProperties,
  BookingEventData,
  LoyaltyEventData,
  RegistrationEventData,
  MetaTrackingServiceInterface,
  MetaTrackingConfig,
  META_STANDARD_EVENTS,
  META_CUSTOM_EVENTS,
  META_PARAMETERS,
} from "../types/meta-events";

// Facebook App Events Constants (since they're not exported from the SDK)
const FB_APP_EVENTS = {
  ACTIVATE_APP: "fb_mobile_activate_app",
  COMPLETE_REGISTRATION: "fb_mobile_complete_registration",
  PURCHASE: "fb_mobile_purchase",
  ADD_TO_CART: "fb_mobile_add_to_cart",
  UNLOCK_ACHIEVEMENT: "fb_mobile_unlock_achievement",
  CONTENT_VIEW: "fb_mobile_content_view",
  SEARCH: "fb_mobile_search",
} as const;

const FB_PARAMETERS = {
  CONTENT_TYPE: "fb_content_type",
  CONTENT_ID: "fb_content_id",
  CURRENCY: "fb_currency",
  REGISTRATION_METHOD: "fb_registration_method",
  SEARCH_STRING: "fb_search_string",
  NUM_ITEMS: "fb_num_items",
  DESCRIPTION: "fb_description",
} as const;

export class MetaTrackingService implements MetaTrackingServiceInterface {
  private static instance: MetaTrackingService;
  private isInitialized = false;
  private userId?: string;

  private constructor() {
    this.initialize();
  }

  static getInstance(): MetaTrackingService {
    if (!MetaTrackingService.instance) {
      MetaTrackingService.instance = new MetaTrackingService();
    }
    return MetaTrackingService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Facebook SDK
      Settings.setAdvertiserTrackingEnabled(true);
      Settings.initializeSDK();

      // Development mode configuration
      if (__DEV__) {
        // Enable advertiser ID collection for better debugging
        Settings.setAdvertiserIDCollectionEnabled(true);

        // Note: Flush behavior and test event codes are set via methods below
        // when explicitly called during testing

        appMonitor.log(
          "info",
          "Meta tracking initialized in development mode",
          {
            advertiserIdEnabled: true,
            isDevelopment: true,
          },
          "MetaTracking",
        );
      }

      this.isInitialized = true;

      appMonitor.log(
        "info",
        "Meta tracking service initialized",
        { isDev: __DEV__ },
        "MetaTracking",
      );
    } catch (error) {
      appMonitor.log(
        "error",
        "Failed to initialize Meta tracking",
        { error },
        "MetaTracking",
      );
      // Don't throw - continue with tracking disabled rather than crashing
      this.isInitialized = false;
    }
  }

  setUserId(userId: string): void {
    this.userId = userId;
    AppEventsLogger.setUserID(userId);
    appMonitor.log("info", "Meta user ID set", { userId }, "MetaTracking");
  }

  clearUserId(): void {
    this.userId = undefined;
    AppEventsLogger.clearUserID();
    appMonitor.log("info", "Meta user ID cleared", {}, "MetaTracking");
  }

  private logEvent(
    eventName: string,
    parameters?: MetaEventProperties,
    valueToSum?: number,
  ): void {
    if (!this.isInitialized) {
      appMonitor.log(
        "warn",
        "Meta tracking not initialized",
        { eventName },
        "MetaTracking",
      );
      return;
    }

    try {
      // Sanitize parameters for security
      const sanitizedParams = parameters
        ? InputSanitizer.sanitizeForLogging(parameters)
        : {};

      // Log to Meta
      if (valueToSum !== undefined) {
        AppEventsLogger.logEvent(eventName, valueToSum, sanitizedParams);
      } else {
        AppEventsLogger.logEvent(eventName, sanitizedParams);
      }

      // Also log to our internal monitoring
      appMonitor.trackEvent(`meta_${eventName}`, {
        parameters: sanitizedParams,
        valueToSum,
        userId: this.userId,
      });

      appMonitor.log(
        "info",
        `Meta event logged: ${eventName}`,
        {
          parameters: sanitizedParams,
          valueToSum,
        },
        "MetaTracking",
      );
    } catch (error) {
      appMonitor.log(
        "error",
        "Failed to log Meta event",
        {
          eventName,
          error,
          parameters,
        },
        "MetaTracking",
      );
    }
  }

  // Standard Facebook Events
  trackAppInstall(): void {
    this.logEvent(FB_APP_EVENTS.ACTIVATE_APP);
  }

  trackRegistration(data: RegistrationEventData): void {
    this.logEvent(FB_APP_EVENTS.COMPLETE_REGISTRATION, {
      [FB_PARAMETERS.REGISTRATION_METHOD]: data.method,
      fb_profile_data_available: data.hasProfileData ? "1" : "0",
    });
  }

  trackFirstBooking(data: BookingEventData): void {
    // Use Purchase event for first booking as it's a key conversion
    this.logEvent(
      FB_APP_EVENTS.PURCHASE,
      {
        [FB_PARAMETERS.CONTENT_TYPE]: "booking",
        [FB_PARAMETERS.CONTENT_ID]: data.restaurantId,
        [FB_PARAMETERS.CURRENCY]: data.currency || "USD",
        restaurant_name: data.restaurantName,
        booking_date: data.bookingDate,
        party_size: data.partySize.toString(),
        table_type: data.tableType || "standard",
        is_first_booking: "1",
      },
      data.value || 0,
    );

    // Also track as custom event for more specific targeting
    this.logEvent("FirstBookingCompleted", {
      restaurant_id: data.restaurantId,
      restaurant_name: data.restaurantName,
      booking_date: data.bookingDate,
      party_size: data.partySize.toString(),
      table_type: data.tableType || "standard",
    });
  }

  trackBookingConfirmation(data: BookingEventData): void {
    // Use Add to Cart event for booking confirmation
    this.logEvent(
      FB_APP_EVENTS.ADD_TO_CART,
      {
        [FB_PARAMETERS.CONTENT_TYPE]: "booking",
        [FB_PARAMETERS.CONTENT_ID]: data.restaurantId,
        [FB_PARAMETERS.CURRENCY]: data.currency || "USD",
        restaurant_name: data.restaurantName,
        booking_date: data.bookingDate,
        party_size: data.partySize.toString(),
        table_type: data.tableType || "standard",
      },
      data.value || 0,
    );

    // Custom event for booking confirmation
    this.logEvent("BookingConfirmed", {
      restaurant_id: data.restaurantId,
      restaurant_name: data.restaurantName,
      booking_date: data.bookingDate,
      party_size: data.partySize.toString(),
      table_type: data.tableType || "standard",
    });
  }

  trackLoyaltyPointsEarned(data: LoyaltyEventData): void {
    // Use Achievement Unlocked event for loyalty points
    this.logEvent(FB_APP_EVENTS.UNLOCK_ACHIEVEMENT, {
      [FB_PARAMETERS.DESCRIPTION]: `Earned ${data.pointsEarned} loyalty points`,
      restaurant_id: data.restaurantId,
      restaurant_name: data.restaurantName,
      points_earned: data.pointsEarned.toString(),
      total_points: data.totalPoints.toString(),
      activity_type: data.activityType,
    });

    // Custom event for loyalty tracking
    this.logEvent(
      "LoyaltyPointsEarned",
      {
        restaurant_id: data.restaurantId,
        restaurant_name: data.restaurantName,
        points_earned: data.pointsEarned.toString(),
        total_points: data.totalPoints.toString(),
        activity_type: data.activityType,
      },
      data.pointsEarned,
    );
  }

  // Additional tracking methods for enhanced insights
  trackScreenView(screenName: string): void {
    this.logEvent(FB_APP_EVENTS.CONTENT_VIEW, {
      [FB_PARAMETERS.CONTENT_TYPE]: "screen",
      screen_name: screenName,
    });
  }

  trackSearchPerformed(query: string, resultCount: number): void {
    this.logEvent(FB_APP_EVENTS.SEARCH, {
      [FB_PARAMETERS.SEARCH_STRING]: query,
      [FB_PARAMETERS.NUM_ITEMS]: resultCount.toString(),
    });
  }

  trackRestaurantViewed(restaurantId: string, restaurantName: string): void {
    this.logEvent(FB_APP_EVENTS.CONTENT_VIEW, {
      [FB_PARAMETERS.CONTENT_TYPE]: "restaurant",
      [FB_PARAMETERS.CONTENT_ID]: restaurantId,
      restaurant_name: restaurantName,
    });
  }

  trackBookingCancelled(data: BookingEventData): void {
    this.logEvent("BookingCancelled", {
      restaurant_id: data.restaurantId,
      restaurant_name: data.restaurantName,
      booking_date: data.bookingDate,
      party_size: data.partySize.toString(),
      table_type: data.tableType || "standard",
    });
  }

  trackWaitlistJoined(restaurantId: string, restaurantName: string): void {
    this.logEvent("WaitlistJoined", {
      restaurant_id: restaurantId,
      restaurant_name: restaurantName,
    });
  }

  // Flush events to ensure immediate delivery
  flush(): void {
    try {
      AppEventsLogger.flush();
      appMonitor.log("info", "Meta events flushed", {}, "MetaTracking");
    } catch (error) {
      appMonitor.log(
        "error",
        "Failed to flush Meta events",
        { error },
        "MetaTracking",
      );
    }
  }

  // Set user properties for audience targeting
  setUserProperties(properties: MetaEventProperties): void {
    try {
      const sanitizedProps = InputSanitizer.sanitizeForLogging(properties);
      // Note: setUserData may not be available in this version of the SDK
      // This is a placeholder for when the method is available
      appMonitor.log(
        "info",
        "Meta user properties logged",
        { properties: sanitizedProps },
        "MetaTracking",
      );
    } catch (error) {
      appMonitor.log(
        "error",
        "Failed to set Meta user properties",
        { error, properties },
        "MetaTracking",
      );
    }
  }

  // Set test event code for Meta Events Manager testing (development only)
  setTestEventCode(testCode: string): void {
    if (__DEV__) {
      try {
        // Note: test_event_code should be set via Meta Events Manager interface
        // This method provides logging for tracking setup
        appMonitor.log(
          "info",
          "Meta test event code setup",
          {
            testCode,
            note: "Set this code in Meta Events Manager for testing",
          },
          "MetaTracking",
        );
      } catch (error) {
        appMonitor.log(
          "error",
          "Failed to log Meta test event code setup",
          { error, testCode },
          "MetaTracking",
        );
      }
    } else {
      appMonitor.log(
        "warn",
        "Test event codes only available in development mode",
        {},
        "MetaTracking",
      );
    }
  }

  // Force flush events for testing
  forceFlush(): void {
    try {
      AppEventsLogger.flush();
      appMonitor.log(
        "info",
        "Meta events manually flushed",
        {},
        "MetaTracking",
      );
    } catch (error) {
      appMonitor.log(
        "error",
        "Failed to manually flush Meta events",
        { error },
        "MetaTracking",
      );
    }
  }

  // Get debug info for testing
  getDebugInfo(): {
    isInitialized: boolean;
    userId?: string;
    isDevelopment: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      userId: this.userId,
      isDevelopment: __DEV__,
    };
  }
}

// Export singleton instance
export const metaTracker = MetaTrackingService.getInstance();

// Export hook for React components
export function useMetaTracking() {
  const tracker = MetaTrackingService.getInstance();

  return {
    trackAppInstall: () => tracker.trackAppInstall(),
    trackRegistration: (data: RegistrationEventData) =>
      tracker.trackRegistration(data),
    trackFirstBooking: (data: BookingEventData) =>
      tracker.trackFirstBooking(data),
    trackBookingConfirmation: (data: BookingEventData) =>
      tracker.trackBookingConfirmation(data),
    trackLoyaltyPointsEarned: (data: LoyaltyEventData) =>
      tracker.trackLoyaltyPointsEarned(data),
    trackScreenView: (screenName: string) =>
      tracker.trackScreenView(screenName),
    trackSearchPerformed: (query: string, resultCount: number) =>
      tracker.trackSearchPerformed(query, resultCount),
    trackRestaurantViewed: (restaurantId: string, restaurantName: string) =>
      tracker.trackRestaurantViewed(restaurantId, restaurantName),
    trackBookingCancelled: (data: BookingEventData) =>
      tracker.trackBookingCancelled(data),
    trackWaitlistJoined: (restaurantId: string, restaurantName: string) =>
      tracker.trackWaitlistJoined(restaurantId, restaurantName),
    setUserId: (userId: string) => tracker.setUserId(userId),
    clearUserId: () => tracker.clearUserId(),
    setUserProperties: (properties: MetaEventProperties) =>
      tracker.setUserProperties(properties),
    flush: () => tracker.flush(),
    setTestEventCode: (testCode: string) => tracker.setTestEventCode(testCode),
    forceFlush: () => tracker.forceFlush(),
    getDebugInfo: () => tracker.getDebugInfo(),
  };
}
