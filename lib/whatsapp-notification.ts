/**
 * Utility functions for sending WhatsApp notifications via Supabase Edge Functions
 *
 * This module handles sending WhatsApp messages to restaurants when bookings are created.
 * The notifications are sent to the restaurant's WhatsApp number using Twilio's WhatsApp API
 * via a Supabase Edge Function.
 *
 * The edge function expects:
 * - booking_id: The UUID of the booking that was just created
 *
 * The edge function will:
 * - Fetch the booking details from the database
 * - Get the restaurant's WhatsApp number
 * - Get the user's name from their profile
 * - Send a formatted WhatsApp message with booking details
 *
 * Integration points:
 * - useBookingCreate.ts: Called after instant and request bookings
 * - useBookingConfirmation.ts: Called after booking confirmations from availability screen
 */

import { supabase } from "@/config/supabase";

const WHATSAPP_FUNCTION_URL =
  "https://xsovqvbigdettnpeisjs.supabase.co/functions/v1/notify-restaurant-whatsapp";

export interface WhatsAppNotificationResult {
  ok: boolean;
  event?: string;
  sid?: string;
  error?: string;
  ignored?: string;
  reason?: string;
}

/**
 * Sends a WhatsApp notification to the restaurant about a new booking
 * @param bookingId - The ID of the booking that was just created
 * @returns Promise<WhatsAppNotificationResult> - The result of the notification attempt
 */
export async function notifyRestaurantWhatsApp(
  bookingId: string,
): Promise<WhatsAppNotificationResult> {
  try {
    // Get the current session token for authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error(
        "❌ No valid session for WhatsApp notification:",
        sessionError,
      );
      return {
        ok: false,
        error: "Authentication required",
      };
    }

    const requestBody = {
      booking_id: bookingId,
    };

    const response = await fetch(WHATSAPP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp notification failed:", result);
      return {
        ok: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    console.error("Error calling WhatsApp notification function:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sends WhatsApp notification as a non-blocking operation
 * This function will not throw errors and will log them instead
 * @param bookingId - The ID of the booking that was just created
 */
export async function notifyRestaurantWhatsAppNonBlocking(
  bookingId: string,
): Promise<void> {
  try {
    const result = await notifyRestaurantWhatsApp(bookingId);

    if (!result.ok) {
      console.warn("WhatsApp notification failed (non-blocking):", {
        bookingId,
        error: result.error,
        reason: result.reason,
      });
    } else if (result.ignored) {
    } else {
    }
  } catch (error) {
    console.error(
      "Unexpected error in non-blocking WhatsApp notification:",
      error,
    );
  }
}

/**
 * Sends a WhatsApp notification to the restaurant about a booking cancellation
 * @param bookingId - The ID of the booking that was cancelled
 * @returns Promise<WhatsAppNotificationResult> - The result of the notification attempt
 */
export async function notifyRestaurantWhatsAppCancel(
  bookingId: string,
): Promise<WhatsAppNotificationResult> {
  try {
    // Get the current session token for authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      console.error(
        "❌ No valid session for WhatsApp cancel notification:",
        sessionError,
      );
      return {
        ok: false,
        error: "Authentication required",
      };
    }

    const requestBody = {
      booking_id: bookingId,
    };

    const CANCEL_FUNCTION_URL =
      "https://xsovqvbigdettnpeisjs.supabase.co/functions/v1/notify-restaurant-whatsapp-cancel";

    const response = await fetch(CANCEL_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ WhatsApp cancel notification failed:", result);
      return {
        ok: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return result;
  } catch (error) {
    console.error(
      "Error calling WhatsApp cancel notification function:",
      error,
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sends WhatsApp cancel notification as a non-blocking operation
 * This function will not throw errors and will log them instead
 * @param bookingId - The ID of the booking that was cancelled
 */
export async function notifyRestaurantWhatsAppCancelNonBlocking(
  bookingId: string,
): Promise<void> {
  try {
    const result = await notifyRestaurantWhatsAppCancel(bookingId);

    if (!result.ok) {
      console.warn("WhatsApp cancel notification failed (non-blocking):", {
        bookingId,
        error: result.error,
        reason: result.reason,
      });
    } else if (result.ignored) {
      console.log("WhatsApp cancel notification ignored:", result.ignored);
    } else {
      console.log(
        "WhatsApp cancel notification sent successfully:",
        result.sid,
      );
    }
  } catch (error) {
    console.error(
      "Unexpected error in non-blocking WhatsApp cancel notification:",
      error,
    );
  }
}
