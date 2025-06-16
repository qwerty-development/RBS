// components/booking/BookingCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

interface BookingCardProps {
  booking: Booking;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onCancel?: () => void;
  onRebook?: () => void;
  onReview?: () => void;
  className?: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: AlertCircle,
    color: "#f59e0b",
    label: "Pending",
  },
  confirmed: {
    icon: CheckCircle,
    color: "#10b981",
    label: "Confirmed",
  },
  cancelled_by_user: {
    icon: XCircle,
    color: "#6b7280",
    label: "Cancelled",
  },
  declined_by_restaurant: {
    icon: XCircle,
    color: "#ef4444",
    label: "Declined",
  },
  completed: {
    icon: CheckCircle,
    color: "#3b82f6",
    label: "Completed",
  },
  no_show: {
    icon: AlertCircle,
    color: "#dc2626",
    label: "No Show",
  },
};

export function BookingCard({
  booking,
  variant = "upcoming",
  onPress,
  onCancel,
  onRebook,
  onReview,
  className,
}: BookingCardProps) {
  const statusConfig = STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;
  const bookingDate = new Date(booking.booking_time);
  const isToday = bookingDate.toDateString() === new Date().toDateString();

  return (
    <Pressable
      onPress={onPress}
      className={cn("bg-card rounded-xl overflow-hidden shadow-sm", className)}
    >
      <View className="flex-row p-4">
        <Image
          source={{ uri: booking.restaurant.main_image_url }}
          className="w-20 h-20 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <H3 className="mb-1">{booking.restaurant.name}</H3>
          <P className="text-muted-foreground text-sm">
            {booking.restaurant.cuisine_type}
          </P>
          
          <View className="flex-row items-center gap-2 mt-2">
            <StatusIcon size={16} color={statusConfig.color} />
            <Text
              className="text-sm font-medium"
              style={{ color: statusConfig.color }}
            >
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </View>
      
      <View className="px-4 pb-4">
        <View className="bg-muted rounded-lg p-3 mb-3">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color="#666" />
              <Text className="font-medium">
                {isToday
                  ? "Today"
                  : bookingDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Clock size={16} color="#666" />
              <Text className="font-medium">
                {bookingDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#666" />
              <Text className="font-medium">{booking.party_size}</Text>
            </View>
          </View>
        </View>
        
        {booking.confirmation_code && (
          <View className="mb-3">
            <Text className="text-xs text-muted-foreground mb-1">
              Confirmation Code
            </Text>
            <Text className="font-mono font-bold text-lg">
              {booking.confirmation_code}
            </Text>
          </View>
        )}
        
        {variant === "upcoming" &&
          (booking.status === "confirmed" || booking.status === "pending") && (
            <Button
              size="sm"
              variant="destructive"
              onPress={onCancel}
              className="w-full"
            >
              <Text>Cancel Booking</Text>
            </Button>
          )}
        
        {variant === "past" && (
          <View className="flex-row gap-2">
            {booking.status === "completed" && onReview && (
              <Button
                size="sm"
                variant="default"
                onPress={onReview}
                className="flex-1"
              >
                <Text>Write Review</Text>
              </Button>
            )}
            {onRebook && (
              <Button
                size="sm"
                variant="outline"
                onPress={onRebook}
                className="flex-1"
              >
                <Text>Book Again</Text>
              </Button>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}
