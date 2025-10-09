import { useCallback, useState } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

const SEND_OTP_FUNCTION = "send-otp";
const VERIFY_OTP_FUNCTION = "verify-otp";

interface OTPResult {
  success: boolean;
  error?: string;
}

/**
 * Send OTP to phone number (E.164 format)
 */
export async function sendOTP(phoneE164: string): Promise<OTPResult> {
  try {
    console.log("[sendOTP] Calling edge function with phone:", phoneE164);
    console.log("[sendOTP] Request body:", JSON.stringify({ phone: phoneE164 }));
    
    // Get session to pass JWT for phone number ownership check
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    const headers: any = {};
    if (session) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    const response = await supabase.functions.invoke(SEND_OTP_FUNCTION, {
      body: { phone: phoneE164 },
      headers,
    });

    console.log("[sendOTP] Response data:", response.data);
    console.log("[sendOTP] Response error:", response.error);

    // Try to get more error details
    if (response.error) {
      console.error("[sendOTP] Error details:");
      console.error("  - Status:", (response.error as any).context?.status);
      
      // Try to read the response body to get the actual error
      try {
        const errorContext = (response.error as any).context;
        if (errorContext) {
          const bodyText = await errorContext.text?.();
          console.error("  - Response body text:", bodyText);
          
          if (bodyText) {
            try {
              const bodyJson = JSON.parse(bodyText);
              console.error("  - Response body JSON:", JSON.stringify(bodyJson, null, 2));
              
              // Handle specific errors from edge function
              if (bodyJson.error) {
                if (bodyJson.error === "phone_number_blocked") {
                  return { success: false, error: "This phone number is blocked. Please contact support or use a different number." };
                } else if (bodyJson.error === "phone_already_in_use") {
                  return { success: false, error: "This phone number is already registered to another account." };
                } else if (bodyJson.error === "phone_already_verified") {
                  return { success: false, error: "Your phone number is already verified." };
                } else if (bodyJson.error === "max_send_attempts_reached") {
                  return { success: false, error: "Too many verification attempts. Please try again later." };
                } else if (bodyJson.error === "too_many_requests") {
                  return { success: false, error: "Too many requests. Please wait a few minutes and try again." };
                } else if (bodyJson.error === "invalid_phone_number") {
                  return { success: false, error: "Invalid phone number format." };
                } else {
                  return { success: false, error: `${bodyJson.error}` };
                }
              }
            } catch (parseError) {
              console.error("  - Could not parse body as JSON");
            }
          }
        }
      } catch (bodyError) {
        console.error("  - Could not read response body:", bodyError);
      }
      
      // Fallback error messages
      let errorMessage = "Failed to send verification code";
      if (response.error.message?.includes("not found")) {
        errorMessage = "Verification service not available. Please contact support.";
      } else if (response.error.message?.includes("FunctionsRelayError")) {
        errorMessage = "Service temporarily unavailable. Please try again.";
      } else if (response.error.message) {
        errorMessage = response.error.message;
      }
      
      return { success: false, error: errorMessage };
    }

    if (response.data?.error) {
      console.error("[sendOTP] Error in response data:", response.data.error);
      
      // Handle specific errors
      if (response.data.error === "phone_number_blocked") {
        return { success: false, error: "This phone number is blocked. Please use a different number." };
      } else if (response.data.error === "phone_already_in_use") {
        return { success: false, error: "This phone number is already registered to another account." };
      } else if (response.data.error === "phone_already_verified") {
        return { success: false, error: "Your phone number is already verified." };
      } else if (response.data.error === "max_send_attempts_reached") {
        return { success: false, error: "Too many verification attempts. Please try again later." };
      } else if (response.data.error === "too_many_requests") {
        return { success: false, error: "Too many requests. Please wait a few minutes and try again." };
      }
      
      return { success: false, error: response.data.error };
    }

    console.log("[sendOTP] Success!");
    return { success: true };
  } catch (error: any) {
    console.error("[sendOTP] Exception caught:", error);
    console.error("[sendOTP] Exception stack:", error.stack);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred. Please try again." 
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  code: string,
  phoneE164: string
): Promise<OTPResult> {
  try {
    console.log("[verifyOTP] Getting session...");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      console.error("[verifyOTP] No active session");
      return { success: false, error: "Not authenticated. Please sign in again." };
    }

    console.log("[verifyOTP] Calling edge function with code and phone:", { 
      codeLength: code.length, 
      phone: phoneE164 
    });

    const response = await supabase.functions.invoke(
      VERIFY_OTP_FUNCTION,
      {
        body: { phone: phoneE164, code },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    console.log("[verifyOTP] Response data:", response.data);
    console.log("[verifyOTP] Response error:", response.error);

    if (response.error) {
      console.error("[verifyOTP] Error from edge function:", response.error);
      console.error("  - Status:", (response.error as any).context?.status);
      
      // Try to read the response body to get the actual error
      try {
        const errorContext = (response.error as any).context;
        if (errorContext) {
          const bodyText = await errorContext.text?.();
          console.error("  - Response body text:", bodyText);
          
          if (bodyText) {
            try {
              const bodyJson = JSON.parse(bodyText);
              console.error("  - Response body JSON:", JSON.stringify(bodyJson, null, 2));
              
              // Handle specific errors from edge function
              if (bodyJson.error) {
                if (bodyJson.error === "invalid_code") {
                  return { success: false, error: "Invalid verification code. Please try again." };
                } else if (bodyJson.error === "phone_already_in_use") {
                  return { success: false, error: "This phone number is already registered to another account." };
                } else if (bodyJson.error === "profile_update_failed") {
                  return { success: false, error: "Failed to update your profile. Please try again." };
                } else if (bodyJson.error === "missing_jwt" || bodyJson.error === "invalid_jwt") {
                  return { success: false, error: "Session expired. Please sign in again." };
                } else {
                  return { success: false, error: `Error: ${bodyJson.error}` };
                }
              }
            } catch (parseError) {
              console.error("  - Could not parse body as JSON");
            }
          }
        }
      } catch (bodyError) {
        console.error("  - Could not read response body:", bodyError);
      }
      
      // Fallback error messages
      let errorMessage = "Failed to verify code";
      if (response.error.message?.includes("not found")) {
        errorMessage = "Verification service not available. Please contact support.";
      } else if (response.error.message?.includes("FunctionsRelayError")) {
        errorMessage = "Service temporarily unavailable. Please try again.";
      } else if (response.error.message) {
        errorMessage = response.error.message;
      }
      
      return { success: false, error: errorMessage };
    }

    if (response.data?.error) {
      console.error("[verifyOTP] Error in response data:", response.data.error);
      
      // Handle specific error cases
      if (response.data.error === "invalid_code") {
        return { success: false, error: "Invalid verification code. Please try again." };
      } else if (response.data.error === "missing_jwt") {
        return { success: false, error: "Authentication expired. Please sign in again." };
      } else if (response.data.error === "phone_already_in_use") {
        return { success: false, error: "This phone number is already registered to another account." };
      } else if (response.data.error === "profile_update_failed") {
        return { success: false, error: "Failed to update your profile. Please try again." };
      }
      
      return { success: false, error: response.data.error };
    }

    console.log("[verifyOTP] Success!");
    return { success: true };
  } catch (error: any) {
    console.error("[verifyOTP] Exception:", error);
    console.error("[verifyOTP] Exception stack:", error.stack);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred. Please try again." 
    };
  }
}

/**
 * Hook for phone verification with state management
 */
export function usePhoneVerification() {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = useCallback(async (phoneE164: string) => {
    setLoading(true);
    setError(null);

    const result = await sendOTP(phoneE164);

    setLoading(false);
    if (!result.success) {
      setError(result.error || null);
    }

    return result;
  }, []);

  const verifyCode = useCallback(
    async (code: string, phoneE164: string) => {
      setLoading(true);
      setError(null);

      const result = await verifyOTP(code, phoneE164);

      setLoading(false);
      if (!result.success) {
        setError(result.error || null);
      } else {
        // Refresh profile to get updated verification status
        await refreshProfile();
      }

      return result;
    },
    [refreshProfile]
  );

  const isVerified = profile?.phone_verified === true;
  const phoneNumber = profile?.phone_number;

  return {
    sendCode,
    verifyCode,
    loading,
    error,
    isVerified,
    phoneNumber,
  };
}

