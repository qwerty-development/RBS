import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  Calendar,
  Heart,
  Star,
  Trophy,
  MapPin,
  Clock,
  ChevronRight,
  ArrowLeft,
} from "lucide-react-native";

import { NotificationsScreenSkeleton } from "@/components/skeletons/NotificationScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useNotificationContext } from "@/context/notification-provider";
import { useAppStore } from "@/stores";
import { OptimizedList } from "@/components/ui/optimized-list";
import { NotificationHelpers } from "@/lib/NotificationHelpers";

// Use the notification type from the store
type StoreNotification = ReturnType<typeof useAppStore>['notifications'][0];

export default function NotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { unreadCount, markAllAsRead } = useNotificationContext();
  const { notifications, markNotificationRead } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // In a real app, you might sync with server here
    // For now, just simulate a refresh
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: StoreNotification) => {
      // Mark as read
      if (!notification.read) {
        markNotificationRead(notification.id);
      }

      // Navigate based on notification type and data
      const data = notification.data;

      switch (notification.type) {
        case "booking":
          if (data?.bookingId) {
            router.push(`/booking/${data.bookingId}`);
          } else {
            router.push("/bookings");
          }
          break;
        case "waitlist":
          if (data?.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          } else {
            router.push("/my-waitlists");
          }
          break;
        case "offer":
          if (data?.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          } else {
            router.push("/offers");
          }
          break;
        case "review":
          if (data?.restaurantId) {
            router.push(`/restaurant/${data.restaurantId}`);
          }
          break;
        case "loyalty":
          router.push("/profile/loyalty");
          break;
        case "system":
          // Handle system notifications based on action
          if (data?.action === 'view_notifications') {
            // Already on notifications screen
          } else if (data?.url) {
            // Open external URL if provided
          }
          break;
        default:
          break;
      }
    },
    [router, markNotificationRead],
  );

  const getNotificationIcon = (type: StoreNotification['type']) => {
    switch (type) {
      case "booking":
        return Calendar;
      case "waitlist":
        return Clock;
      case "offer":
        return Heart;
      case "review":
        return Star;
      case "loyalty":
        return Trophy;
      case "system":
        return Bell;
      case "success":
        return Calendar;
      case "warning":
        return Bell;
      case "error":
        return Bell;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: StoreNotification['type']) => {
    return NotificationHelpers.getNotificationColor(type);
  };

  const renderNotification = ({ item }: { item: StoreNotification }) => {
    const Icon = getNotificationIcon(item.type);
    const color = getNotificationColor(item.type);

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
            <Muted className="text-xs">{formatTimestamp(item.timestamp)}</Muted>
          </View>
          <Muted className="text-sm mt-1">{item.message}</Muted>
          {!item.read && (
            <View className="w-2 h-2 bg-primary rounded-full mt-1" />
          )}
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
            <View>
              <H2 className="text-2xl">Notifications</H2>
              {unreadCount > 0 && (
                <Muted className="text-sm">{unreadCount} unread</Muted>
              )}
            </View>
          </View>

          {unreadCount > 0 && (
            <Pressable
              onPress={markAllAsRead}
              className="px-3 py-1 rounded-full bg-primary"
            >
              <Text className="text-primary-foreground text-sm font-medium">
                Mark All Read
              </Text>
            </Pressable>
          )}
        </View>
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
