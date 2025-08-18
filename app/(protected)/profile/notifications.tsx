import React, { useState, useCallback, useEffect } from "react";
import { View, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Calendar,
  Heart,
  Star,
  Trophy,
  Clock,
  ChevronRight,
  ArrowLeft,
} from "lucide-react-native";

import { NotificationsScreenSkeleton } from "@/components/skeletons/NotificationScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { OptimizedList } from "@/components/ui/optimized-list";
import { supabase } from "@/config/supabase";

// Notification types aligned with backend categories
type NotificationCategory =
  | "booking"
  | "waitlist"
  | "offers"
  | "reviews"
  | "loyalty"
  | "system";

type NotificationType = string; // server-defined types per category

interface Notification {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  deeplink?: string;
  data?: any;
}

// Removed mock notifications; will fetch from database

export default function NotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, category, type, title, message, data, created_at, read, deeplink",
      )
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setNotifications(
        data.map((n: any) => ({
          id: n.id,
          category: n.category,
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data,
          created_at: n.created_at,
          read: !!n.read,
          deeplink: n.deeplink || undefined,
        })),
      );
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleSendTest = useCallback(async () => {
    if (!profile?.id) return;
    const { error } = await supabase.rpc("enqueue_notification", {
      p_user_id: profile.id,
      p_category: "system",
      p_type: "test_notification",
      p_title: "Test notification",
      p_message: `This is a test notification at ${new Date().toLocaleString()}`,
      p_data: { debug: true },
      p_deeplink: "app://profile/notifications",
      p_channels: ["inapp", "push"],
    });
    if (!error) {
      await fetchNotifications();
    }
  }, [profile?.id, fetchNotifications]);

  const handleTriggerNotify = useCallback(async () => {
    try {
      // Call the notify Edge Function directly to process the outbox
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/notify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabase.supabaseKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      const result = await response.json();
      console.log("Notify result:", result);
      await fetchNotifications();
    } catch (error) {
      console.error("Error triggering notify:", error);
    }
  }, [fetchNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      // Mark as read in DB and locally
      await supabase
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );

      // Navigate based on deeplink/category
      if (notification.deeplink) {
        const deeplink = notification.deeplink.startsWith("app://")
          ? notification.deeplink.replace("app://", "/")
          : notification.deeplink;
        router.push(deeplink as any);
        return;
      }

      switch (notification.category) {
        case "booking":
          if (notification.data?.bookingId) {
            router.push({
              pathname: "/booking/[id]",
              params: { id: notification.data.bookingId },
            });
          } else {
            router.push("/bookings");
          }
          break;
        case "reviews":
          if (notification.data?.restaurantId) {
            router.push({
              pathname: "/restaurant/[id]",
              params: { id: notification.data.restaurantId },
            });
          } else {
            router.push("/profile/reviews");
          }
          break;
        case "offers":
          router.push("/profile/my-rewards");
          break;
        case "loyalty":
          router.push("/profile/loyalty");
          break;
        case "waitlist":
          router.push("/waiting-list");
          break;
        default:
          break;
      }
    },
    [router],
  );

  const getNotificationIcon = (category: NotificationCategory) => {
    switch (category) {
      case "booking":
        return Calendar;
      case "offers":
        return Heart;
      case "reviews":
        return Star;
      case "loyalty":
        return Trophy;
      case "waitlist":
        return Clock;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (category: NotificationCategory) => {
    switch (category) {
      case "booking":
        return "#3b82f6"; // blue
      case "offers":
        return "#ef4444"; // red
      case "reviews":
        return "#f59e0b"; // amber
      case "loyalty":
        return "#10b981"; // green
      case "waitlist":
        return "#8b5cf6"; // purple
      default:
        return "#6b7280"; // gray
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const Icon = getNotificationIcon(item.category);
    const color = getNotificationColor(item.category);

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        className={`flex-row items-start p-4 border-b border-border ${
          !item.read ? "bg-primary/5" : ""
        }`}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={20} color={color} />
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-medium">{item.title}</Text>
            <Muted className="text-xs">
              {new Date(item.created_at).toLocaleString()}
            </Muted>
          </View>
          <Muted className="text-sm mt-1">{item.message}</Muted>
        </View>
        <ChevronRight size={20} color="#666" />
      </Pressable>
    );
  };

  if (loading) {
    return <NotificationsScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => router.back()}
              className="mr-3 p-2 rounded-full bg-muted"
            >
              <ArrowLeft
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
            <H2 className="text-2xl">Notifications</H2>
          </View>
          {/* Mark all as read */}
          {notifications.some((n) => !n.read) && (
            <Pressable
              onPress={async () => {
                await supabase
                  .from("notifications")
                  .update({ read: true, read_at: new Date().toISOString() })
                  .eq("user_id", profile?.id)
                  .eq("read", false);
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, read: true })),
                );
              }}
              className="px-3 py-2 rounded-md bg-primary/10"
            >
              <Text className="text-primary font-medium">Mark all as read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Actions */}
      <View className="px-4 mb-2 gap-2">
        <Pressable
          onPress={handleSendTest}
          className="px-4 py-3 rounded-md bg-primary"
        >
          <Text className="text-primary-foreground font-semibold text-center">
            Send test notification
          </Text>
        </Pressable>
        <Pressable
          onPress={handleTriggerNotify}
          className="px-4 py-3 rounded-md bg-secondary"
        >
          <Text className="text-secondary-foreground font-semibold text-center">
            Process outbox now
          </Text>
        </Pressable>
      </View>

      {/* Notifications List */}
      <OptimizedList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <Bell size={48} color="#666" />
            <Text className="text-lg font-medium mt-4">
              No notifications yet
            </Text>
            <Muted className="text-center mt-2">
              We'll notify you when there's something new
            </Muted>
          </View>
        }
      />
    </SafeAreaView>
  );
}
