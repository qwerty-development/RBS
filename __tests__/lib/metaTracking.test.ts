// __tests__/lib/metaTracking.test.ts
import { metaTracker, MetaTrackingService } from "../../lib/metaTracking";
import { AppEventsLogger } from "react-native-fbsdk-next";

// Mock react-native-fbsdk-next
jest.mock("react-native-fbsdk-next", () => ({
  AppEventsLogger: {
    setAutoLogAppEventsEnabled: jest.fn(),
    setAdvertiserIDCollectionEnabled: jest.fn(),
    setUserID: jest.fn(),
    clearUserID: jest.fn(),
    logEvent: jest.fn(),
    flush: jest.fn(),
    setUserData: jest.fn(),
  },
  AppEventsConstants: {
    EVENT_NAME_ACTIVATED_APP: "fb_mobile_activate_app",
    EVENT_NAME_COMPLETED_REGISTRATION: "fb_mobile_complete_registration",
    EVENT_NAME_PURCHASED: "fb_mobile_purchase",
    EVENT_NAME_ADDED_TO_CART: "fb_mobile_add_to_cart",
    EVENT_NAME_UNLOCKED_ACHIEVEMENT: "fb_mobile_unlock_achievement",
    EVENT_NAME_VIEWED_CONTENT: "fb_mobile_content_view",
    EVENT_NAME_SEARCHED: "fb_mobile_search",
    EVENT_PARAM_CONTENT_TYPE: "fb_content_type",
    EVENT_PARAM_CONTENT_ID: "fb_content_id",
    EVENT_PARAM_CURRENCY: "fb_currency",
    EVENT_PARAM_REGISTRATION_METHOD: "fb_registration_method",
    EVENT_PARAM_SEARCH_STRING: "fb_search_string",
    EVENT_PARAM_NUM_ITEMS: "fb_num_items",
    EVENT_PARAM_DESCRIPTION: "fb_description",
  },
}));

// Mock internal dependencies
jest.mock("../../lib/monitoring", () => ({
  appMonitor: {
    log: jest.fn(),
    trackEvent: jest.fn(),
  },
}));

jest.mock("../../lib/security", () => ({
  InputSanitizer: {
    sanitizeForLogging: jest.fn((input) => input),
  },
}));

describe("MetaTrackingService", () => {
  let tracker: MetaTrackingService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get fresh instance (singleton pattern)
    tracker = MetaTrackingService.getInstance();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = MetaTrackingService.getInstance();
      const instance2 = MetaTrackingService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should export the metaTracker singleton", () => {
      expect(metaTracker).toBeDefined();
      expect(metaTracker).toBe(MetaTrackingService.getInstance());
    });
  });

  describe("Initialization", () => {
    it("should enable auto app events and advertiser ID collection", () => {
      expect(AppEventsLogger.setAutoLogAppEventsEnabled).toHaveBeenCalledWith(
        true,
      );
      expect(
        AppEventsLogger.setAdvertiserIDCollectionEnabled,
      ).toHaveBeenCalledWith(true);
    });
  });

  describe("User Management", () => {
    it("should set user ID", () => {
      const userId = "test-user-123";
      tracker.setUserId(userId);

      expect(AppEventsLogger.setUserID).toHaveBeenCalledWith(userId);
    });

    it("should clear user ID", () => {
      tracker.clearUserId();

      expect(AppEventsLogger.clearUserID).toHaveBeenCalled();
    });

    it("should set user properties", () => {
      const properties = {
        user_tier: "gold",
        total_bookings: 5,
        preferred_cuisine: "lebanese",
      };

      tracker.setUserProperties(properties);

      expect(AppEventsLogger.setUserData).toHaveBeenCalledWith(properties);
    });
  });

  describe("Event Tracking", () => {
    describe("App Install", () => {
      it("should track app install", () => {
        tracker.trackAppInstall();

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_activate_app",
          {},
        );
      });
    });

    describe("Registration", () => {
      it("should track email registration", () => {
        const registrationData = {
          method: "email" as const,
          hasProfileData: true,
        };

        tracker.trackRegistration(registrationData);

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_complete_registration",
          {
            fb_registration_method: "email",
            fb_profile_data_available: "1",
          },
        );
      });

      it("should track OAuth registration", () => {
        const registrationData = {
          method: "google" as const,
          hasProfileData: false,
        };

        tracker.trackRegistration(registrationData);

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_complete_registration",
          {
            fb_registration_method: "google",
            fb_profile_data_available: "0",
          },
        );
      });
    });

    describe("First Booking", () => {
      it("should track first booking as purchase event", () => {
        const bookingData = {
          restaurantId: "rest-123",
          restaurantName: "Test Restaurant",
          bookingDate: "2025-01-15",
          partySize: 4,
          tableType: "patio",
          currency: "USD",
          value: 150,
        };

        tracker.trackFirstBooking(bookingData);

        // Should call both standard purchase event and custom first booking event
        expect(AppEventsLogger.logEvent).toHaveBeenCalledTimes(2);

        // Check purchase event
        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_purchase",
          {
            fb_content_type: "booking",
            fb_content_id: "rest-123",
            fb_currency: "USD",
            restaurant_name: "Test Restaurant",
            booking_date: "2025-01-15",
            party_size: "4",
            table_type: "patio",
            is_first_booking: "1",
          },
          150,
        );

        // Check custom event
        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "FirstBookingCompleted",
          {
            restaurant_id: "rest-123",
            restaurant_name: "Test Restaurant",
            booking_date: "2025-01-15",
            party_size: "4",
            table_type: "patio",
          },
        );
      });
    });

    describe("Booking Confirmation", () => {
      it("should track booking confirmation", () => {
        const bookingData = {
          restaurantId: "rest-456",
          restaurantName: "Another Restaurant",
          bookingDate: "2025-01-20",
          partySize: 2,
        };

        tracker.trackBookingConfirmation(bookingData);

        expect(AppEventsLogger.logEvent).toHaveBeenCalledTimes(2);

        // Check add to cart event
        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_add_to_cart",
          {
            fb_content_type: "booking",
            fb_content_id: "rest-456",
            fb_currency: "USD",
            restaurant_name: "Another Restaurant",
            booking_date: "2025-01-20",
            party_size: "2",
            table_type: "standard",
          },
          0,
        );
      });
    });

    describe("Loyalty Points Earned", () => {
      it("should track loyalty points earned", () => {
        const loyaltyData = {
          restaurantId: "rest-789",
          restaurantName: "Loyalty Restaurant",
          pointsEarned: 50,
          totalPoints: 250,
          activityType: "BOOKING_COMPLETED",
        };

        tracker.trackLoyaltyPointsEarned(loyaltyData);

        expect(AppEventsLogger.logEvent).toHaveBeenCalledTimes(2);

        // Check achievement unlocked event
        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_unlock_achievement",
          {
            fb_description: "Earned 50 loyalty points",
            restaurant_id: "rest-789",
            restaurant_name: "Loyalty Restaurant",
            points_earned: "50",
            total_points: "250",
            activity_type: "BOOKING_COMPLETED",
          },
        );

        // Check custom loyalty event with value
        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "LoyaltyPointsEarned",
          {
            restaurant_id: "rest-789",
            restaurant_name: "Loyalty Restaurant",
            points_earned: "50",
            total_points: "250",
            activity_type: "BOOKING_COMPLETED",
          },
          50,
        );
      });
    });

    describe("Additional Events", () => {
      it("should track screen views", () => {
        tracker.trackScreenView("RestaurantList");

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_content_view",
          {
            fb_content_type: "screen",
            screen_name: "RestaurantList",
          },
        );
      });

      it("should track search performed", () => {
        tracker.trackSearchPerformed("italian food", 15);

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_search",
          {
            fb_search_string: "italian food",
            fb_num_items: "15",
          },
        );
      });

      it("should track restaurant viewed", () => {
        tracker.trackRestaurantViewed("rest-001", "Best Pizza Place");

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "fb_mobile_content_view",
          {
            fb_content_type: "restaurant",
            fb_content_id: "rest-001",
            restaurant_name: "Best Pizza Place",
          },
        );
      });

      it("should track waitlist joined", () => {
        tracker.trackWaitlistJoined("rest-002", "Popular Restaurant");

        expect(AppEventsLogger.logEvent).toHaveBeenCalledWith(
          "WaitlistJoined",
          {
            restaurant_id: "rest-002",
            restaurant_name: "Popular Restaurant",
          },
        );
      });
    });
  });

  describe("Utility Methods", () => {
    it("should flush events", () => {
      tracker.flush();

      expect(AppEventsLogger.flush).toHaveBeenCalled();
    });

    it("should return debug info", () => {
      const userId = "debug-user-123";
      tracker.setUserId(userId);

      const debugInfo = tracker.getDebugInfo();

      expect(debugInfo).toEqual({
        isInitialized: true,
        userId: userId,
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle tracking errors gracefully", () => {
      // Mock AppEventsLogger to throw an error
      (AppEventsLogger.logEvent as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Mock tracking error");
      });

      // Should not throw an error
      expect(() => {
        tracker.trackAppInstall();
      }).not.toThrow();
    });
  });
});
