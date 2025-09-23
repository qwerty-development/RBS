// components/booking/WaitlistCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Clock,
  Calendar,
  Users,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react-native";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import type { EnhancedWaitlistEntry } from "@/hooks/useBookings";
import { getWaitlistEntryMessage } from "@/hooks/useWaitlist";
import { TABLE_TYPE_INFO } from "@/types/waitlist";

interface WaitlistCardProps {
  waitlistEntry: EnhancedWaitlistEntry;
  onPress?: () => void;
  onLeaveWaitlist?: (waitlistId: string, restaurantName?: string) => void;
  onBookNow?: (waitlistEntry: EnhancedWaitlistEntry) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  processingWaitlistId?: string | null;
}

export function WaitlistCard({
  waitlistEntry,
  onPress,
  onLeaveWaitlist,
  onBookNow,
  onNavigateToRestaurant,
  processingWaitlistId,
}: WaitlistCardProps) {
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
      case "cancelled":
        return "#ef4444"; // red
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
      case "cancelled":
        return XCircle;
      default:
        return Clock;
    }
  };

  const StatusIcon = getStatusIcon(waitlistEntry.status);
  const statusColor = getStatusColor(waitlistEntry.status);
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

  const handleLeaveWaitlist = () => {
    if (onLeaveWaitlist) {
      onLeaveWaitlist(waitlistEntry.id, waitlistEntry.restaurant?.name);
    }
  };

  const handleViewRestaurant = () => {
    if (onNavigateToRestaurant) {
      onNavigateToRestaurant(waitlistEntry.restaurant_id);
    }
  };

  return (
    <Pressable
      className="bg-card rounded-lg p-4 border border-border mb-3"
      onPress={handlePress}
      disabled={isProcessing}
      style={{ opacity: isProcessing ? 0.6 : 1 }}
    >
      {/* Waitlist Badge */}
      <View className="absolute top-3 right-3 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
        <Text className="text-xs font-medium text-purple-700 dark:text-purple-300">
          Waitlist
        </Text>
      </View>

      {/* Restaurant Info */}
      <View className="flex-row items-start justify-between mb-3 pr-16">
        <View className="flex-1">
          <H3>{waitlistEntry.restaurant?.name || "Restaurant"}</H3>
          {waitlistEntry.restaurant?.address && (
            <View className="flex-row items-center mt-1">
              <MapPin size={12} color="#6b7280" />
              <Muted className="ml-1 text-xs">
                {waitlistEntry.restaurant.address}
              </Muted>
            </View>
          )}
        </View>
      </View>

      {/* Status and Entry Type Badges */}
      <View className="flex-row items-center gap-2 mb-3">
        {/* Entry Type Badge */}
        {waitlistMessage.badgeText && (
          <View
            className="px-2 py-1 rounded-full flex-row items-center"
            style={{
              backgroundColor: waitlistEntry.is_scheduled_entry
                ? "#f59e0b20"
                : "#10b98120",
            }}
          >
            <Info
              size={12}
              color={waitlistEntry.is_scheduled_entry ? "#f59e0b" : "#10b981"}
            />
            <Text
              className="ml-1 text-xs font-medium"
              style={{
                color: waitlistEntry.is_scheduled_entry ? "#f59e0b" : "#10b981",
              }}
            >
              {waitlistMessage.badgeText}
            </Text>
          </View>
        )}

        {/* Status Badge */}
        <View
          className="px-2 py-1 rounded-full flex-row items-center"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          <StatusIcon size={14} color={statusColor} />
          <Text
            className="ml-1 text-xs font-medium capitalize"
            style={{ color: statusColor }}
          >
            {waitlistEntry.status}
          </Text>
        </View>
      </View>

      {/* Entry Type Explanation */}
      {waitlistEntry.is_scheduled_entry === true && (
        <View className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <View className="flex-row items-start">
            <Info size={16} color="#f59e0b" className="mt-0.5" />
            <View className="ml-2 flex-1">
              <Text className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {waitlistMessage.title}
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {waitlistMessage.description}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Waitlist Details */}
      <View className="space-y-2 mb-3">
        <View className="flex-row items-center">
          <Calendar size={16} color="#6b7280" />
          <Text className="ml-2 text-sm">
            {formatDate(waitlistEntry.desired_date)}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Clock size={16} color="#6b7280" />
          <Text className="ml-2 text-sm">
            {waitlistEntry.desired_time_range}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Users size={16} color="#6b7280" />
          <Text className="ml-2 text-sm">
            {waitlistEntry.party_size}{" "}
            {waitlistEntry.party_size === 1 ? "person" : "people"}
          </Text>
        </View>
        {waitlistEntry.table_type !== "any" && (
          <View className="flex-row items-center">
            <Text className="text-sm">{tableTypeInfo.icon}</Text>
            <Text className="ml-2 text-sm">{tableTypeInfo.label} Table</Text>
          </View>
        )}
        {waitlistEntry.special_requests && (
          <View className="mt-2">
            <Text className="text-xs text-muted-foreground">
              Note: {waitlistEntry.special_requests}
            </Text>
          </View>
        )}
      </View>

      {/* Notification Alert */}
      {isNotified && (
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
        {isNotified ? (
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
        ) : waitlistEntry.status === "active" ? (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleLeaveWaitlist}
              disabled={isProcessing}
            >
              <Text className="font-medium">Leave Waitlist</Text>
            </Button>
            <Button
              className="flex-1"
              onPress={handleViewRestaurant}
              disabled={isProcessing}
            >
              <Text className="text-primary-foreground font-medium">
                View Restaurant
              </Text>
            </Button>
          </>
        ) : (
          // For expired/cancelled entries, just show view restaurant
          <Button
            variant="outline"
            className="flex-1"
            onPress={handleViewRestaurant}
            disabled={isProcessing}
          >
            <Text className="font-medium">View Restaurant</Text>
          </Button>
        )}
      </View>
    </Pressable>
  );
}
