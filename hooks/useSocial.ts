// hooks/useSocial.ts
import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

// ... (imports)

export function useSocial() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // ... (existing functions)

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [profile?.id]);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  // Real-time updates for notifications
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`social-notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    loading,
    notifications,
    markNotificationAsRead,
    // ... (rest of the hook)
  };
}
