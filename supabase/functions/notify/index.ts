// Supabase Edge Function: notify
// Drains notification_outbox and sends push via Expo, emails via provider (TODO), logs results

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface OutboxItem {
  id: string;
  notification_id: string;
  user_id: string;
  channel: "push" | "email" | "sms" | "inapp";
  payload: any;
}

interface DeviceRow {
  expo_push_token: string | null;
  enabled: boolean;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

    // Fetch a small batch of queued notifications
    const { data: outbox, error } = await supabase
      .from("notification_outbox")
      .select("id, notification_id, user_id, channel, payload")
      .eq("status", "queued")
      .limit(50);

    if (error) throw error;

    for (const item of (outbox || []) as OutboxItem[]) {
      try {
        if (item.channel === "push") {
          // Get tokens
          const { data: devices, error: devErr } = await supabase
            .from("user_devices")
            .select("expo_push_token, enabled")
            .eq("user_id", item.user_id)
            .eq("enabled", true);
          if (devErr) throw devErr;

          const tokens = (devices || [])
            .map((d: DeviceRow) => d.expo_push_token)
            .filter(Boolean) as string[];

          if (tokens.length === 0) {
            await supabase
              .from("notification_outbox")
              .update({ status: "skipped", attempts: 1 })
              .eq("id", item.id);
            continue;
          }

          const messages = tokens.map((to) => ({
            to,
            sound: "default",
            title: item.payload?.title,
            body: item.payload?.message,
            data: item.payload?.data
              ? {
                  ...item.payload.data,
                  deeplink: item.payload?.deeplink,
                  category: item.payload?.category,
                  type: item.payload?.type,
                }
              : {
                  deeplink: item.payload?.deeplink,
                  category: item.payload?.category,
                  type: item.payload?.type,
                },
            priority: "high",
          }));

          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messages),
          });
          const json = await res.json().catch(() => ({}));

          await supabase
            .from("notification_outbox")
            .update({
              status: res.ok ? "sent" : "failed",
              attempts: 1,
              sent_at: new Date().toISOString(),
              error: res.ok ? null : JSON.stringify(json),
            })
            .eq("id", item.id);

          await supabase.from("notification_delivery_logs").insert({
            outbox_id: item.id,
            provider: "expo",
            status: res.ok ? "ok" : "error",
            error: res.ok ? null : JSON.stringify(json),
          });
        } else if (item.channel === "inapp") {
          await supabase
            .from("notification_outbox")
            .update({
              status: "sent",
              attempts: 1,
              sent_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        } else if (item.channel === "email") {
          // TODO: integrate with email provider
          await supabase
            .from("notification_outbox")
            .update({ status: "skipped", attempts: 1 })
            .eq("id", item.id);
        } else if (item.channel === "sms") {
          // TODO: integrate with SMS provider
          await supabase
            .from("notification_outbox")
            .update({ status: "skipped", attempts: 1 })
            .eq("id", item.id);
        }
      } catch (err) {
        await supabase
          .from("notification_outbox")
          .update({ status: "failed", attempts: 1, error: String(err) })
          .eq("id", item.id);
      }
    }

    return new Response(JSON.stringify({ processed: (outbox || []).length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
