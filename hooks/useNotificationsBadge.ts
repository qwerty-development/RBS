import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

export function useNotificationsBadge() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (!error && typeof count === "number") {
      setUnreadCount(count);
    }
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("read", false);
    await refreshCount();
  }, [userId, refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!userId) return;
    // Cleanup existing channel if user changes
    channelRef.current?.unsubscribe();

    const channel = supabase
      .channel(`notifications_badge_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          // Refresh on any insert/update/delete for this user
          refreshCount();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Optional: initial sync already done by refreshCount
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userId, refreshCount]);

  return { unreadCount, refreshCount, markAllAsRead };
}

