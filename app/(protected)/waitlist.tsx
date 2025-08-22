// app/(protected)/waitlist.tsx
// Mobile app waitlist screen for React Native

import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useWaitlist } from "@/hooks/useWaitlist";
import { useRouter } from "expo-router";
import {
  Clock,
  Calendar,
  Users,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react-native";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

export default function WaitlistScreen() {
  const router = useRouter();
  const { myWaitlist, loading, getMyWaitlist, leaveWaitlist, isAuthenticated } =
    useWaitlist();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated]);

  const formatDate = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "EEE, MMM d");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#3b82f6"; // blue
      case "notified":
        return "#f59e0b"; // yellow
      case "booked":
        return "#10b981"; // green
      case "expired":
        return "#6b7280"; // gray
      default:
        return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return Clock;
      case "notified":
        return AlertCircle;
      case "booked":
        return CheckCircle;
      case "expired":
        return XCircle;
      default:
        return Clock;
    }
  };

  const handleLeaveWaitlist = (entry: any) => {
    Alert.alert(
      "Leave Waitlist?",
      `Are you sure you want to leave the waitlist for ${entry.restaurant?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => leaveWaitlist(entry.id),
        },
      ],
    );
  };

  const handleBookNow = (entry: any) => {
    // Navigate to booking screen with pre-filled data
    router.push({
      pathname: "/(protected)/booking/availability",
      params: {
        restaurantId: entry.restaurant_id,
        date: entry.desired_date,
        time: entry.desired_time_range.split("-")[0],
        partySize: entry.party_size.toString(),
        fromWaitlist: "true",
        waitlistId: entry.id,
      },
    });
  };

  if (loading && myWaitlist.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">
            Loading waitlist...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <H2>My Waitlist</H2>
        <Muted>Your restaurant waiting list entries</Muted>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={getMyWaitlist} />
        }
      >
        {myWaitlist.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Clock size={48} color="#9ca3af" />
            <H3 className="mt-4">No Waitlist Entries</H3>
            <Muted className="mt-2 text-center px-8">
              Join a restaurant's waitlist when tables aren't available for your
              preferred time
            </Muted>
            <Button
              className="mt-6"
              onPress={() => router.push("/(protected)/(tabs)/search")}
            >
              <Text className="text-primary-foreground font-medium">
                Browse Restaurants
              </Text>
            </Button>
          </View>
        ) : (
          <View className="p-4 space-y-4">
            {myWaitlist.map((entry) => {
              const StatusIcon = getStatusIcon(entry.status);
              const statusColor = getStatusColor(entry.status);
              const isNotified = entry.status === "notified";

              return (
                <Pressable
                  key={entry.id}
                  className="bg-card rounded-lg p-4 border border-border"
                  onPress={() => {
                    if (isNotified) {
                      handleBookNow(entry);
                    }
                  }}
                >
                  {/* Restaurant Info */}
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1">
                      <H3>{entry.restaurant?.name || "Restaurant"}</H3>
                      {entry.restaurant?.address && (
                        <View className="flex-row items-center mt-1">
                          <MapPin size={12} color="#6b7280" />
                          <Muted className="ml-1 text-xs">
                            {entry.restaurant.address}
                          </Muted>
                        </View>
                      )}
                    </View>
                    <View
                      className="px-2 py-1 rounded-full flex-row items-center"
                      style={{ backgroundColor: `${statusColor}20` }}
                    >
                      <StatusIcon size={14} color={statusColor} />
                      <Text
                        className="ml-1 text-xs font-medium capitalize"
                        style={{ color: statusColor }}
                      >
                        {entry.status}
                      </Text>
                    </View>
                  </View>

                  {/* Waitlist Details */}
                  <View className="space-y-2">
                    <View className="flex-row items-center">
                      <Calendar size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {formatDate(entry.desired_date)}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Clock size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {entry.desired_time_range}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Users size={16} color="#6b7280" />
                      <Text className="ml-2 text-sm">
                        {entry.party_size}{" "}
                        {entry.party_size === 1 ? "person" : "people"}
                      </Text>
                    </View>
                  </View>

                  {/* Notification Alert */}
                  {isNotified && (
                    <View className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <View className="flex-row items-center">
                        <AlertCircle size={16} color="#f59e0b" />
                        <Text className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Table Available!
                        </Text>
                      </View>
                      <Text className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                        A table is ready! Tap to book now (expires in 15 min)
                      </Text>
                    </View>
                  )}

                  {/* Expiration Warning */}
                  {entry.expires_at && entry.status === "active" && (
                    <Text className="text-xs text-muted-foreground mt-2">
                      Expires: {format(parseISO(entry.expires_at), "h:mm a")}
                    </Text>
                  )}

                  {/* Actions */}
                  <View className="flex-row gap-2 mt-4">
                    {isNotified ? (
                      <Button
                        className="flex-1"
                        onPress={() => handleBookNow(entry)}
                      >
                        <CheckCircle size={16} color="white" />
                        <Text className="text-primary-foreground font-medium ml-2">
                          Book Now
                        </Text>
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onPress={() => handleLeaveWaitlist(entry)}
                        >
                          <Text className="font-medium">Leave Waitlist</Text>
                        </Button>
                        <Button
                          className="flex-1"
                          onPress={() =>
                            router.push({
                              pathname: "/(protected)/restaurant/[id]",
                              params: { id: entry.restaurant_id },
                            })
                          }
                        >
                          <Text className="text-primary-foreground font-medium">
                            View Restaurant
                          </Text>
                        </Button>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
