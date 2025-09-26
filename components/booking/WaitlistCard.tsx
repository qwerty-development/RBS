// components/booking/WaitlistCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Clock,
  Calendar,
  Users,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react-native";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { cn } from "@/lib/utils";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";
import type { EnhancedWaitlistEntry } from "@/hooks/useBookings";
import { getWaitlistEntryMessage } from "@/hooks/useWaitlist";
import { TABLE_TYPE_INFO } from "@/types/waitlist";

interface WaitlistCardProps {
  waitlistEntry: EnhancedWaitlistEntry;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onLeaveWaitlist?: (waitlistId: string, restaurantName?: string) => void;
  onBookNow?: (waitlistEntry: EnhancedWaitlistEntry) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  processingWaitlistId?: string | null;
}

export function WaitlistCard({
  waitlistEntry,
  variant = "upcoming",
  onPress,
  onLeaveWaitlist,
  onBookNow,
  onNavigateToRestaurant,
  processingWaitlistId,
}: WaitlistCardProps) {
  const { colorScheme } = useColorScheme();
  
  const formatDate = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "MMM d");
  };

  const isNotified = waitlistEntry.status === "notified";
  const isProcessing = processingWaitlistId === waitlistEntry.id;
  const waitlistMessage = getWaitlistEntryMessage(waitlistEntry);
  const tableTypeInfo = TABLE_TYPE_INFO[waitlistEntry.table_type];

  const handlePress = () => {
    if (isNotified && onBookNow) {
      onBookNow(waitlistEntry);
    } else if (onPress) {
      onPress();
    }
  };

  const handleRestaurantPress = (e: any) => {
    e.stopPropagation();
    if (onNavigateToRestaurant) {
      onNavigateToRestaurant(waitlistEntry.restaurant_id);
    }
  };

  const handleLeaveWaitlist = () => {
    if (onLeaveWaitlist) {
      onLeaveWaitlist(waitlistEntry.id, waitlistEntry.restaurant?.name);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "bg-card rounded-lg overflow-hidden mb-3 border border-border shadow-sm",
      )}
      disabled={isProcessing}
      style={{ opacity: isProcessing ? 0.6 : 1 }}
    >
      {/* Restaurant Header */}
      <View className="flex-row p-3">
        <Pressable onPress={handleRestaurantPress}>
          <Image
            source={{
              uri:
                waitlistEntry.restaurant?.main_image_url ||
                "https://via.placeholder.com/60x60?text=No+Image",
            }}
            className="w-16 h-16 rounded-lg bg-muted"
            contentFit="cover"
            onError={(error) => {
              console.warn("Error loading restaurant image:", error);
            }}
            placeholder="https://via.placeholder.com/60x60?text=Loading"
            transition={200}
          />
        </Pressable>
        <View className="flex-1 ml-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <H3 className="mb-1 text-base">
                {waitlistEntry.restaurant?.name || "Restaurant"}
              </H3>
              <Text className="text-muted-foreground text-xs mb-1">
                {waitlistEntry.restaurant?.cuisine_type || "Cuisine"}
              </Text>
              <Text className="text-muted-foreground text-xs">
                {waitlistEntry.restaurant?.address || "Address"}
              </Text>
            </View>
            <ChevronRight size={16} color="#666" />
          </View>
        </View>
      </View>

      {/* Waitlist Details - Compact Layout */}
      <View className="px-3 pb-3">
        {/* --- Core Details Section - More Prominent --- */}
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

        {/* Special Requests / Notes Preview */}
        {waitlistEntry.special_requests && (
          <View className="bg-muted/30 rounded-lg p-2 mb-2">
            <Text className="text-xs text-muted-foreground">
              Note: {waitlistEntry.special_requests}
            </Text>
          </View>
        )}

        {/* Status Bar for Waitlist */}
        <View 
          className="w-full py-3 px-4 mb-3 rounded-lg"
          style={{
            backgroundColor: "#fef3c7" // Light yellow background for waitlisted
          }}
        >
          <View className="flex-row items-center justify-center gap-2">
            <Clock size={16} color="#f59e0b" />
            <Text className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              Waitlisted
            </Text>
          </View>
        </View>

        {/* Notification Alert - Only show for past waitlist entries */}
        {isNotified && variant === "past" && (
          <View className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
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
        {waitlistEntry.expires_at && waitlistEntry.status === "active" && (
          <Text className="text-xs text-muted-foreground mb-3">
            Expires: {format(parseISO(waitlistEntry.expires_at), "h:mm a")}
          </Text>
        )}

        {/* Actions */}
        <View className="flex-row gap-2">
          {isNotified && variant === "past" ? (
            <Button
              className="flex-1"
              onPress={() => onBookNow?.(waitlistEntry)}
              disabled={isProcessing}
            >
              <CheckCircle size={16} color="white" />
              <Text className="text-primary-foreground font-medium ml-2">
                Book Now
              </Text>
            </Button>
          ) : waitlistEntry.status === "active" && variant === "upcoming" ? (
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleLeaveWaitlist}
              disabled={isProcessing}
            >
              <Text className="font-medium">Leave Waitlist</Text>
            </Button>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
