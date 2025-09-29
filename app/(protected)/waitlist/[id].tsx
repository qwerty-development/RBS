// app/(protected)/waitlist/[id].tsx - Waitlist Entry Details Page
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  Trash2,
  AlertCircle,
  CheckCircle,
  MapPin,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3, P } from "@/components/ui/typography";
import { BackHeader } from "@/components/ui/back-header";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { Card } from "@/components/ui/card";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useWaitlist } from "@/hooks/useWaitlist";
import { supabase } from "@/config/supabase";
import { colors } from "@/constants/colors";
import { TABLE_TYPE_INFO } from "@/types/waitlist";

interface WaitlistEntry {
  id: string;
  user_id: string;
  restaurant_id: string;
  desired_date: string;
  desired_time_range: string;
  party_size: number;
  table_type: string;
  status: "active" | "notified" | "booked" | "expired" | "cancelled";
  special_requests?: string;
  notified_at?: string;
  notification_expires_at?: string;
  expires_at?: string;
  converted_booking_id?: string;
  created_at?: string;
  updated_at?: string;
  is_scheduled_entry?: boolean;
  restaurant?: {
    id: string;
    name: string;
    address: string;
    main_image_url?: string;
    phone_number?: string;
    tier?: "basic" | "pro";
  };
}

export default function WaitlistDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cancelWaitlist } = useWaitlist();

  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Fetch waitlist entry details
  useEffect(() => {
    if (id) {
      fetchWaitlistEntry();
    }
  }, [id]);

  const fetchWaitlistEntry = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("waitlist")
        .select(
          `
          *,
          restaurant:restaurants!waitlist_restaurant_id_fkey (
            id,
            name,
            address,
            main_image_url,
            phone_number,
            tier
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching waitlist entry:", error);
        Alert.alert("Error", "Could not load waitlist details");
        router.back();
        return;
      }

      setWaitlistEntry(data);
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Something went wrong");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMM d, yyyy");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#f59e0b"; // amber/warning color
      case "notified":
        return "#10b981"; // green/success color
      case "booked":
        return "#10b981"; // green/success color
      case "expired":
        return colors[colorScheme].muted;
      case "cancelled":
        return colors[colorScheme].destructive;
      default:
        return colors[colorScheme].muted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "⏰ Waiting";
      case "notified":
        return "🔔 Table Available";
      case "booked":
        return "✅ Converted to Booking";
      case "expired":
        return "⏰ Expired";
      case "cancelled":
        return "❌ Cancelled";
      default:
        return status;
    }
  };

  const handleCancel = async () => {
    if (!waitlistEntry) return;

    setCancelling(true);
    try {
      const success = await cancelWaitlist(
        waitlistEntry.id,
        waitlistEntry.restaurant?.name,
      );
      if (success) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        router.back();
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleNavigateToRestaurant = () => {
    if (waitlistEntry?.restaurant_id) {
      router.push(`/(protected)/restaurant/${waitlistEntry.restaurant_id}`);
    }
  };

  const handleBookNow = () => {
    if (waitlistEntry?.status === "notified") {
      // Navigate to booking flow for this restaurant
      router.push({
        pathname: "/(protected)/booking/availability",
        params: {
          restaurantId: waitlistEntry.restaurant_id,
          date: waitlistEntry.desired_date,
          time: waitlistEntry.desired_time_range.split("-")[0],
          partySize: waitlistEntry.party_size.toString(),
          tableType: waitlistEntry.table_type,
          fromWaitlist: "true",
        },
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BackHeader title="Waitlist Details" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors[colorScheme].primary} />
          <Text className="mt-4 text-muted-foreground">
            Loading waitlist details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!waitlistEntry) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BackHeader title="Waitlist Details" />
        <View className="flex-1 justify-center items-center p-6">
          <AlertCircle size={48} color={colors[colorScheme].muted} />
          <Text className="mt-4 text-lg font-semibold">
            Waitlist Entry Not Found
          </Text>
          <Text className="mt-2 text-muted-foreground text-center">
            This waitlist entry might have been removed or doesn&apos;t exist.
          </Text>
          <Button className="mt-6 rounded-md" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const tableTypeInfo =
    TABLE_TYPE_INFO[waitlistEntry.table_type as keyof typeof TABLE_TYPE_INFO] ||
    TABLE_TYPE_INFO.any;
  // Allow cancellation for all entries except those already booked or cancelled
  const canCancel =
    waitlistEntry.status !== "booked" &&
    waitlistEntry.status !== "cancelled" &&
    !waitlistEntry.converted_booking_id;

  // Only show Book Now for notified entries
  const showBookNow = waitlistEntry.status === "notified";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="Waitlist Details" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Restaurant Header */}
        <Card className="mx-4 mt-2 mb-4 overflow-hidden">
          <Pressable
            onPress={handleNavigateToRestaurant}
            className="active:opacity-70"
          >
            <View className="p-4">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 flex-row items-start">
                  <Image
                    source={{
                      uri:
                        waitlistEntry.restaurant?.main_image_url ||
                        "https://via.placeholder.com/80x80?text=No+Image",
                    }}
                    className="w-16 h-16 rounded-lg mr-3 bg-muted"
                    contentFit="cover"
                    transition={200}
                    onError={(error) => {
                      console.warn("Error loading restaurant image:", error);
                    }}
                  />
                  <View className="flex-1">
                    <Text className="font-semibold text-base mb-1">
                      {waitlistEntry.restaurant?.name || "Restaurant"}
                    </Text>
                    <View className="flex-row items-center mb-1">
                      <MapPin size={14} color={colors[colorScheme].muted} />
                      <Text className="ml-1 text-sm text-muted-foreground flex-1">
                        {waitlistEntry.restaurant?.address || "Address not available"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View
                  className="px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: getStatusColor(waitlistEntry.status) + "20",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: getStatusColor(waitlistEntry.status) }}
                  >
                    {getStatusText(waitlistEntry.status)}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Card>

        {/* Waitlist Details - Core Information */}
        <Card className="mx-4 mb-4 overflow-hidden">
          <View className="p-4">
            {/* Core Details Section - More Prominent */}
            <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                  <Calendar size={14} color={colors[colorScheme].primary} />
                  <Text className="font-semibold text-sm text-primary dark:text-white">
                    {formatDate(waitlistEntry.desired_date)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Clock size={14} color={colors[colorScheme].primary} />
                  <Text className="font-semibold text-sm text-primary dark:text-white">
                    {waitlistEntry.desired_time_range}
                  </Text>
                </View>
              </View>
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Users size={14} color={colors[colorScheme].primary} />
                  <Text className="text-sm font-medium text-primary dark:text-white">
                    {waitlistEntry.party_size}{" "}
                    {waitlistEntry.party_size === 1 ? "Guest" : "Guests"}
                  </Text>
                </View>
                {waitlistEntry.table_type !== "any" && (
                  <View className="flex-row items-center gap-1">
                    <Text className="text-sm">{tableTypeInfo.icon}</Text>
                    <Text className="text-xs text-primary dark:text-white">
                      {tableTypeInfo.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Additional Details */}
            <View className="mb-2">
              <Text className="font-semibold text-base mb-2">Waitlist Details</Text>
              <View className="space-y-2">
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted-foreground w-24">Status:</Text>
                  <View
                    className="px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: getStatusColor(waitlistEntry.status) + "20",
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: getStatusColor(waitlistEntry.status) }}
                    >
                      {getStatusText(waitlistEntry.status)}
                    </Text>
                  </View>
                </View>
                
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted-foreground w-24">Created:</Text>
                  <Text className="text-sm">
                    {waitlistEntry.created_at ? format(parseISO(waitlistEntry.created_at), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                  </Text>
                </View>
                
                {waitlistEntry.status === "notified" && waitlistEntry.notified_at && (
                  <View className="flex-row items-center">
                    <Text className="text-sm text-muted-foreground w-24">Notified:</Text>
                    <Text className="text-sm">
                      {format(parseISO(waitlistEntry.notified_at), "MMM d, yyyy 'at' h:mm a")}
                    </Text>
                  </View>
                )}
              </View>
            </View>

          {/* Special Requests */}
          {waitlistEntry.special_requests && (
            <View className="bg-muted/30 rounded-lg p-2 mb-2">
              <Text className="text-xs text-muted-foreground">
                Note: {waitlistEntry.special_requests}
              </Text>
            </View>
          )}
          </View>
        </Card>

        {/* Status-specific Information */}
        {waitlistEntry.status === "notified" && (
          <Card className="mx-4 mb-4 overflow-hidden">
            <View className="p-4">
              <View className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <View className="flex-row items-center">
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text className="ml-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Table Available!
                  </Text>
                </View>
                <Text className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  A table is ready! Tap to book now
                  {waitlistEntry.notification_expires_at && (
                    <Text> (expires at {format(parseISO(waitlistEntry.notification_expires_at), "h:mm a")})</Text>
                  )}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {waitlistEntry.status === "booked" && (
          <Card className="mx-4 mb-4 overflow-hidden">
            <View className="p-4">
              <View className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <Text className="text-center text-sm font-medium text-green-800 dark:text-green-200">
                  ✅ Converted to Booking
                </Text>
                <Text className="text-center text-xs text-green-700 dark:text-green-300 mt-1">
                  Check your bookings page to manage your reservation
                </Text>
              </View>
            </View>
          </Card>
        )}

        {waitlistEntry.status === "expired" && (
          <Card className="mx-4 mb-4 overflow-hidden">
            <View className="p-4">
              <View className="flex-1 bg-muted/20 rounded-lg p-3">
                <Text className="text-center text-sm font-medium text-muted-foreground">
                  ⏰ Expired
                </Text>
              </View>
            </View>
          </Card>
        )}
        
        {waitlistEntry.status === "cancelled" && (
          <Card className="mx-4 mb-4 overflow-hidden">
            <View className="p-4">
              <View className="flex-1 bg-muted/20 rounded-lg p-3">
                <Text className="text-center text-sm font-medium text-muted-foreground">
                  ❌ Cancelled
                </Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-8">
        {showBookNow && canCancel ? (
          // Notified status: Show both Book Now and Cancel buttons
          <View className="flex-row gap-3">
            <Button className="flex-1 rounded-md" onPress={handleBookNow}>
              <CheckCircle size={16} color="white" />
              <Text className="ml-2 text-primary-foreground font-semibold">
                Book Now
              </Text>
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-md"
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Trash2 size={16} color="white" />
                  <Text className="ml-2 text-destructive-foreground font-semibold">
                    Cancel
                  </Text>
                </>
              )}
            </Button>
          </View>
        ) : showBookNow ? (
          // Notified but already booked/cancelled: Show only Book Now
          <Button className="w-full rounded-md" onPress={handleBookNow}>
            <CheckCircle size={16} color="white" />
            <Text className="ml-2 text-primary-foreground font-semibold">
              Book Now
            </Text>
          </Button>
        ) : canCancel ? (
          // All other statuses (active, expired) that can be cancelled
          <Button
            variant="destructive"
            onPress={handleCancel}
            disabled={cancelling}
            className="w-full rounded-md"
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Trash2 size={16} color="white" />
                <Text className="ml-2 text-destructive-foreground font-semibold">
                  {waitlistEntry.status === "expired"
                    ? "Remove Entry"
                    : "Cancel Waitlist Entry"}
                </Text>
              </>
            )}
          </Button>
        ) : waitlistEntry.status === "booked" ? (
          // Already converted to booking
          <Button
            onPress={() => router.push("/(protected)/(tabs)/bookings")}
            className="w-full rounded-md"
          >
            <Text className="font-semibold">View Bookings</Text>
          </Button>
        ) : waitlistEntry.status === "cancelled" ? (
          // Already cancelled - no actions available
          <View className="w-full bg-muted/20 rounded-lg p-4">
            <Text className="text-center text-sm text-muted-foreground">
              This waitlist entry has been cancelled
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// Helper functions for status display
function getStatusText(status: string, tier?: "basic" | "pro"): string {
  switch (status) {
    case "active":
      return tier === "basic" ? "Manual Review" : "Waitlisted";
    case "notified":
      return "Table Available";
    case "booked":
      return "Booked";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "#f59e0b"; // amber
    case "notified":
      return "#10b981"; // green
    case "booked":
      return "#10b981"; // green
    case "expired":
      return "#6b7280"; // gray
    case "cancelled":
      return "#dc2626"; // red
    default:
      return "#6b7280"; // gray
  }
}
