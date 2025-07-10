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

// Mock notification types
type NotificationType = "booking" | "favorite" | "review" | "loyalty" | "system";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: {
    restaurantId?: string;
    bookingId?: string;
    points?: number;
  };
}

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "booking",
    title: "Booking Confirmed",
    message: "Your reservation at Le Petit Bistro is confirmed for tomorrow at 7:00 PM",
    timestamp: "2 hours ago",
    read: false,
    data: {
      restaurantId: "123",
      bookingId: "456",
    },
  },
  {
    id: "2",
    type: "loyalty",
    title: "New Reward Available",
    message: "You've earned 500 loyalty points! Redeem them for a free dessert.",
    timestamp: "5 hours ago",
    read: false,
    data: {
      points: 500,
    },
  },
  {
    id: "3",
    type: "review",
    title: "Review Request",
    message: "How was your experience at Sushi Master? Share your thoughts!",
    timestamp: "1 day ago",
    read: true,
    data: {
      restaurantId: "789",
    },
  },
  {
    id: "4",
    type: "favorite",
    title: "New Menu Items",
    message: "Your favorite restaurant, Pasta Paradise, has added new dishes to their menu",
    timestamp: "2 days ago",
    read: true,
    data: {
      restaurantId: "101",
    },
  },
  {
    id: "5",
    type: "system",
    title: "App Update",
    message: "New features are available! Update your app to the latest version.",
    timestamp: "3 days ago",
    read: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Simulate loading notifications
  useEffect(() => {
    const loadNotifications = async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setLoading(false);
    };

    loadNotifications();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleNotificationPress = useCallback((notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n
      )
    );

    // Navigate based on notification type
    switch (notification.type) {
      case "booking":
        if (notification.data?.bookingId) {
          router.push({
            pathname: "/bookings",
            params: { highlightBookingId: notification.data.bookingId }
          });
        }
        break;
      case "favorite":
      case "review":
        if (notification.data?.restaurantId) {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: notification.data.restaurantId }
          });
        }
        break;
      case "loyalty":
        router.push("/profile");
        break;
      default:
        break;
    }
  }, [router]);

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "booking":
        return Calendar;
      case "favorite":
        return Heart;
      case "review":
        return Star;
      case "loyalty":
        return Trophy;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case "booking":
        return "#3b82f6"; // blue
      case "favorite":
        return "#ef4444"; // red
      case "review":
        return "#f59e0b"; // amber
      case "loyalty":
        return "#10b981"; // green
      default:
        return "#6b7280"; // gray
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
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
            <Muted className="text-xs">{item.timestamp}</Muted>
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
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 p-2 rounded-full bg-muted"
          >
            <ArrowLeft size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
          <H2 className="text-2xl">Notifications</H2>
        </View>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
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
            <Text className="text-lg font-medium mt-4">No notifications yet</Text>
            <Muted className="text-center mt-2">
              We'll notify you when there's something new
            </Muted>
          </View>
        }
      />
    </SafeAreaView>
  );
}
