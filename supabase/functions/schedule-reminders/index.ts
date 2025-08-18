// Supabase Edge Function: schedule-reminders
// Invokes DB helpers to enqueue booking reminders, review reminders, and offer expiry notices.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const secret = req.headers.get("authorization");
    if (
      !secret ||
      secret !== `Bearer ${Deno.env.get("EDGE_FUNCTION_SECRET")}`
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const results: any = {};

    const { error: err1 } = await supabase.rpc("enqueue_booking_reminders");
    if (err1) results.booking_reminders = String(err1);

    const { error: err2 } = await supabase.rpc("enqueue_review_reminders");
    if (err2) results.review_reminders = String(err2);

    const { error: err3 } = await supabase.rpc("enqueue_offer_expiry_notices");
    if (err3) results.offer_expiry = String(err3);

    const ok = Object.keys(results).length === 0;

    return new Response(
      JSON.stringify({ status: ok ? "ok" : "partial", details: results }),
      {
        headers: { "content-type": "application/json" },
        status: ok ? 200 : 207,
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
