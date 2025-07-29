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
  Calendar as CalendarIcon,
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
  CalendarPlus,
  Timer, // Added for pending status
  RotateCcw, // Added for rebooking
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Calendar from "expo-calendar";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { supabase } from "@/config/supabase";
import { cn } from "@/lib/utils";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";

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

// --- Status Configuration (Enhanced) ---
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Awaiting Confirmation",
    icon: Timer, // Using Timer for pending
    color: "#f97316", // Orange
    description: "Waiting for restaurant confirmation",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981", // Green
    description: "Your table is reserved",
  },
  cancelled_by_user: {
    label: "Cancelled",
    icon: XCircle,
    color: "#6b7280", // Gray
    description: "You cancelled this booking",
  },
  declined_by_restaurant: {
    label: "Declined",
    icon: XCircle,
    color: "#ef4444", // Red
    description: "Restaurant couldn't accommodate this request",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6", // Blue
    description: "Thank you for dining with us",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626", // Dark Red
    description: "Booking was missed",
  },
};

// --- Utility Functions ---

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

const getDefaultCalendar = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Calendar permission not granted");
  }
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  return (
    calendars.find((cal) => cal.source.name === "Default" || cal.isPrimary) ||
    calendars[0]
  );
};

// --- Main Component ---
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
    new Date(bookingDate.setHours(0, 0, 0, 0)).getTime() ===
    new Date(new Date().setDate(new Date().getDate() + 1)).setHours(0, 0, 0, 0);

  const isPast = variant === "past";
  const isProcessing = processingBookingId === booking.id;
  const isPending = booking.status === "pending";
  const isDeclined = booking.status === "declined_by_restaurant";
  const isCompleted = booking.status === "completed";
  const isConfirmed = booking.status === "confirmed";

  // Calculate time since request for pending bookings
  const timeSinceRequest = isPending
    ? formatTimeAgo(new Date(booking.created_at))
    : null;

  const [hasReview, setHasReview] = useState(false);

  useEffect(() => {
    const checkReview = async () => {
      if (isCompleted) {
        const { data } = await supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", booking.id)
          .single();
        setHasReview(!!data);
      }
    };
    checkReview();
  }, [booking.id, isCompleted]);

  // --- Handlers (Unchanged from original) ---
  const handlePress = () => onPress?.();
  const handleRestaurantPress = (e: any) => {
    e.stopPropagation();
    onNavigateToRestaurant?.(booking.restaurant_id);
  };
  const handleCancelBooking = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCancel?.(booking.id);
  };
  const handleQuickCall = async (e: any) => {
    /* ... original implementation ... */
  };
  const handleDirections = async (e: any) => {
    e.stopPropagation();
    
    if (!booking.restaurant) return;

    // Extract coordinates from restaurant location
    const coords = extractLocationCoordinates(booking.restaurant.location);
    
    if (!coords) {
      Alert.alert("Error", "Location information not available");
      return;
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(booking.restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error("Error opening maps:", error);
        Alert.alert("Error", "Unable to open maps application");
      }
    }
  };
  const handleCopyConfirmation = async (e: any) => {
    /* ... original implementation ... */
  };
  const handleAddToCalendar = async (e: any) => {
    /* ... original implementation ... */
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
          <Pressable
            onPress={handleRestaurantPress}
            className="flex-row items-start justify-between"
          >
            <View className="flex-1">
              <H3 className="mb-1 text-lg">{booking.restaurant.name}</H3>
              <Text className="text-muted-foreground text-sm">
                {booking.restaurant.cuisine_type}
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
            {isPending && timeSinceRequest && (
              <Text className="text-xs text-muted-foreground">
                • {timeSinceRequest}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Booking Details */}
      <View className="px-4 pb-4">
        {/* --- Contextual Messages for Pending/Declined --- */}
        {isPending && (
          <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-3 border border-orange-200">
            <Text className="text-sm text-center text-orange-800 dark:text-orange-200">
              The restaurant will confirm your request shortly. We'll notify you
              as soon as they respond.
            </Text>
          </View>
        )}
        {isDeclined && (
          <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-3 border border-red-200">
            <Text className="text-sm text-center text-red-800 dark:text-red-200">
              Unfortunately, the restaurant couldn't accommodate this request.
              Please try another time.
            </Text>
          </View>
        )}

        {/* --- Core Details Section --- */}
        <View className="bg-muted/50 rounded-lg p-3 mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-row items-center gap-2">
              <CalendarIcon size={16} color="#666" />
              <Text className="font-medium text-sm">
                {isToday
                  ? "Today"
                  : isTomorrow
                    ? "Tomorrow"
                    : bookingDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
            {booking.confirmation_code && !isPending && (
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
            )}
          </View>
        </View>

        {/* Special Requests / Notes Preview */}
        {(booking.special_requests || booking.occasion) && (
          <View className="bg-muted/30 rounded-lg p-3 mb-3">
            {/* ... original implementation ... */}
          </View>
        )}

        {/* --- Quick Action Buttons (with updated logic) --- */}
        {showQuickActions && (
          <View className="flex-row gap-2 flex-wrap">
            {/* Add to Calendar: Show for confirmed or pending */}
            {!isPast && (isConfirmed || isPending) && (
              <Button
                size="sm"
                variant="outline"
                onPress={handleAddToCalendar}
                className="flex-1 min-w-[100px]"
              >
                <View className="flex-row items-center gap-1">
                  <CalendarPlus size={14} color="#3b82f6" />
                  <Text className="text-xs">Add to Calendar</Text>
                </View>
              </Button>
            )}

            {/* Directions & Call: Show only for confirmed */}
            {!isPast && isConfirmed && (
              <>
                <View className="flex-1 min-w-[100px]">
                  <DirectionsButton
                    restaurant={booking.restaurant}
                    variant="button"
                    size="sm"
                    className="w-full h-8 justify-center"
                    backgroundColor="bg-background"
                    borderColor="border-border"
                    iconColor="#3b82f6"
                    textColor="text-primary"
                  />
                </View>
                {booking.restaurant.phone_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handleQuickCall}
                    className="flex-1 min-w-[100px]"
                  >
                    <View className="flex-row items-center gap-1">
                      <Phone size={14} color="#10b981" />
                      <Text className="text-xs">Call</Text>
                    </View>
                  </Button>
                )}
              </>
            )}

            {/* Cancel: Show for pending or confirmed */}
            {!isPast && (isConfirmed || isPending) && (
              <Button
                size="sm"
                variant="destructive"
                onPress={handleCancelBooking}
                disabled={isProcessing}
                className="flex-1 min-w-[100px]"
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-1">
                    <XCircle size={14} color="#fff" />
                    <Text className="text-xs text-white">
                      {isPending ? "Cancel Request" : "Cancel Booking"}
                    </Text>
                  </View>
                )}
              </Button>
            )}

            {/* Actions for Past / Declined Bookings */}
            {isPast && isCompleted && !hasReview && onReview && (
              <Button
                size="sm"
                variant="default"
                onPress={handleReview}
                className="flex-1"
              >
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#fff" />
                  <Text className="text-xs text-white">Rate Experience</Text>
                </View>
              </Button>
            )}
            {(isPast || isDeclined) && onRebook && (
              <Button
                size="sm"
                variant="secondary"
                onPress={handleRebook}
                className="flex-1"
              >
                <View className="flex-row items-center gap-1">
                  <RotateCcw size={14} color="#000" />
                  <Text className="text-xs">Book Again</Text>
                </View>
              </Button>
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
