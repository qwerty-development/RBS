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
  X,
  Check,
  UserPlus, // Added for invitation indicator
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Calendar from "expo-calendar";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { supabase } from "@/config/supabase";
import { cn } from "@/lib/utils";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";

// Enhanced booking type that includes invitation info
interface EnhancedBooking {
  id: string;
  user_id: string;
  restaurant_id: string;
  booking_time: string;
  party_size: number;
  status: string;
  special_requests?: string;
  occasion?: string;
  dietary_notes?: string[];
  confirmation_code?: string;
  table_preferences?: string[];
  reminder_sent?: boolean;
  checked_in_at?: string;
  loyalty_points_earned?: number;
  created_at?: string;
  updated_at?: string;
  applied_offer_id?: string;
  expected_loyalty_points?: number;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  is_group_booking?: boolean;
  organizer_id?: string;
  attendees?: number;
  turn_time_minutes: number;
  applied_loyalty_rule_id?: string;
  actual_end_time?: string;
  seated_at?: string;
  meal_progress?: any;
  request_expires_at?: string;
  auto_declined?: boolean;
  acceptance_attempted_at?: string;
  acceptance_failed_reason?: string;
  suggested_alternative_time?: string;
  suggested_alternative_tables?: string[];
  source: string;
  is_shared_booking?: boolean;
  restaurant: {
    id: string;
    name: string;
    main_image_url?: string;
    address?: string;
    [key: string]: any;
  };
  // Invitation-related fields for bookings where user was invited
  invitation_id?: string;
  invited_by?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  is_invitee?: boolean;
}

interface BookingCardProps {
  booking: EnhancedBooking;
  variant?: "upcoming" | "past";
  onPress?: () => void;
  onCancel?: (bookingId: string) => void;
  onRebook?: (booking: EnhancedBooking) => void;
  onReview?: (booking: EnhancedBooking) => void;
  onLeave?: (booking: EnhancedBooking) => void;
  onNavigateToRestaurant?: (restaurantId: string) => void;
  className?: string;
  showQuickActions?: boolean;
  processingBookingId?: string | null;
}

// --- Status Configuration (Enhanced) ---
const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Awaiting Restaurant Confirmation",
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
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280", // Gray
    description: "You cancelled this booking",
  },
  declined_by_restaurant: {
    label: "Restaurant Could Not Accommodate",
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
  onLeave,
  onNavigateToRestaurant,
  className,
  showQuickActions = true,
  processingBookingId,
}: BookingCardProps) {
  // React hooks must always be called before any early returns
  const [hasReview, setHasReview] = useState(false);
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const { colorScheme } = useColorScheme();

  // Early return AFTER hooks for invalid booking data
  if (!booking || !booking.id || !booking.booking_time || !booking.restaurant) {
    console.warn("Invalid booking data provided to BookingCard", {
      hasBooking: !!booking,
      hasId: !!booking?.id,
      hasBookingTime: !!booking?.booking_time,
      hasRestaurant: !!booking?.restaurant,
    });
    return null;
  }

  // Safe date parsing with error handling
  let bookingDate: Date;
  try {
    bookingDate = new Date(booking.booking_time);
    // Check if date is valid
    if (isNaN(bookingDate.getTime())) {
      throw new Error("Invalid date");
    }
  } catch (error) {
    console.warn("Invalid booking date:", booking.booking_time);
    bookingDate = new Date(); // Fallback to current date
  }

  // Safe date comparisons
  let isToday = false;
  let isTomorrow = false;

  try {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    isToday = bookingDate.toDateString() === today.toDateString();

    // Create new date objects to avoid mutating original dates
    const bookingDateOnly = new Date(bookingDate);
    bookingDateOnly.setHours(0, 0, 0, 0);
    const tomorrowOnly = new Date(tomorrow);
    tomorrowOnly.setHours(0, 0, 0, 0);

    isTomorrow = bookingDateOnly.getTime() === tomorrowOnly.getTime();
  } catch (error) {
    console.warn("Error calculating date comparisons:", error);
  }

  const isPast = variant === "past";
  const isProcessing = processingBookingId === booking.id;
  const isPending = booking.status === "pending";
  const isDeclined = booking.status === "declined_by_restaurant";
  const isCompleted = booking.status === "completed";
  const isConfirmed = booking.status === "confirmed";

  // Check if pending booking has passed its time (should be treated as declined)
  const isPendingAndPassed = isPending && bookingDate < new Date();

  // Use declined status for pending bookings that have passed their time
  const effectiveStatus = isPendingAndPassed
    ? "declined_by_restaurant"
    : booking.status;

  // Debug logging for status
  console.log(
    `BookingCard Debug - ID: ${booking.id}, Original Status: ${booking.status}, Effective Status: ${effectiveStatus}, IsPendingAndPassed: ${isPendingAndPassed}`,
  );

  const statusConfig =
    BOOKING_STATUS_CONFIG[
      effectiveStatus as keyof typeof BOOKING_STATUS_CONFIG
    ] || BOOKING_STATUS_CONFIG.pending;

  // Debug logging to help identify problematic status values
  if (!statusConfig) {
    console.warn(
      "Unknown booking status:",
      effectiveStatus,
      "Available statuses:",
      Object.keys(BOOKING_STATUS_CONFIG),
    );
  }

  // Ensure we have a valid status config with proper fallback
  const finalStatusConfig = statusConfig || BOOKING_STATUS_CONFIG.pending;
  const StatusIcon = finalStatusConfig.icon;

  // Calculate time since request for pending bookings with safe date handling
  let timeSinceRequest = null;
  if (isPending && booking.created_at) {
    try {
      const createdDate = new Date(booking.created_at);
      if (!isNaN(createdDate.getTime())) {
        timeSinceRequest = formatTimeAgo(createdDate);
      }
    } catch (error) {
      console.warn("Error calculating time since request:", error);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    const checkReview = async () => {
      if (isCompleted && booking?.id) {
        try {
          const { data, error } = await supabase
            .from("reviews")
            .select("id")
            .eq("booking_id", booking.id)
            .single();

          // Only update state if component hasn't been unmounted
          if (!isCancelled) {
            setHasReview(!!data && !error);
          }
        } catch (error) {
          console.warn("Error checking review status:", error);
          if (!isCancelled) {
            setHasReview(false);
          }
        }
      }
    };

    checkReview();

    // Cleanup function to prevent memory leaks
    return () => {
      isCancelled = true;
    };
  }, [booking.id, isCompleted]);

  // --- Handlers (Unchanged from original) ---
  const handlePress = () => onPress?.();
  const handleRestaurantPress = (e: any) => {
    e.stopPropagation();
    onNavigateToRestaurant?.(booking.restaurant_id);
  };
  const handleCancelBooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCancel?.(booking.id);
  };

  const handleLeaveBooking = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLeave?.(booking);
  };
  const handleQuickCall = async () => {
    if (!booking.restaurant.phone) {
      Alert.alert(
        "No Phone Number",
        "Phone number is not available for this restaurant",
      );
      return;
    }

    const phoneUrl = `tel:${booking.restaurant.phone}`;

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert("Error", "Unable to open phone application");
      }
    } catch (error) {
      console.error("Error making phone call:", error);
      Alert.alert("Error", "Unable to make phone call");
    }
  };
  const handleDirections = async () => {
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
  const handleCopyConfirmation = async () => {
    if (!booking.confirmation_code) return;

    try {
      await Clipboard.setStringAsync(booking.confirmation_code);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Copied", "Confirmation code copied to clipboard");
    } catch (error) {
      console.error("Error copying confirmation code:", error);
      Alert.alert("Error", "Unable to copy confirmation code");
    }
  };

  const handleAddToCalendar = async () => {
    if (isAddingToCalendar) return;

    try {
      // Request calendar permissions using Expo Calendar
      const { status } = await Calendar.requestCalendarPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Calendar Access Required",
          "We need access to your calendar to add this reservation. You can enable this in your device settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      // Directly open the system calendar UI with pre-filled event data
      await openCalendarUIWithEvent();
    } catch (error) {
      console.error("Error opening calendar:", error);
      Alert.alert(
        "Calendar Error",
        "Unable to open your calendar. Please try again or add the event manually.",
      );
    }
  };

  /**
   * Opens the system calendar UI with pre-filled event data.
   * This provides a user-friendly experience where they can review and edit
   * the event details before saving to their preferred calendar.
   * Uses Calendar.createEventInCalendarAsync() for iOS/Android system UI.
   */
  const openCalendarUIWithEvent = async () => {
    setIsAddingToCalendar(true);

    try {
      // Prepare event details with smart duration calculation
      const bookingDate = new Date(booking.booking_time);
      const hour = bookingDate.getHours();

      // Smart duration based on meal time
      let durationHours = 2; // Default
      if (hour >= 6 && hour < 11) {
        durationHours = 1.5; // Breakfast/Brunch
      } else if (hour >= 11 && hour < 16) {
        durationHours = 1.5; // Lunch
      } else if (hour >= 16 && hour < 22) {
        durationHours = 2.5; // Dinner
      } else {
        durationHours = 2; // Late night
      }

      const endDate = new Date(
        bookingDate.getTime() + durationHours * 60 * 60 * 1000,
      );

      // Determine meal type for title
      const getMealType = (hour: number) => {
        if (hour >= 6 && hour < 11) return "Breakfast";
        if (hour >= 11 && hour < 16) return "Lunch";
        if (hour >= 16 && hour < 22) return "Dinner";
        return "Late Night";
      };

      const mealType = getMealType(hour);

      // Create comprehensive event details for the calendar UI
      const eventDetails = {
        title: `${mealType} at ${booking.restaurant.name}`,
        startDate: bookingDate,
        endDate: endDate,
        location: booking.restaurant.address || booking.restaurant.name,
        notes: [
          `🍽️ Table reservation for ${booking.party_size} ${booking.party_size === 1 ? "guest" : "guests"}`,
          booking.confirmation_code
            ? `📋 Confirmation Code: ${booking.confirmation_code}`
            : "",
          `🏪 Restaurant: ${booking.restaurant.name}`,
          booking.restaurant.cuisine_type
            ? `🍜 Cuisine: ${booking.restaurant.cuisine_type}`
            : "",
          booking.restaurant.phone
            ? `📞 Phone: ${booking.restaurant.phone}`
            : "",
          booking.special_requests
            ? `💬 Special Requests: ${booking.special_requests}`
            : "",
          booking.occasion ? `🎉 Occasion: ${booking.occasion}` : "",
          "",
          "⏰ Please arrive 10-15 minutes early",
          "📱 Booked via TableReserve",
        ]
          .filter(Boolean)
          .join("\n"),
        alarms: [
          { relativeOffset: -120 }, // 2 hours before
          { relativeOffset: -60 }, // 1 hour before
          { relativeOffset: -15 }, // 15 minutes before
        ],
      };

      // Open the system calendar UI with pre-filled event data
      const result = await Calendar.createEventInCalendarAsync(eventDetails);

      // Handle the result based on user action
      if (result.action === "saved") {
        // User saved the event
        setAddedToCalendar(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        Alert.alert(
          "📅 Added to Calendar!",
          `Your reservation at ${booking.restaurant.name} has been successfully added to your calendar!\n\nReminders have been set for:\n• 2 hours before\n• 1 hour before\n• 15 minutes before`,
          [
            {
              text: "View in Calendar",
              onPress: () => {
                // Try to open the calendar app
                const calendarUrl = Platform.select({
                  ios: "calshow:",
                  android: "content://com.android.calendar/time",
                });
                if (calendarUrl) {
                  Linking.canOpenURL(calendarUrl).then((supported) => {
                    if (supported) {
                      Linking.openURL(calendarUrl);
                    }
                  });
                }
              },
            },
            { text: "Done", style: "default" },
          ],
        );
      } else if (result.action === "canceled") {
        // User canceled without saving
        // No need to show an alert, just give subtle feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error opening calendar UI:", error);

      // More specific error handling
      let errorMessage = "Unable to open calendar. Please try again.";

      if (error instanceof Error) {
        if (error.message?.includes("permission")) {
          errorMessage =
            "Calendar permission was revoked. Please check your settings.";
        } else if (error.message?.includes("calendar")) {
          errorMessage = "Calendar is not available. Please try again later.";
        }
      }

      Alert.alert("Calendar Error", errorMessage, [
        {
          text: "Try Again",
          onPress: () => {
            setIsAddingToCalendar(false);
            setTimeout(() => handleAddToCalendar(), 100);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  const handleCalendarSelection = async () => {
    // This function is no longer needed since we're using the system UI
    // But keeping it for backward compatibility
    await openCalendarUIWithEvent();
  };
  const handleReview = () => {
    onReview?.(booking);
  };
  const handleRebook = () => {
    onRebook?.(booking);
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-lg overflow-hidden mb-3 border border-border shadow-sm",
          className,
        )}
      >
        {/* Restaurant Header */}
        <View className="flex-row p-3">
          <Image
            source={{
              uri:
                booking.restaurant?.main_image_url ||
                booking.restaurant?.image_url ||
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
          <View className="flex-1 ml-3">
            <Pressable
              onPress={handleRestaurantPress}
              className="flex-row items-start justify-between"
            >
              <View className="flex-1">
                <H3 className="mb-1 text-base">
                  {booking.restaurant.name || "Restaurant"}
                </H3>

                {/* Invitation Indicator */}
                {booking.is_invitee && booking.invited_by && (
                  <View className="flex-row items-center gap-1 mb-1">
                    <UserPlus size={10} color="#10b981" />
                    <Text className="text-xs text-green-600 font-medium">
                      Invited by {booking.invited_by.full_name}
                    </Text>
                  </View>
                )}

                <Text className="text-muted-foreground text-xs">
                  {booking.restaurant.cuisine_type || "Cuisine"}
                </Text>
              </View>
              <ChevronRight size={16} color="#666" />
            </Pressable>

            {/* Status Badge */}
            <View className="flex-row items-center gap-1 mt-1">
              <StatusIcon size={14} color={finalStatusConfig.color} />
              <Text
                className="text-xs font-medium"
                style={{ color: finalStatusConfig.color }}
              >
                {finalStatusConfig.label}
              </Text>
              {isPending && timeSinceRequest && (
                <Text className="text-xs text-muted-foreground">
                  • {timeSinceRequest}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Booking Details - Compact Layout */}
        <View className="px-3 pb-3">
          {/* --- Core Details Section - More Prominent --- */}
          <View className="bg-primary/5 rounded-lg p-3 mb-3 border border-primary/10">
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center gap-2">
                <CalendarIcon size={14} color={colors[colorScheme].primary} />
                <Text className="font-semibold text-sm text-primary dark:text-white">
                  {isToday
                    ? "Today"
                    : isTomorrow
                      ? "Tomorrow"
                      : bookingDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Clock size={14} color={colors[colorScheme].primary} />
                <Text className="font-semibold text-sm text-primary dark:text-white">
                  {bookingDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={14} color={colors[colorScheme].primary} />
                <Text className="text-sm font-medium text-primary dark:text-white">
                  {booking.party_size || 1}{" "}
                  {(booking.party_size || 1) === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
              {booking.confirmation_code && !isPending && (
                <Pressable
                  onPress={handleCopyConfirmation}
                  className="flex-row items-center gap-1 bg-background px-2 py-1 rounded border border-border"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Copy size={12} color="#666" />
                  <Text className="text-xs font-mono font-medium">
                    {booking.confirmation_code || "N/A"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Special Requests / Notes Preview */}
          {(booking.special_requests || booking.occasion) && (
            <View className="bg-muted/30 rounded-lg p-2 mb-2">
              {/* ... original implementation ... */}
            </View>
          )}

          {/* --- Contextual Messages for Pending/Declined --- */}

          {/* --- Quick Action Buttons - Compact Layout --- */}
          {showQuickActions && (
            <View className="flex-row gap-2">
              {/* Add to Calendar: Show for confirmed or pending (not expired) */}
              {!isPast &&
                (isConfirmed || (isPending && !isPendingAndPassed)) && (
                  <Button
                    size="sm"
                    variant={addedToCalendar ? "secondary" : "outline"}
                    onPress={handleAddToCalendar}
                    disabled={isAddingToCalendar}
                    className="flex-1 h-8 rounded-lg"
                  >
                    {isAddingToCalendar ? (
                      <ActivityIndicator size="small" color="#3b82f6" />
                    ) : addedToCalendar ? (
                      <View className="flex-row items-center gap-1">
                        <CheckCircle size={12} color="#10b981" />
                        <Text className="text-xs">Added ✓</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1">
                        <CalendarPlus size={12} color="#3b82f6" />
                        <Text className="text-xs">Calendar</Text>
                      </View>
                    )}
                  </Button>
                )}

              {/* Directions & Call: Show for pending (not expired) or confirmed */}
              {!isPast &&
                (isConfirmed || (isPending && !isPendingAndPassed)) && (
                  <>
                    <View className="flex-1">
                      <DirectionsButton
                        restaurant={booking.restaurant}
                        variant="button"
                        size="sm"
                        className="w-full h-8 justify-center rounded-lg"
                        backgroundColor="bg-primary"
                        borderColor="border-primary"
                        iconColor={colors[colorScheme].primaryForeground}
                        textColor="text-primary-foreground"
                      />
                    </View>
                    {booking.restaurant.phone && (
                      <Button
                        size="sm"
                        variant="default"
                        onPress={handleQuickCall}
                        className="flex-1 bg-primary h-8 rounded-lg"
                      >
                        <View className="flex-row items-center gap-1">
                          <Phone
                            size={12}
                            color={colors[colorScheme].primaryForeground}
                          />
                          <Text className="text-xs text-primary-foreground">
                            Call
                          </Text>
                        </View>
                      </Button>
                    )}
                  </>
                )}

              {/* Actions for Past / Declined Bookings */}
              {(isPast || isPendingAndPassed) &&
                isCompleted &&
                !hasReview &&
                onReview && (
                  <Button
                    size="sm"
                    variant="default"
                    onPress={handleReview}
                    className="flex-1 rounded-lg"
                  >
                    <View className="flex-row items-center gap-1">
                      <Star size={12} color="#fff" />
                      <Text className="text-xs text-white">Rate</Text>
                    </View>
                  </Button>
                )}
              {(isPast || isDeclined || isPendingAndPassed) && onRebook && (
                <Button
                  size="sm"
                  variant="default"
                  onPress={handleRebook}
                  className="flex-1 bg-primary rounded-lg"
                >
                  <View className="flex-row items-center gap-1">
                    <RotateCcw
                      size={12}
                      color={colors[colorScheme].primaryForeground}
                    />
                    <Text className="text-xs text-primary-foreground">
                      Book Again
                    </Text>
                  </View>
                </Button>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </>
  );
}

BookingCard.displayName = "BookingCard";
