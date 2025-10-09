// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;
const BASIC_AUTH = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

type Body = {
  phone: string;                   // E.164, e.g. "+96171357429"
  channel?: "sms" | "whatsapp";    // default: "sms"
};

function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { phone, channel = "sms" } = (await req.json()) as Body;

    if (!phone || !phone.startsWith("+")) {
      return json(400, { error: "phone must be E.164 (e.g. +96171357429)" });
    }

    // Get user from JWT (optional - send-otp can be called without auth for initial check)
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    let currentUserId: string | null = null;
    
    if (jwt) {
      const { data: authUser } = await supa.auth.getUser(jwt);
      currentUserId = authUser?.user?.id || null;
    }

    // IMPORTANT: Check if phone number is already in use BEFORE sending SMS (to save money!)
    const { data: existingProfile } = await supa
      .from("profiles")
      .select("id, phone_number, phone_verified")
      .eq("phone_number", phone)
      .single();

    if (existingProfile) {
      // If this phone belongs to current user and is already verified, don't allow resend
      if (currentUserId && existingProfile.id === currentUserId && existingProfile.phone_verified) {
        return json(400, { error: "phone_already_verified" });
      }
      // If this phone belongs to a different user, block it
      if (currentUserId && existingProfile.id !== currentUserId) {
        return json(400, { error: "phone_already_in_use" });
      }
      // If no auth provided but phone exists, block it
      if (!currentUserId) {
        return json(400, { error: "phone_already_in_use" });
      }
    }

    // Start Twilio Verify
    const form = new URLSearchParams({ To: phone, Channel: channel });
    const r = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      }
    );

    const data = await r.json();
    
    if (!r.ok) {
      console.error("Twilio error:", data);
      
      // Handle specific Twilio errors
      let errorMessage = data?.message || "verify_start_failed";
      
      if (data?.code === 60200) {
        errorMessage = "phone_number_blocked";
      } else if (data?.code === 60205) {
        errorMessage = "max_send_attempts_reached";
      } else if (data?.code === 60203) {
        errorMessage = "max_check_attempts_reached";
      } else if (data?.code === 60212) {
        errorMessage = "too_many_requests";
      } else if (data?.message?.toLowerCase().includes("blocked")) {
        errorMessage = "phone_number_blocked";
      } else if (data?.message?.toLowerCase().includes("invalid")) {
        errorMessage = "invalid_phone_number";
      }
      
      return json(400, { error: errorMessage, twilio_code: data?.code });
    }

    return json(200, { status: "sent" });
  } catch (e) {
    console.error("Exception in send-otp:", e);
    return json(500, { error: e?.message ?? "unknown_error" });
  }
});

