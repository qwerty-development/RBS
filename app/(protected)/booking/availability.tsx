// app/(protected)/booking/availability.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Calendar as CalendarIcon,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
  MapPin,
  CheckCircle,
  Gift,
  Trophy,
  Tag,
  Sparkles,
  QrCode,
  CalendarDays,
  X,
  Lock, // Added for guest view
  UserPlus, // Added for guest view
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Calendar } from "react-native-calendars";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";

import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";
import AvailabilityScreenSkeleton from "@/components/skeletons/AvailabilityScreenSkeleton";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface TimeSlot {
  time: string;
  available: boolean;
  availableCapacity: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// --- PartySizeSelector Component ---
const PartySizeSelector: React.FC<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxPartySize?: number;
}> = ({ partySize, onPartySizeChange, maxPartySize = 12 }) => {
  const [expanded, setExpanded] = useState(false);

  const partySizes = Array.from({ length: maxPartySize }, (_, i) => i + 1);

  if (expanded) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-semibold text-lg">Party Size</Text>
          <Pressable onPress={() => setExpanded(false)}>
            <ChevronUp size={24} color="#666" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {partySizes.map((size) => (
            <Pressable
              key={size}
              onPress={() => {
                onPartySizeChange(size);
                setExpanded(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`w-12 h-12 rounded-lg border-2 items-center justify-center ${
                partySize === size
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  partySize === size
                    ? "text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {size}
              </Text>
            </Pressable>
          ))}
        </View>

        {partySize > 8 && (
          <View className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <View className="flex-row items-start gap-2">
              <Info size={16} color="#f59e0b" />
              <Text className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
                Large parties may require special arrangements. The restaurant
                will confirm availability.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setExpanded(true)}
      className="bg-card border border-border rounded-xl p-4 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-3">
        <Users size={20} color="#3b82f6" />
        <View>
          <Text className="font-semibold">Party Size</Text>
          <Text className="text-sm text-muted-foreground">
            {partySize} {partySize === 1 ? "guest" : "guests"}
          </Text>
        </View>
      </View>
      <ChevronDown size={24} color="#666" />
    </Pressable>
  );
};

// --- Date Selector Component ---
const DateSelector: React.FC<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
}> = ({ selectedDate, onDateChange, maxDaysAhead = 30 }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    // Generate the normal date range
    for (let i = 0; i < maxDaysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    // Check if selected date is outside the normal range
    const selectedDateStr = selectedDate.toDateString();
    const isSelectedInRange = datesArray.some(
      (date) => date.toDateString() === selectedDateStr,
    );

    // If selected date is outside range and is in the future, add it at the beginning
    if (!isSelectedInRange && selectedDate > today) {
      const extendedArray = [selectedDate, ...datesArray];
      return extendedArray;
    }

    return datesArray;
  }, [maxDaysAhead, selectedDate]);

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  // Auto-scroll to selected date when it changes
  useEffect(() => {
    if (scrollViewRef.current && dates.length > 0) {
      const selectedDateStr = selectedDate.toDateString();
      const selectedIndex = dates.findIndex(
        (date) => date.toDateString() === selectedDateStr,
      );

      if (selectedIndex >= 0) {
        // Calculate scroll position (80px min-width + 12px gap = 92px per item)
        const scrollPosition = Math.max(0, selectedIndex * 92 - 100); // Center it more or less

        // Small delay to ensure the ScrollView is rendered
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: scrollPosition,
            animated: true,
          });
        }, 100);
      }
    }
  }, [selectedDate, dates]);

  const handleCalendarDateChange = useCallback(
    (day: any) => {
      const selectedDate = new Date(day.dateString);
      onDateChange(selectedDate);
      setShowCalendar(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onDateChange],
  );

  const openCalendar = useCallback(() => {
    setShowCalendar(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closeCalendar = useCallback(() => {
    setShowCalendar(false);
  }, []);

  // Calculate min and max dates
  const today = new Date();
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 6);

  const minDateString = today.toISOString().split("T")[0];
  const maxDateString = maxDate.toISOString().split("T")[0];
  const selectedDateString = selectedDate.toISOString().split("T")[0];

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3">
          <CalendarIcon size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Select Date</Text>
        </View>

        {/* Calendar Shortcut Button */}
        <Pressable
          onPress={openCalendar}
          className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
        >
          <CalendarDays size={20} color="#3b82f6" />
        </Pressable>
      </View>

      {/* Universal Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={closeCalendar}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={closeCalendar}
        >
          <Pressable
            className="bg-white dark:bg-gray-800 rounded-xl p-4 m-4 max-w-sm w-full"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-semibold text-lg text-gray-900 dark:text-white">
                Select Date
              </Text>
              <Pressable onPress={closeCalendar} className="p-1">
                <X size={24} color="#666" />
              </Pressable>
            </View>

            <Calendar
              current={selectedDateString}
              minDate={minDateString}
              maxDate={maxDateString}
              onDayPress={handleCalendarDateChange}
              monthFormat={"MMMM yyyy"}
              hideExtraDays={true}
              firstDay={1}
              enableSwipeMonths={true}
              theme={{
                backgroundColor: "transparent",
                calendarBackground: "transparent",
                textSectionTitleColor: "#666",
                selectedDayBackgroundColor: "#3b82f6",
                selectedDayTextColor: "#ffffff",
                todayTextColor: "#3b82f6",
                dayTextColor: "#2d3748",
                textDisabledColor: "#cbd5e0",
                dotColor: "#3b82f6",
                selectedDotColor: "#ffffff",
                arrowColor: "#3b82f6",
                monthTextColor: "#2d3748",
                indicatorColor: "#3b82f6",
                textDayFontFamily: "System",
                textMonthFontFamily: "System",
                textDayHeaderFontFamily: "System",
                textDayFontWeight: "400",
                textMonthFontWeight: "600",
                textDayHeaderFontWeight: "600",
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Out-of-range date indicator */}
      {dates.length > 1 && dates[0].getTime() > dates[1].getTime() && (
        <View className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <View className="flex-row items-center gap-2">
            <CalendarDays size={16} color="#3b82f6" />
            <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
              📅 Selected from calendar:{" "}
              {selectedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year:
                  selectedDate.getFullYear() !== new Date().getFullYear()
                    ? "numeric"
                    : undefined,
              })}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        <View className="flex-row gap-3">
          {dates.map((date, index) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();

            // Check if this is an out-of-range date (first item and not in normal sequence)
            const isOutOfRange =
              index === 0 &&
              dates.length > 1 &&
              date.getTime() > dates[1].getTime();

            return (
              <View key={date.toISOString()} className="relative">
                {/* Out of range indicator */}
                {isOutOfRange && (
                  <View className="absolute -top-2 -right-2 z-10 bg-blue-500 rounded-full px-2 py-1">
                    <Text className="text-white text-xs font-bold">📅</Text>
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    onDateChange(date);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`min-w-[80px] p-3 rounded-lg border-2 items-center ${
                    isSelected
                      ? "bg-primary border-primary"
                      : isOutOfRange
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                        : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium mb-1 ${
                      isSelected
                        ? "text-primary-foreground"
                        : isOutOfRange
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {date
                      .toLocaleDateString("en-US", { weekday: "short" })
                      .toUpperCase()}
                  </Text>
                  <Text
                    className={`text-lg font-bold mb-1 ${
                      isSelected
                        ? "text-primary-foreground"
                        : isOutOfRange
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? "text-primary-foreground"
                        : isOutOfRange
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                    }`}
                  >
                    {isToday
                      ? "Today"
                      : date.toLocaleDateString("en-US", { month: "short" })}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// --- Time Slots Component ---
const TimeSlots: React.FC<{
  availableSlots: TimeSlot[];
  selectedTime: string;
  onTimeChange: (time: string) => void;
  loading: boolean;
}> = ({ availableSlots, selectedTime, onTimeChange, loading }) => {
  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Clock size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Available Times</Text>
        </View>
        <View className="flex-row flex-wrap gap-3">
          {[...Array(6)].map((_, i) => (
            <View
              key={i}
              className="px-4 py-3 rounded-lg border-2 min-w-[80px] items-center bg-muted/50"
            >
              <View className="h-5 w-12 bg-muted rounded" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!availableSlots || availableSlots.length === 0) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Clock size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Available Times</Text>
        </View>
        <View className="items-center py-8">
          <Text className="text-muted-foreground text-center">
            No available times for this date and party size.
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Try selecting a different date or smaller party size.
          </Text>
        </View>
      </View>
    );
  }

  // Filter only available slots
  const availableTimeSlots = availableSlots.filter((slot) => slot.available);

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <Clock size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Available Times</Text>
      </View>

      {availableTimeSlots.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-muted-foreground text-center">
            No available times for this date and party size.
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Try selecting a different date or smaller party size.
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {availableTimeSlots.map((slot) => (
            <Pressable
              key={slot.time}
              onPress={() => {
                onTimeChange(slot.time);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`px-4 py-3 rounded-lg border-2 min-w-[80px] items-center ${
                selectedTime === slot.time
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedTime === slot.time
                    ? "text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {slot.time}
              </Text>
              {slot.availableCapacity <= 3 && slot.availableCapacity > 0 && (
                <Text className="text-xs text-orange-600 mt-1">
                  {slot.availableCapacity} left
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
};

// --- Preselected Offer Preview Component ---
const PreselectedOfferPreview: React.FC<{
  offerTitle: string;
  offerDiscount: number;
  redemptionCode: string;
  onRemove: () => void;
}> = ({ offerTitle, offerDiscount, redemptionCode, onRemove }) => {
  return (
    <View className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Sparkles size={20} color="#10b981" />
          <Text className="font-bold text-lg text-green-800 dark:text-green-200">
            Special Offer Applied!
          </Text>
        </View>
        <View className="bg-green-600 rounded-full px-3 py-1">
          <Text className="text-white font-bold text-sm">
            {offerDiscount}% OFF
          </Text>
        </View>
      </View>

      <View className="mb-3">
        <Text className="font-bold text-green-800 dark:text-green-200 mb-1">
          {offerTitle}
        </Text>
        <Text className="text-sm text-green-700 dark:text-green-300">
          This offer will be automatically applied to your booking
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
          <QrCode size={14} color="#10b981" />
          <Text className="text-green-800 dark:text-green-200 text-xs font-bold ml-1">
            Code: {redemptionCode.slice(-6).toUpperCase()}
          </Text>
        </View>

        <Pressable
          onPress={onRemove}
          className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1"
        >
          <Text className="text-green-800 dark:text-green-200 text-xs font-medium">
            Remove Offer
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

// --- Loyalty Preview Component ---
const LoyaltyPreview: React.FC<{
  earnablePoints: number;
  userTier: string;
  userPoints: number;
}> = ({ earnablePoints, userTier, userPoints }) => {
  return (
    <View className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <View className="flex-row items-center gap-3 mb-2">
        <Trophy size={20} color="#f59e0b" />
        <Text className="font-semibold text-lg">Loyalty Rewards</Text>
        <View className="bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded-full">
          <Text className="text-amber-800 dark:text-amber-200 font-bold text-xs">
            {userTier.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-amber-700 dark:text-amber-300">
            You'll earn
          </Text>
          <Text className="text-2xl font-bold text-amber-800 dark:text-amber-200">
            +{earnablePoints} points
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-sm text-amber-700 dark:text-amber-300">
            Current balance
          </Text>
          <Text className="text-lg font-bold text-amber-800 dark:text-amber-200">
            {userPoints} pts
          </Text>
        </View>
      </View>
    </View>
  );
};

// --- Regular Offers Preview Component ---
const OffersPreview: React.FC<{
  availableOffers: any[];
  onViewOffers: () => void;
}> = ({ availableOffers, onViewOffers }) => {
  if (availableOffers.length === 0) return null;

  return (
    <Pressable
      onPress={onViewOffers}
      className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <Gift size={20} color="#10b981" />
          <View>
            <Text className="font-semibold text-lg text-green-800 dark:text-green-200">
              {availableOffers.length} Special Offer
              {availableOffers.length > 1 ? "s" : ""} Available
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              Apply discounts during booking
            </Text>
          </View>
        </View>
        <View className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
          <Text className="text-green-800 dark:text-green-200 font-bold text-sm">
            Save up to{" "}
            {Math.max(
              ...availableOffers.map((o) => o.discount_percentage || 0),
            )}
            %
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

// --- Main Component ---
export default function AvailabilitySelectionScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const { profile, isGuest, convertGuestToUser } = useAuth();

  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    preselectedOfferId?: string;
    offerTitle?: string;
    offerDiscount?: string;
    redemptionCode?: string;
  }>();

  // --- Guest View ---
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center px-4 py-4 border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
          <View className="flex-1 mx-4">
            <H3 className="text-center font-semibold">Book a Table</H3>
            <Muted className="text-sm text-center">{params.restaurantName}</Muted>
          </View>
           <View className="w-10" />
        </View>

        <View className="flex-1 items-center justify-center px-6 text-center">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <Lock size={48} className="text-primary" />
          </View>
          <H2 className="text-center mb-3">Sign Up to Book</H2>
          <P className="text-center text-muted-foreground mb-8">
            Create a free account to make reservations at {params.restaurantName}{" "}
            and thousands of other restaurants. It only takes a minute!
          </P>

          <View className="w-full max-w-sm gap-4">
            <Button onPress={convertGuestToUser} size="lg">
              <UserPlus size={20} color="#fff" />
              <Text className="ml-2 font-bold text-white">
                Sign Up & Continue Booking
              </Text>
            </Button>
            <Button onPress={() => router.back()} size="lg" variant="outline">
              <Text>Back to Restaurant</Text>
            </Button>
          </View>
          
          {params.offerDiscount && (
            <View className="mt-6 bg-green-500/10 rounded-lg px-4 py-3 w-full max-w-sm">
              <Text className="text-sm text-center text-green-600 dark:text-green-400 font-medium">
                Your {params.offerDiscount}% discount will be saved for when you sign up!
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --- Authenticated User Logic & State ---
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
  } | null>(null);

  const {
    restaurant,
    availableSlots,
    loadingSlots,
    fetchAvailableSlots,
  } = useRestaurant(params.restaurantId);
  const { userPoints = 0, userTier = "bronze", calculateBookingPoints } = useLoyalty() || {};
  const { offers = [] } = useOffers() || {};

  useEffect(() => {
    if (params.preselectedOfferId && params.offerTitle && params.offerDiscount && params.redemptionCode) {
      setPreselectedOffer({
        id: params.preselectedOfferId,
        title: params.offerTitle,
        discount: parseInt(params.offerDiscount, 10),
        redemptionCode: params.redemptionCode,
      });
    }
  }, [params.preselectedOfferId, params.offerTitle, params.offerDiscount, params.redemptionCode]);

  useEffect(() => {
    if (restaurant && fetchAvailableSlots) {
      fetchAvailableSlots(selectedDate, partySize);
    }
  }, [selectedDate, partySize, restaurant, fetchAvailableSlots]);

  const earnablePoints = useMemo(() => {
    if (!restaurant || !calculateBookingPoints) return 0;
    return calculateBookingPoints(partySize, restaurant.price_range || 2);
  }, [calculateBookingPoints, partySize, restaurant]);

  const availableOffers = useMemo(() => {
    return offers.filter(
      (offer: any) =>
        offer &&
        offer.restaurant_id === params.restaurantId &&
        !offer.usedAt &&
        new Date(offer.expiresAt || offer.valid_until) > new Date() &&
        offer.id !== preselectedOffer?.id,
    );
  }, [offers, params.restaurantId, preselectedOffer]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTime("");
  }, []);

  const handleContinueBooking = useCallback(() => {
    if (!selectedTime || !restaurant) {
      Alert.alert("Please select a time", "You need to select an available time slot to continue.");
      return;
    }
    const navigationParams: any = {
      restaurantId: params.restaurantId,
      restaurantName: restaurant.name,
      date: selectedDate.toISOString(),
      time: selectedTime,
      partySize: partySize.toString(),
      earnablePoints: earnablePoints.toString(),
    };
    if (preselectedOffer) {
      navigationParams.offerId = preselectedOffer.id;
      navigationParams.offerTitle = preselectedOffer.title;
      navigationParams.offerDiscount = preselectedOffer.discount.toString();
      navigationParams.redemptionCode = preselectedOffer.redemptionCode;
    }
    router.push({ pathname: "/booking/create", params: navigationParams });
  }, [selectedTime, restaurant, router, selectedDate, partySize, earnablePoints, preselectedOffer]);
  
  const handleViewOffers = useCallback(() => {
    router.push({
      pathname: "/offers",
      params: { restaurantId: params.restaurantId, returnTo: "availability" },
    });
  }, [router, params.restaurantId]);

  const handleRemovePreselectedOffer = useCallback(() => {
    Alert.alert("Remove Offer", "Are you sure you want to remove this offer from your booking?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { setPreselectedOffer(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } },
    ]);
  }, []);

  if (!restaurant) {
    return <AvailabilityScreenSkeleton />;
  }

  // --- Authenticated User View ---
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text className="text-center font-semibold">Select Date & Time</Text>
          <Muted className="text-center text-sm">{restaurant.name}</Muted>
        </View>
        <View className="w-10" />
      </View>
      <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border">
        <View className="flex-row gap-3">
          <Image source={{ uri: restaurant.main_image_url }} className="w-16 h-16 rounded-lg" contentFit="cover" />
          <View className="flex-1">
            <H3 className="mb-1">{restaurant.name}</H3>
            <View className="flex-row items-center gap-2 mb-1">
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-medium">{restaurant.average_rating?.toFixed(1) || "4.5"}</Text>
              <Text className="text-sm text-muted-foreground">•</Text>
              <Text className="text-sm text-muted-foreground">{restaurant.cuisine_type}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color="#666" />
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>{restaurant.address}</Text>
            </View>
          </View>
        </View>
      </View>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-4">
          {preselectedOffer && <PreselectedOfferPreview offerTitle={preselectedOffer.title} offerDiscount={preselectedOffer.discount} redemptionCode={preselectedOffer.redemptionCode} onRemove={handleRemovePreselectedOffer} />}
          <PartySizeSelector partySize={partySize} onPartySizeChange={setPartySize} maxPartySize={12} />
          <DateSelector selectedDate={selectedDate} onDateChange={handleDateChange} maxDaysAhead={restaurant.booking_window_days || 30} />
          <TimeSlots availableSlots={availableSlots || []} selectedTime={selectedTime} onTimeChange={setSelectedTime} loading={loadingSlots || false} />
          {profile && <LoyaltyPreview earnablePoints={earnablePoints} userTier={userTier} userPoints={userPoints} />}
          {!preselectedOffer && <OffersPreview availableOffers={availableOffers} onViewOffers={handleViewOffers} />}
          <View className="bg-muted/30 rounded-xl p-4"><Text className="font-semibold mb-2">Booking Information</Text><View className="gap-2"><Text className="text-sm text-muted-foreground">• {restaurant.booking_policy === "instant" ? "Instant confirmation" : "Confirmation within 2 hours"}</Text>{restaurant.cancellation_window_hours && <Text className="text-sm text-muted-foreground">• Free cancellation up to {restaurant.cancellation_window_hours} hours before</Text>}<Text className="text-sm text-muted-foreground">• Please arrive on time to keep your reservation</Text>{preselectedOffer && <Text className="text-sm text-green-600 dark:text-green-400">• Your {preselectedOffer.discount}% discount will be applied automatically</Text>}</View></View>
        </View>
      </ScrollView>
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="font-semibold">{selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{selectedTime && ` at ${selectedTime}`}</Text>
            <View className="flex-row items-center gap-2"><Text className="text-sm text-muted-foreground">Party of {partySize} • Earn {earnablePoints} points</Text>{preselectedOffer && <><Text className="text-sm text-muted-foreground">•</Text><Text className="text-sm font-medium text-green-600 dark:text-green-400">{preselectedOffer.discount}% OFF applied</Text></>}</View>
          </View>
          <Button onPress={handleContinueBooking} disabled={!selectedTime} className="px-6"><Text className="text-white font-bold">Continue</Text></Button>
        </View>
      </View>
    </SafeAreaView>
  );
}