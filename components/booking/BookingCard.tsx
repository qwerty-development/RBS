// components/booking/BookingCard.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Info,
  Navigation,
  Phone,
  Star,
  Copy,
  MapPin,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { supabase } from "@/config/supabase";
import { cn } from "@/lib/utils";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

interface BookingCardProps {
  booking: Booking;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onCancel?: (bookingId: string) => Promise<void>;
  onRebook?: (booking: Booking) => void;
  onReview?: (booking: Booking) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  className?: string;
  showQuickActions?: boolean;
  processingBookingId?: string | null;
}

const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    icon: AlertCircle,
    color: "#f59e0b",
    description: "Waiting for restaurant confirmation",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    description: "Your table is reserved",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280",
    description: "You cancelled this booking",
  },
  declined_by_restaurant: {
    label: "Declined",
    icon: XCircle,
    color: "#ef4444",
    description: "Restaurant couldn't accommodate",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    description: "Thank you for dining with us",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626",
    description: "Booking was missed",
  },
};

// Utility function to extract coordinates from PostGIS geography type
const extractLocationCoordinates = (location: any) => {
  if (!location) return null;

  try {
    if (typeof location === "string" && location.includes("POINT(")) {
      const coordsMatch = location.match(/POINT\(([^)]+)\)/);
      if (coordsMatch && coordsMatch[1]) {
        const [lng, lat] = coordsMatch[1].split(" ").map(Number);
        return { latitude: lat, longitude: lng };
      }
    } else if (location.coordinates && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }
  } catch (error) {
    console.warn("Error parsing location:", error);
  }

  return null;
};

export function BookingCard({
  booking,
  variant = "upcoming",
  onPress,
  onCancel,
  onRebook,
  onReview,
  onNavigateToRestaurant,
  className,
  showQuickActions = true,
  processingBookingId,
}: BookingCardProps) {
  const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;
  const bookingDate = new Date(booking.booking_time);
  const isToday = bookingDate.toDateString() === new Date().toDateString();
  const isTomorrow =
    bookingDate.toDateString() ===
    new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString();
  const isPast = variant === "past";
  const isProcessing = processingBookingId === booking.id;

  // Check if review exists for completed bookings
  const [hasReview, setHasReview] = useState(false);

  useEffect(() => {
    const checkReview = async () => {
      if (booking.status === "completed") {
        const { data } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", booking.id)
          .single();

        setHasReview(!!data);
      }
    };
    checkReview();
  }, [booking.id, booking.status]);

  const handlePress = () => {
    onPress?.();
  };

  const handleRestaurantPress = (e: any) => {
    e.stopPropagation();
    onNavigateToRestaurant?.(booking.restaurant_id);
  };

  const handleCancelBooking = (e: any) => {
    e.stopPropagation();
    onCancel?.(booking.id);
  };

  const handleQuickCall = async (e: any) => {
    e.stopPropagation();
    if (!booking.restaurant.phone_number) return;

    const url = `tel:${booking.restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  };

  const handleDirections = async (e: any) => {
    e.stopPropagation();

    const coords = extractLocationCoordinates(booking.restaurant.location);

    if (!coords) {
      Alert.alert("Error", "Location data not available");
      return;
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = booking.restaurant.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      await Linking.openURL(url);
    }
  };

  const handleCopyConfirmation = async (e: any) => {
    e.stopPropagation();

    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `Confirmation code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  const handleReview = (e: any) => {
    e.stopPropagation();
    onReview?.(booking);
  };

  const handleRebook = (e: any) => {
    e.stopPropagation();
    onRebook?.(booking);
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
          source={{ uri: booking.restaurant.main_image_url }}
          className="w-20 h-20 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <H3 className="mb-1 text-lg">{booking.restaurant.name}</H3>
              <P className="text-muted-foreground text-sm">
                {booking.restaurant.cuisine_type}
              </P>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleRestaurantPress}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Info size={16} color="#3b82f6" />
              </Pressable>
              <ChevronRight size={20} color="#666" />
            </View>
          </View>

          {/* Status Badge */}
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

      {/* Booking Details */}
      <View className="px-4 pb-4">
        <View className="bg-muted/50 rounded-lg p-3 mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color="#666" />
              <Text className="font-medium text-sm">
                {isToday
                  ? "Today"
                  : isTomorrow
                    ? "Tomorrow"
                    : bookingDate.toLocaleDateString()}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Clock size={16} color="#666" />
              <Text className="font-medium text-sm">
                {bookingDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <Users size={16} color="#666" />
              <Text className="text-sm text-muted-foreground">
                {booking.party_size}{" "}
                {booking.party_size === 1 ? "Guest" : "Guests"}
              </Text>
            </View>

            {/* Confirmation Code */}
            <Pressable
              onPress={handleCopyConfirmation}
              className="flex-row items-center gap-2 bg-background px-2 py-1 rounded border border-border"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Copy size={14} color="#666" />
              <Text className="text-sm font-mono font-medium">
                {booking.confirmation_code}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Special Requests / Notes Preview */}
        {(booking.special_requests || booking.occasion) && (
          <View className="bg-muted/30 rounded-lg p-3 mb-3">
            {booking.occasion && (
              <Text className="text-sm mb-1">
                <Text className="font-medium">Occasion:</Text>{" "}
                {booking.occasion}
              </Text>
            )}
            {booking.special_requests && (
              <Text className="text-sm" numberOfLines={2}>
                <Text className="font-medium">Special Requests:</Text>{" "}
                {booking.special_requests}
              </Text>
            )}
          </View>
        )}

        {/* Quick Action Buttons */}
        {showQuickActions && (
          <View className="flex-row gap-2">
            {/* Quick Actions for Upcoming Bookings */}
            {!isPast && booking.status === "confirmed" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={handleDirections}
                  className="flex-1"
                >
                  <View className="flex-row items-center gap-1">
                    <Navigation size={14} color="#3b82f6" />
                    <Text className="text-xs">Directions</Text>
                  </View>
                </Button>

                {booking.restaurant.phone_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handleQuickCall}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Phone size={14} color="#10b981" />
                      <Text className="text-xs">Call</Text>
                    </View>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="destructive"
                  onPress={handleCancelBooking}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View className="flex-row items-center gap-1">
                      <XCircle size={14} color="#fff" />
                      <Text className="text-xs text-white">Cancel</Text>
                    </View>
                  )}
                </Button>
              </>
            )}

            {/* Quick Actions for Pending Bookings */}
            {!isPast && booking.status === "pending" && (
              <Button
                size="sm"
                variant="destructive"
                onPress={handleCancelBooking}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-1">
                    <XCircle size={14} color="#fff" />
                    <Text className="text-sm text-white">Cancel Booking</Text>
                  </View>
                )}
              </Button>
            )}

            {/* Actions for Past Bookings */}
            {isPast && (
              <>
                {booking.status === "completed" && !hasReview && onReview && (
                  <Button
                    size="sm"
                    variant="default"
                    onPress={handleReview}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Star size={14} color="#fff" />
                      <Text className="text-xs text-white">Rate</Text>
                    </View>
                  </Button>
                )}

                {onRebook && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={handleRebook}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-1">
                      <Calendar size={14} color="#000" />
                      <Text className="text-xs">Book Again</Text>
                    </View>
                  </Button>
                )}
              </>
            )}
          </View>
        )}

        {/* Tap for Details Hint */}
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-xs text-center text-muted-foreground">
            Tap for full booking details
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
