// app/(protected)/booking/availability.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Calendar,
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
  Wifi,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";

import { useColorScheme } from "@/lib/useColorScheme";
import { getMaxBookingWindow } from "@/lib/tableManagementUtils";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useAvailability } from "@/hooks/useAvailability";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Party Size Selector Component
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

// Date Selector Component
const DateSelector: React.FC<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
}> = ({ selectedDate, onDateChange, maxDaysAhead = 30 }) => {
  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    for (let i = 0; i < maxDaysAhead; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    return datesArray;
  }, [maxDaysAhead]);

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

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <Calendar size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Select Date</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {dates.map((date) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => {
                  onDateChange(date);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`min-w-[80px] p-3 rounded-lg border-2 items-center ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium mb-1 ${
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {date
                    .toLocaleDateString("en-US", { weekday: "short" })
                    .toUpperCase()}
                </Text>
                <Text
                  className={`text-lg font-bold mb-1 ${
                    isSelected ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {date.getDate()}
                </Text>
                <Text
                  className={`text-xs ${
                    isSelected
                      ? "text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {isToday
                    ? "Today"
                    : date.toLocaleDateString("en-US", { month: "short" })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// NEW: Enhanced Time Slots Component with Table Info
const TimeSlots: React.FC<{
  slots: any[];
  selectedTime: string;
  onTimeChange: (time: string, slot: any) => void;
  loading: boolean;
  showTableInfo?: boolean;
}> = ({ slots, selectedTime, onTimeChange, loading, showTableInfo = true }) => {
  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Clock size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Available Times</Text>
          <View className="bg-blue-100 dark:bg-blue-900/20 rounded-full px-2 py-1 ml-auto">
            <View className="flex-row items-center gap-1">
              <Wifi size={12} color="#3b82f6" />
              <Text className="text-xs text-blue-600 dark:text-blue-400">Live</Text>
            </View>
          </View>
        </View>
        <View className="items-center py-8">
          <ActivityIndicator size="large" />
          <Text className="text-muted-foreground text-center mt-2">
            Checking real-time availability...
          </Text>
        </View>
      </View>
    );
  }

  if (!slots || slots.length === 0) {
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

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <Clock size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Available Times</Text>
        <View className="bg-green-100 dark:bg-green-900/20 rounded-full px-2 py-1 ml-auto">
          <View className="flex-row items-center gap-1">
            <CheckCircle size={12} color="#10b981" />
            <Text className="text-xs text-green-600 dark:text-green-400">
              {slots.length} slots
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {slots.map((slot) => (
          <Pressable
            key={slot.time}
            onPress={() => {
              onTimeChange(slot.time, slot);
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
            {showTableInfo && slot.tables && (
              <>
                {slot.requiresCombination ? (
                  <Text className="text-xs text-orange-600 mt-1">Combined</Text>
                ) : (
                  <Text className="text-xs text-muted-foreground mt-1">
                    {slot.tables[0]?.table_type}
                  </Text>
                )}
              </>
            )}
          </Pressable>
        ))}
      </View>

      {selectedTime && (
        <View className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <CheckCircle size={16} color="#10b981" />
            <Text className="text-sm text-green-800 dark:text-green-200">
              Selected: {selectedTime}
            </Text>
            {slots.find(s => s.time === selectedTime)?.tables && (
              <Text className="text-xs text-green-700 dark:text-green-300">
                • {slots.find(s => s.time === selectedTime)?.requiresCombination 
                   ? "Tables will be combined" 
                   : "Single table"}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// Preselected Offer Preview Component (unchanged)
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

// Loyalty Preview Component (unchanged)
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

// Regular Offers Preview Component (unchanged)
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
              ...availableOffers.map((o) => o.discount_percentage || 0)
            )}
            %
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export default function AvailabilitySelectionScreen() {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();

  // Get offer parameters from navigation
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    preselectedOfferId?: string;
    offerTitle?: string;
    offerDiscount?: string;
    redemptionCode?: string;
  }>();

  // State management
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [partySize, setPartySize] = useState(2);
  const [maxBookingDays, setMaxBookingDays] = useState(30);

  // Track preselected offer
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
  } | null>(null);

  // Custom hooks
  const { restaurant, loading: restaurantLoading } = useRestaurant(params.restaurantId);

  // NEW: Use real-time availability hook
  const { slots, loading: slotsLoading, error } = useAvailability({
    restaurantId: params.restaurantId,
    date: selectedDate,
    partySize,
    enableRealtime: true,
  });

  const {
    userPoints = 0,
    userTier = "bronze",
    calculateBookingPoints,
  } = useLoyalty() || {};
  const { offers = [] } = useOffers() || {};

  // Initialize preselected offer from params
  useEffect(() => {
    if (
      params.preselectedOfferId &&
      params.offerTitle &&
      params.offerDiscount &&
      params.redemptionCode
    ) {
      setPreselectedOffer({
        id: params.preselectedOfferId,
        title: params.offerTitle,
        discount: parseInt(params.offerDiscount, 10),
        redemptionCode: params.redemptionCode,
      });
    }
  }, [
    params.preselectedOfferId,
    params.offerTitle,
    params.offerDiscount,
    params.redemptionCode,
  ]);

  useEffect(() => {
    async function fetchMaxDays() {
      if (profile?.id && restaurant?.id) {
        const days = await getMaxBookingWindow(
          profile.id,
          restaurant.id,
          restaurant.booking_window_days || 30
        );
        setMaxBookingDays(days);
      }
    }
    fetchMaxDays();
  }, [profile, restaurant]);

  // Computed values
  const earnablePoints = useMemo(() => {
    if (!restaurant || !calculateBookingPoints) return 0;
    return calculateBookingPoints(partySize, restaurant.price_range || 2);
  }, [calculateBookingPoints, partySize, restaurant]);

  // Get available offers (excluding preselected one)
  const availableOffers = useMemo(() => {
    return offers.filter(
      (offer) =>
        offer &&
        offer.restaurant_id === params.restaurantId &&
        !offer.usedAt &&
        new Date(offer.expiresAt || offer.valid_until) > new Date() &&
        offer.id !== preselectedOffer?.id
    );
  }, [offers, params.restaurantId, preselectedOffer]);

  // Event handlers
  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTime(""); // Reset time when date changes
    setSelectedSlot(null);
  }, []);

  const handleTimeChange = useCallback((time: string, slot: any) => {
    setSelectedTime(time);
    setSelectedSlot(slot);
  }, []);

  // Continue booking with selected slot
  const handleContinueBooking = useCallback(() => {
    if (!selectedTime || !restaurant) {
      Alert.alert(
        "Please select a time",
        "You need to select an available time slot to continue."
      );
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

    // NEW: Pass table information
    if (selectedSlot?.tables) {
      navigationParams.tableIds = JSON.stringify(
        selectedSlot.tables.map((t: any) => t.id)
      );
      navigationParams.requiresCombination = selectedSlot.requiresCombination
        ? "true"
        : "false";
    }

    // Include preselected offer if available
    if (preselectedOffer) {
      navigationParams.offerId = preselectedOffer.id;
      navigationParams.offerTitle = preselectedOffer.title;
      navigationParams.offerDiscount = preselectedOffer.discount.toString();
      navigationParams.redemptionCode = preselectedOffer.redemptionCode;
    }

    router.push({
      pathname: "/booking/create",
      params: navigationParams,
    });
  }, [
    selectedTime,
    selectedSlot,
    restaurant,
    router,
    params.restaurantId,
    selectedDate,
    partySize,
    earnablePoints,
    preselectedOffer,
  ]);

  const handleViewOffers = useCallback(() => {
    router.push({
      pathname: "/offers",
      params: {
        restaurantId: params.restaurantId,
        returnTo: "availability",
      },
    });
  }, [router, params.restaurantId]);

  // Remove preselected offer
  const handleRemovePreselectedOffer = useCallback(() => {
    Alert.alert(
      "Remove Offer",
      "Are you sure you want to remove this offer from your booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setPreselectedOffer(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]
    );
  }, []);

  // Loading state
  if (!restaurant || restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
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

      {/* Restaurant Info Card */}
      <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border">
        <View className="flex-row gap-3">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-16 h-16 rounded-lg"
            contentFit="cover"
          />
          <View className="flex-1">
            <H3 className="mb-1">{restaurant.name}</H3>
            <View className="flex-row items-center gap-2 mb-1">
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-medium">
                {restaurant.average_rating?.toFixed(1) || "4.5"}
              </Text>
              <Text className="text-sm text-muted-foreground">•</Text>
              <Text className="text-sm text-muted-foreground">
                {restaurant.cuisine_type}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <MapPin size={12} color="#666" />
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {restaurant.address}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4 gap-4">
          {/* Preselected Offer Preview */}
          {preselectedOffer && (
            <PreselectedOfferPreview
              offerTitle={preselectedOffer.title}
              offerDiscount={preselectedOffer.discount}
              redemptionCode={preselectedOffer.redemptionCode}
              onRemove={handleRemovePreselectedOffer}
            />
          )}

          {/* Party Size Selector */}
          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={setPartySize}
            maxPartySize={restaurant.max_party_size || 12}
          />

          {/* Date Selector */}
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={maxBookingDays}
          />

          {/* Time Slots with Real-time Updates */}
          <TimeSlots
            slots={slots}
            selectedTime={selectedTime}
            onTimeChange={handleTimeChange}
            loading={slotsLoading}
            showTableInfo={true}
          />

          {/* Error message if any */}
          {error && (
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </Text>
            </View>
          )}

          {/* Loyalty Preview */}
          {profile && (
            <LoyaltyPreview
              earnablePoints={earnablePoints}
              userTier={userTier}
              userPoints={userPoints}
            />
          )}

          {/* Other Offers Preview (only show if no preselected offer) */}
          {!preselectedOffer && (
            <OffersPreview
              availableOffers={availableOffers}
              onViewOffers={handleViewOffers}
            />
          )}

          {/* Booking Policies */}
          <View className="bg-muted/30 rounded-xl p-4">
            <Text className="font-semibold mb-2">Booking Information</Text>
            <View className="gap-2">
              <Text className="text-sm text-muted-foreground">
                •{" "}
                {restaurant.booking_policy === "instant"
                  ? "Instant confirmation"
                  : "Confirmation within 2 hours"}
              </Text>
              {restaurant.cancellation_window_hours && (
                <Text className="text-sm text-muted-foreground">
                  • Free cancellation up to{" "}
                  {restaurant.cancellation_window_hours} hours before
                </Text>
              )}
              <Text className="text-sm text-muted-foreground">
                • Please arrive on time to keep your reservation
              </Text>
              {preselectedOffer && (
                <Text className="text-sm text-green-600 dark:text-green-400">
                  • Your {preselectedOffer.discount}% discount will be applied
                  automatically
                </Text>
              )}
              <Text className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                • Real-time availability updates enabled
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA with offer info */}
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="font-semibold">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {selectedTime && ` at ${selectedTime}`}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-muted-foreground">
                Party of {partySize} • Earn {earnablePoints} points
              </Text>
              {preselectedOffer && (
                <>
                  <Text className="text-sm text-muted-foreground">•</Text>
                  <Text className="text-sm font-medium text-green-600 dark:text-green-400">
                    {preselectedOffer.discount}% OFF applied
                  </Text>
                </>
              )}
            </View>
          </View>
          <Button
            onPress={handleContinueBooking}
            disabled={!selectedTime}
            className="px-6"
          >
            <Text className="text-white font-bold">Continue</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}