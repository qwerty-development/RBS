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
  phone: string;       // E.164, e.g. "+96171357429"
  code: string;        // "123456"
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

    // Extract user from JWT (Authorization: Bearer <token>)
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json(401, { error: "missing_jwt" });

    const { data: authUser, error: authErr } = await supa.auth.getUser(jwt);
    if (authErr || !authUser?.user) return json(401, { error: "invalid_jwt" });
    const userId = authUser.user.id;

    const { phone, code } = (await req.json()) as Body;
    if (!phone || !phone.startsWith("+") || !code) {
      return json(400, { error: "phone (E.164) and code are required" });
    }

    // Check if phone number is already in use by another user
    // This is a double-check (should have been caught in send-otp)
    const { data: existingProfile } = await supa
      .from("profiles")
      .select("id, phone_number")
      .eq("phone_number", phone)
      .neq("id", userId)
      .single();

    if (existingProfile) {
      return json(400, { error: "phone_already_in_use" });
    }

    // Check code with Twilio Verify
    const form = new URLSearchParams({ To: phone, Code: code });
    const r = await fetch(
      `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
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

    if (!r.ok || data.status !== "approved") {
      return json(400, { error: "invalid_code" });
    }

    // Mark user as verified and save canonical number
    const { error: upErr } = await supa
      .from("profiles")
      .update({
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        phone_number: phone,
      })
      .eq("id", userId);

    if (upErr) {
      console.error("Profile update error:", upErr);
      return json(500, { error: "profile_update_failed" });
    }

    return json(200, { status: "verified" });
  } catch (e) {
    console.error("Exception in verify-otp:", e);
    return json(500, { error: e?.message ?? "unknown_error" });
  }
});

