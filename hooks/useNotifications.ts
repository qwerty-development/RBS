// hooks/useNotifications.ts
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";
import type { Database } from "@/types/supabase-generated";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const notificationData = data || [];
      setNotifications(notificationData);
      
      // Count unread notifications
      const unread = notificationData.filter(n => !n.read_at).length;
      setUnreadCount(unread);
      
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, [user]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      const readTimestamp = new Date().toISOString();
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || readTimestamp }))
      );

      setUnreadCount(0);

    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [user, notifications]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Update unread count if deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read_at) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }, [user, notifications]);

  // Listen for real-time notification updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = realtimeSubscriptionService.subscribeToUser({
      userId: user.id,
      onNotificationChange: (payload) => {
        console.log("Notification real-time update:", payload);

        if (payload.eventType === "INSERT" && payload.new) {
          // New notification received
          setNotifications(prev => [payload.new!, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Could trigger push notification or sound here
          console.log("🔔 New notification received:", payload.new.title);
          
        } else if (payload.eventType === "UPDATE" && payload.new && payload.old) {
          // Notification updated (likely read status)
          setNotifications(prev => 
            prev.map(n => n.id === payload.new!.id ? payload.new! : n)
          );

          // Update unread count if read status changed
          if (!payload.old.read_at && payload.new.read_at) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          } else if (payload.old.read_at && !payload.new.read_at) {
            setUnreadCount(prev => prev + 1);
          }

        } else if (payload.eventType === "DELETE" && payload.old) {
          // Notification deleted
          setNotifications(prev => prev.filter(n => n.id !== payload.old!.id));
          
          if (!payload.old.read_at) {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      }
    });

    return unsubscribe;
  }, [user]);

  // Load notifications on mount
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  // Get notifications by type
  const getNotificationsByType = useCallback((type: string) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  // Get recent notifications (last 24 hours)
  const getRecentNotifications = useCallback(() => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    return notifications.filter(n => 
      new Date(n.created_at || 0) > twentyFourHoursAgo
    );
  }, [notifications]);

  return {
    // Data
    notifications,
    unreadCount,
    loading,

    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,

    // Utilities
    getNotificationsByType,
    getRecentNotifications,
    
    // State
    hasUnread: unreadCount > 0,
    isEmpty: notifications.length === 0
  };
};
