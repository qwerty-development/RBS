// components/waiting-list/WaitingListCard.tsx
import React, { useState } from "react";
import { View, Pressable, Alert, ActivityIndicator } from "react-native";
import {
  Clock,
  Users,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronRight,
  Timer,
  Bell,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { useWaitingListStore } from "@/stores";

type WaitingListEntry = Database["public"]["Tables"]["waiting_list"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

interface WaitingListCardProps {
  entry: WaitingListEntry;
  onPress?: () => void;
  onCancel?: (id: string) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  className?: string;
  processingEntryId?: string | null;
}

// Status Configuration
const WAITING_LIST_STATUS_CONFIG = {
  active: {
    label: "On Waiting List",
    icon: Timer,
    color: "#f97316", // Orange
    description: "Waiting for a table to become available",
  },
  notified: {
    label: "Table Available!",
    icon: Bell,
    color: "#10b981", // Green
    description: "A table is now available for you",
  },
  converted: {
    label: "Booking Confirmed",
    icon: CheckCircle,
    color: "#3b82f6", // Blue
    description: "Successfully converted to booking",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "#6b7280", // Gray
    description: "Removed from waiting list",
  },
  expired: {
    label: "Expired",
    icon: AlertCircle,
    color: "#dc2626", // Red
    description: "Waiting list entry has expired",
  },
};

// Utility to format time since an event
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)}y ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)}mo ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)}d ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)}h ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)}m ago`;
  return `${Math.floor(seconds)}s ago`;
};

const formatDateForDisplay = (dateString: string) => {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

export function WaitingListCard({
  entry,
  onPress,
  onCancel,
  onNavigateToRestaurant,
  className,
  processingEntryId,
}: WaitingListCardProps) {
  const { cancelWaitingListEntry } = useWaitingListStore();
  const [cancelling, setCancelling] = useState(false);
  
  const statusConfig = WAITING_LIST_STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;
  
  // Use the end of the time slot range to determine if it's past time
  const entryEndDate = new Date(entry.requested_date + 'T' + entry.time_slot_end);
  
  const isActive = entry.status === 'active';
  const isNotified = entry.status === 'notified';
  const isProcessing = processingEntryId === entry.id || cancelling;
  
  // Calculate time since joining
  const timeSinceJoined = formatTimeAgo(new Date(entry.created_at));
  
  // Check if the entire time range has passed
  const isPastTime = entryEndDate.getTime() < new Date().getTime();

  const handlePress = () => onPress?.();
  
  const handleRestaurantPress = (e: any) => {
    e.stopPropagation();
    onNavigateToRestaurant?.(entry.restaurant_id);
  };
  
  const handleCancelEntry = async (e: any) => {
    e.stopPropagation();
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      "Cancel Waiting List",
      "Are you sure you want to remove yourself from the waiting list?",
      [
        {
          text: "Keep Waiting",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelWaitingListEntry(entry.id);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              onCancel?.(entry.id);
            } catch (error) {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error
              );
              Alert.alert("Error", "Failed to cancel waiting list entry");
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "bg-card rounded-xl overflow-hidden mb-4 border border-border shadow-sm",
        className,
      )}
    >
      {/* Restaurant Header */}
      <View className="flex-row p-4">
        <Image
          source={{ uri: entry.restaurant.main_image_url }}
          className="w-20 h-20 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <Pressable
            onPress={handleRestaurantPress}
            className="flex-row items-start justify-between"
          >
            <View className="flex-1">
              <H3 className="mb-1 text-lg">{entry.restaurant.name}</H3>
              <Text className="text-muted-foreground text-sm">
                {entry.restaurant.cuisine_type}
              </Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>

          {/* Status Badge */}
          <View className="flex-row items-center gap-2 mt-2">
            <StatusIcon size={16} color={statusConfig.color} />
            <Text
              className="text-sm font-medium"
              style={{ color: statusConfig.color }}
            >
              {statusConfig.label}
            </Text>
            {isActive && timeSinceJoined && (
              <Text className="text-xs text-muted-foreground">
                • {timeSinceJoined}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Waiting List Details */}
      <View className="px-4 pb-4">
        <View className="gap-3 mb-3">
          <View className="flex-row items-center gap-2">
            <CalendarIcon size={16} color="#6b7280" />
            <Text className="text-sm text-muted-foreground">
              {formatDateForDisplay(entry.requested_date)}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-2">
            <Clock size={16} color="#6b7280" />
            <Text className="text-sm text-muted-foreground">
              {entry.time_slot_start} - {entry.time_slot_end}
              {entry.requested_time && entry.requested_time !== entry.time_slot_start && (
                <Text className="text-xs"> (preferred: {entry.requested_time})</Text>
              )}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-2">
            <Users size={16} color="#6b7280" />
            <Text className="text-sm text-muted-foreground">
              {entry.max_party_size && entry.max_party_size !== entry.min_party_size 
                ? `${entry.min_party_size}-${entry.max_party_size} people`
                : `${entry.min_party_size} ${entry.min_party_size === 1 ? 'person' : 'people'}`
              }
              {entry.party_size && entry.party_size !== entry.min_party_size && (
                <Text className="text-xs"> (preferred: {entry.party_size})</Text>
              )}
            </Text>
          </View>
        </View>

        {/* Special Requests */}
        {entry.special_requests && (
          <View className="mb-3 p-2 bg-muted/30 rounded-lg">
            <Text className="text-xs text-muted-foreground mb-1">
              Special Requests:
            </Text>
            <Text className="text-sm">{entry.special_requests}</Text>
          </View>
        )}

        {/* Occasion */}
        {entry.occasion && (
          <View className="mb-3">
            <Text className="text-xs text-muted-foreground">
              Occasion: <Text className="text-foreground">{entry.occasion}</Text>
            </Text>
          </View>
        )}

        {/* Status Message */}
        <View className="mb-4 p-3 bg-muted/20 rounded-lg">
          <Text className="text-sm text-center">
            {isNotified ? (
              <Text className="text-green-600 dark:text-green-400 font-medium">
                🎉 Great news! A table is now available within your preferred time range. Please book within 15 minutes.
              </Text>
            ) : isActive ? (
              isPastTime ? (
                <Text className="text-orange-600 dark:text-orange-400">
                  ⏰ Your preferred time range has passed, but you're still on the waiting list for future cancellations.
                </Text>
              ) : (
                <Text className="text-muted-foreground">
                  💭 You're on the waiting list for tables available between {entry.time_slot_start} - {entry.time_slot_end}. We'll notify you when a matching table becomes available.
                </Text>
              )
            ) : (
              <Text className="text-muted-foreground">
                {statusConfig.description}
              </Text>
            )}
          </Text>
        </View>

        {/* Actions */}
        <View className="flex-row gap-3">
          {/* Cancel button for active entries */}
          {isActive && (
            <Button
              size="sm"
              variant="destructive"
              onPress={handleCancelEntry}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View className="flex-row items-center gap-1">
                  <XCircle size={14} color="#fff" />
                  <Text className="text-xs text-white">Remove from List</Text>
                </View>
              )}
            </Button>
          )}

          {/* Book Now button for notified entries */}
          {isNotified && (
            <Button
              size="sm"
              variant="default"
              onPress={() => {
                // Navigate to booking with pre-filled data
                // This would be implemented based on your routing setup
              }}
              className="flex-1"
            >
              <View className="flex-row items-center gap-1">
                <CheckCircle size={14} color="#fff" />
                <Text className="text-xs text-white">Book Now</Text>
              </View>
            </Button>
          )}
        </View>

        {/* Additional Info */}
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-xs text-center text-muted-foreground">
            {isActive && `Joined ${timeSinceJoined} • Monitoring ${entry.time_slot_start}-${entry.time_slot_end} time range`}
            {isNotified && "Table available now • Book within 15 minutes"}
            {entry.status === 'converted' && "Successfully converted to booking"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}