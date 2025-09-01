// Simple unit test for Meta tracking without complex Jest setup
const { describe, it, expect, beforeEach, jest } = require("@jest/globals");

// Mock the dependencies directly
const mockLogEvent = jest.fn();
const mockSetUserID = jest.fn();
const mockClearUserID = jest.fn();
const mockFlush = jest.fn();

const mockAppEventsLogger = {
  logEvent: mockLogEvent,
  setUserID: mockSetUserID,
  clearUserID: mockClearUserID,
  flush: mockFlush,
};

const mockAppMonitor = {
  log: jest.fn(),
  trackEvent: jest.fn(),
};

const mockInputSanitizer = {
  sanitizeForLogging: jest.fn((input) => input),
};

// Mock modules
jest.doMock("react-native-fbsdk-next", () => ({
  AppEventsLogger: mockAppEventsLogger,
}));

jest.doMock("@/lib/monitoring", () => ({
  appMonitor: mockAppMonitor,
}));

jest.doMock("@/lib/security", () => ({
  InputSanitizer: mockInputSanitizer,
}));

// Now import our module
const { MetaTrackingService, metaTracker } = require("../lib/metaTracking");

describe("MetaTrackingService", () => {
  let tracker;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Get fresh instance
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

  describe("User Management", () => {
    it("should set user ID", () => {
      const userId = "test-user-123";
      tracker.setUserId(userId);

      expect(mockSetUserID).toHaveBeenCalledWith(userId);
      expect(mockAppMonitor.log).toHaveBeenCalledWith(
        "info",
        "Meta user ID set",
        { userId },
        "MetaTracking",
      );
    });

    it("should clear user ID", () => {
      tracker.clearUserId();

      expect(mockClearUserID).toHaveBeenCalled();
      expect(mockAppMonitor.log).toHaveBeenCalledWith(
        "info",
        "Meta user ID cleared",
        {},
        "MetaTracking",
      );
    });
  });

  describe("Event Tracking", () => {
    it("should track app install", () => {
      tracker.trackAppInstall();

      expect(mockLogEvent).toHaveBeenCalledWith("fb_mobile_activate_app", {});
    });

    it("should track registration", () => {
      const data = {
        method: "email",
        hasProfileData: true,
      };

      tracker.trackRegistration(data);

      expect(mockLogEvent).toHaveBeenCalledWith(
        "fb_mobile_complete_registration",
        {
          fb_registration_method: "email",
          fb_profile_data_available: "1",
        },
      );
    });

    it("should track first booking", () => {
      const data = {
        restaurantId: "rest-123",
        restaurantName: "Test Restaurant",
        bookingDate: "2025-01-15",
        partySize: 4,
        tableType: "patio",
        currency: "USD",
        value: 150,
      };

      tracker.trackFirstBooking(data);

      // Should track both standard purchase event and custom event
      expect(mockLogEvent).toHaveBeenCalledTimes(2);

      // Check purchase event
      expect(mockLogEvent).toHaveBeenNthCalledWith(
        1,
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
      expect(mockLogEvent).toHaveBeenNthCalledWith(2, "FirstBookingCompleted", {
        restaurant_id: "rest-123",
        restaurant_name: "Test Restaurant",
        booking_date: "2025-01-15",
        party_size: "4",
        table_type: "patio",
      });
    });

    it("should track booking confirmation", () => {
      const data = {
        restaurantId: "rest-456",
        restaurantName: "Another Restaurant",
        bookingDate: "2025-01-20",
        partySize: 2,
      };

      tracker.trackBookingConfirmation(data);

      expect(mockLogEvent).toHaveBeenCalledTimes(2);

      // Check add to cart event
      expect(mockLogEvent).toHaveBeenNthCalledWith(
        1,
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

    it("should track loyalty points earned", () => {
      const data = {
        restaurantId: "rest-789",
        restaurantName: "Loyalty Restaurant",
        pointsEarned: 50,
        totalPoints: 250,
        activityType: "BOOKING_COMPLETED",
      };

      tracker.trackLoyaltyPointsEarned(data);

      expect(mockLogEvent).toHaveBeenCalledTimes(2);

      // Check achievement event
      expect(mockLogEvent).toHaveBeenNthCalledWith(
        1,
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
    });
  });

  describe("Utility Methods", () => {
    it("should flush events", () => {
      tracker.flush();

      expect(mockFlush).toHaveBeenCalled();
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
      // Mock logEvent to throw an error
      mockLogEvent.mockImplementationOnce(() => {
        throw new Error("Mock tracking error");
      });

      // Should not throw an error
      expect(() => {
        tracker.trackAppInstall();
      }).not.toThrow();

      // Should log error
      expect(mockAppMonitor.log).toHaveBeenCalledWith(
        "error",
        "Failed to log Meta event",
        expect.objectContaining({
          eventName: "fb_mobile_activate_app",
          error: expect.any(Error),
        }),
        "MetaTracking",
      );
    });
  });
});
