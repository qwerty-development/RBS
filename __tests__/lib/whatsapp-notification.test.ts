/**
 * Tests for WhatsApp notification functionality
 */

import {
  notifyRestaurantWhatsApp,
  notifyRestaurantWhatsAppNonBlocking,
} from "@/lib/whatsapp-notification";

// Mock fetch globally
global.fetch = jest.fn();

describe("WhatsApp Notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("notifyRestaurantWhatsApp", () => {
    it("should send a successful notification", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          event: "created",
          sid: "SM1234567890abcdef",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await notifyRestaurantWhatsApp("test-booking-id");

      expect(result).toEqual({
        ok: true,
        event: "created",
        sid: "SM1234567890abcdef",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://xsovqvbigdettnpeisjs.supabase.co/functions/v1/notify-restaurant-whatsapp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            booking_id: "test-booking-id",
          }),
        },
      );
    });

    it("should handle HTTP errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({
          ok: false,
          error: "Internal server error",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await notifyRestaurantWhatsApp("test-booking-id");

      expect(result).toEqual({
        ok: false,
        error: "Internal server error",
      });
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await notifyRestaurantWhatsApp("test-booking-id");

      expect(result).toEqual({
        ok: false,
        error: "Network error",
      });
    });

    it("should handle ignored notifications", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          ignored: "status_not_pending",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await notifyRestaurantWhatsApp("test-booking-id");

      expect(result).toEqual({
        ok: true,
        ignored: "status_not_pending",
      });
    });

    it("should handle missing restaurant phone", async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        json: async () => ({
          ok: false,
          reason: "no_restaurant_phone",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await notifyRestaurantWhatsApp("test-booking-id");

      expect(result).toEqual({
        ok: false,
        reason: "no_restaurant_phone",
      });
    });
  });

  describe("notifyRestaurantWhatsAppNonBlocking", () => {
    it("should not throw errors and log warnings for failures", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({
          ok: false,
          error: "Test error",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      // This should not throw
      await notifyRestaurantWhatsAppNonBlocking("test-booking-id");

      expect(consoleSpy).toHaveBeenCalledWith(
        "WhatsApp notification failed (non-blocking):",
        {
          bookingId: "test-booking-id",
          error: "Test error",
          reason: undefined,
        },
      );

      consoleSpy.mockRestore();
    });

    it("should log success messages", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          event: "created",
          sid: "SM1234567890abcdef",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await notifyRestaurantWhatsAppNonBlocking("test-booking-id");

      expect(consoleSpy).toHaveBeenCalledWith(
        "WhatsApp notification sent successfully:",
        {
          bookingId: "test-booking-id",
          sid: "SM1234567890abcdef",
        },
      );

      consoleSpy.mockRestore();
    });

    it("should log ignored messages", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const mockResponse = {
        ok: true,
        json: async () => ({
          ok: true,
          ignored: "status_not_pending",
        }),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await notifyRestaurantWhatsAppNonBlocking("test-booking-id");

      expect(consoleSpy).toHaveBeenCalledWith(
        "WhatsApp notification ignored:",
        {
          bookingId: "test-booking-id",
          reason: "status_not_pending",
        },
      );

      consoleSpy.mockRestore();
    });
  });
});
