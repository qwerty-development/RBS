import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
  MapPin,
  CheckCircle,
  Gift,
  Trophy,
  Sparkles,
  QrCode,
  ArrowLeft,
  Zap,
  Clock,
  Timer,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { getMaxBookingWindow } from "@/lib/tableManagementUtils";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useAvailability, useAvailabilityPreloader } from "@/hooks/useAvailability";
import { TimeSlots, TableOptions } from "@/components/booking/TimeSlots";
import { TableOption } from "@/lib/AvailabilityService";
import { useOffers } from "@/hooks/useOffers";

// New loyalty system imports
import { LoyaltyPointsDisplay } from '@/components/booking/LoyaltyPointsDisplay';
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import { PotentialLoyaltyPoints, useRestaurantLoyalty } from '@/hooks/useRestaurantLoyalty';

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Optimized Restaurant Info Card
const RestaurantInfoCard = React.memo<{
  restaurant: Restaurant;
}>(({ restaurant }) => (
  <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border shadow-sm">
    <View className="flex-row gap-3">
      <Image
        source={{ uri: restaurant.main_image_url }}
        className="w-16 h-16 rounded-lg"
        contentFit="cover"
        placeholder="Restaurant"
      />
      <View className="flex-1">
        <H3 className="mb-1" numberOfLines={1}>{restaurant.name}</H3>
        <View className="flex-row items-center gap-2 mb-1">
          <Star size={14} color="#f59e0b" fill="#f59e0b" />
          <Text className="text-sm font-medium">
            {restaurant.average_rating?.toFixed(1) || "4.5"}
          </Text>
          <Text className="text-sm text-muted-foreground">•</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
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
));

// Enhanced Progress Indicator
const ProgressIndicator = React.memo<{
  currentStep: 'time' | 'experience';
  hasSelectedSlot: boolean;
  selectedTime: string | null;
  experienceCount: number;
}>(({ currentStep, hasSelectedSlot, selectedTime, experienceCount }) => (
  <View className="px-4 py-3 bg-muted/30 border-b border-border">
    <View className="flex-row items-center justify-center gap-4">
      <View className={`flex-row items-center gap-2 ${currentStep === 'time' ? 'opacity-100' : 'opacity-60'}`}>
        <View className={`w-8 h-8 rounded-full items-center justify-center ${
          currentStep === 'time' ? 'bg-primary' : hasSelectedSlot ? 'bg-green-500' : 'bg-primary'
        }`}>
          <Text className="text-white font-bold text-sm">1</Text>
        </View>
        <View>
          <Text className="font-medium text-sm">Select Time</Text>
          {selectedTime && currentStep !== 'time' && (
            <Text className="text-xs text-green-600 dark:text-green-400">{selectedTime}</Text>
          )}
        </View>
      </View>

      <View className={`w-8 h-px transition-colors ${hasSelectedSlot ? 'bg-green-500' : 'bg-border'}`} />

      <View className={`flex-row items-center gap-2 ${currentStep === 'experience' ? 'opacity-100' : 'opacity-60'}`}>
        <View className={`w-8 h-8 rounded-full items-center justify-center ${
          currentStep === 'experience' && hasSelectedSlot ? 'bg-primary' :
          hasSelectedSlot ? 'bg-green-500' : 'bg-muted'
        }`}>
          <Text className={`font-bold text-sm ${hasSelectedSlot ? 'text-white' : 'text-muted-foreground'}`}>2</Text>
        </View>
        <View>
          <Text className="font-medium text-sm">Choose Experience</Text>
          {experienceCount > 0 && currentStep === 'experience' && (
            <Text className="text-xs text-blue-600 dark:text-blue-400">{experienceCount} options</Text>
          )}
        </View>
      </View>
    </View>
  </View>
));

// Optimized Party Size Selector
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxPartySize?: number;
  disabled?: boolean;
}>(({ partySize, onPartySizeChange, maxPartySize = 12, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  const partySizes = useMemo(() =>
    Array.from({ length: maxPartySize }, (_, i) => i + 1),
    [maxPartySize]
  );

  const handleSizeChange = useCallback((size: number) => {
    onPartySizeChange(size);
    setExpanded(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onPartySizeChange]);

  if (expanded && !disabled) {
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
              onPress={() => handleSizeChange(size)}
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
      onPress={() => !disabled && setExpanded(true)}
      disabled={disabled}
      className={`bg-card border border-border rounded-xl p-4 flex-row items-center justify-between ${
        disabled ? 'opacity-60' : ''
      }`}
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
      {!disabled && <ChevronDown size={24} color="#666" />}
    </Pressable>
  );
});

// Enhanced Date Selector with better performance
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
  disabled?: boolean;
}>(({ selectedDate, onDateChange, maxDaysAhead = 30, disabled = false }) => {
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

  const handleDateChange = useCallback((date: Date) => {
    if (disabled) return;
    onDateChange(date);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onDateChange, disabled]);

  return (
    <View className={`bg-card border border-border rounded-xl p-4 ${disabled ? 'opacity-60' : ''}`}>
      <View className="flex-row items-center gap-3 mb-3">
        <Calendar size={20} color="#3b82f6" />
        <Text className="font-semibold text-lg">Select Date</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {dates.map((date) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();

            return (
              <Pressable
                key={date.toISOString()}
                onPress={() => handleDateChange(date)}
                disabled={disabled}
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
                  {date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
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
                  {isToday ? "Today" : isTomorrow ? "Tomorrow" : date.toLocaleDateString("en-US", { month: "short" })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
});

// Enhanced Offer Preview Components
const PreselectedOfferPreview = React.memo<{
  offerTitle: string;
  offerDiscount: number;
  redemptionCode: string;
  onRemove: () => void;
}>(({ offerTitle, offerDiscount, redemptionCode, onRemove }) => (
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
      <Text className="font-bold text-green-800 dark:text-green-200 mb-1" numberOfLines={2}>
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
          Remove
        </Text>
      </Pressable>
    </View>
  </View>
));

const OffersPreview = React.memo<{
  availableOffers: any[];
  onViewOffers: () => void;
}>(({ availableOffers, onViewOffers }) => {
  if (availableOffers.length === 0) return null;

  const maxDiscount = useMemo(() =>
    Math.max(...availableOffers.map((o) => o.discount_percentage || 0)),
    [availableOffers]
  );

  return (
    <Pressable
      onPress={onViewOffers}
      className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800 rounded-xl p-4"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <Gift size={20} color="#10b981" />
          <View className="flex-1">
            <Text className="font-semibold text-lg text-green-800 dark:text-green-200">
              {availableOffers.length} Special Offer{availableOffers.length > 1 ? "s" : ""} Available
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              Apply discounts during booking
            </Text>
          </View>
        </View>
        <View className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
          <Text className="text-green-800 dark:text-green-200 font-bold text-sm">
            Save up to {maxDiscount}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const QuickStats = React.memo<{
  restaurant: Restaurant;
  timeSlots: any[];
  isLoading: boolean;
  selectedLoyaltyPoints: PotentialLoyaltyPoints | null;
  isRequestBooking: boolean;
  hasLoyaltyProgram: boolean;
}>(({ restaurant, timeSlots, isLoading, selectedLoyaltyPoints, isRequestBooking, hasLoyaltyProgram }) => (
  <View className="mx-4 my-2 p-3 bg-card/50 rounded-lg border border-border/50">
    <View className="flex-row justify-around">
      <View className="items-center">
        {isLoading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className="text-lg font-bold text-primary">{timeSlots.length}</Text>
        )}
        <Text className="text-xs text-muted-foreground">Available</Text>
      </View>

      <View className="items-center">
        <View className="flex-row items-center gap-1">
          {isRequestBooking ? (
            <Timer size={12} color="#f97316" />
          ) : (
            <Zap size={12} color="#f59e0b" />
          )}
          <Text className={`text-lg font-bold ${
            isRequestBooking ? "text-orange-600" : "text-amber-600"
          }`}>
            {isRequestBooking ? '2hr' : 'Instant'}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {isRequestBooking ? 'Response' : 'Booking'}
        </Text>
      </View>

      {/* Only show points if restaurant has loyalty program */}
      {hasLoyaltyProgram && !isRequestBooking && (
        <View className="items-center">
          <View className="flex-row items-center gap-1">
            <Trophy size={12} color="#10b981" />
            <Text className="text-lg font-bold text-green-600">
              {selectedLoyaltyPoints?.available 
                ? `+${selectedLoyaltyPoints.pointsToAward}` 
                : 'N/A'
              }
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">Points</Text>
        </View>
      )}
    </View>
  </View>
));

// Main Component
export default function AvailabilitySelectionScreen() {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();

  // Get parameters with validation
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    preselectedOfferId?: string;
    offerTitle?: string;
    offerDiscount?: string;
    redemptionCode?: string;
  }>();

  // Validate required params
  useEffect(() => {
    if (!params.restaurantId) {
      Alert.alert("Error", "Restaurant information is missing");
      router.back();
    }
  }, [params.restaurantId, router]);

  // State management with optimized defaults
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [partySize, setPartySize] = useState(2);
  const [maxBookingDays, setMaxBookingDays] = useState(30);
  const [currentStep, setCurrentStep] = useState<'time' | 'experience'>('time');

  // Preselected offer state with memoization
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
  } | null>(null);

  // Loyalty points state
  const [selectedLoyaltyPoints, setSelectedLoyaltyPoints] = useState<PotentialLoyaltyPoints | null>(null);

  // Refs for cleanup and optimization
  const stepTransitionRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced hooks with optimizations
  const { restaurant, loading: restaurantLoading } = useRestaurant(params.restaurantId || '');
  const { preloadRestaurant } = useAvailabilityPreloader();
  const { hasLoyaltyProgram } = useRestaurantLoyalty(params.restaurantId || '');
  const { confirmBooking, loading: confirmingBooking } = useBookingConfirmation();

  // Enhanced availability hook with proper configuration
  const {
    timeSlots,
    timeSlotsLoading,
    selectedSlotOptions,
    selectedTime,
    slotOptionsLoading,
    error,
    fetchSlotOptions,
    clearSelectedSlot,
    hasTimeSlots,
    hasSelectedSlot,
    experienceCount,
    hasMultipleExperiences,
    primaryExperience,
    isLoading,
    refresh,
  } = useAvailability({
    restaurantId: params.restaurantId || '',
    date: selectedDate,
    partySize,
    enableRealtime: true,
    mode: 'time-first',
    preloadNext: true,
  });

  const offersData = useOffers();
  const { offers = [] } = offersData || {};

  // FIXED: Memoize booking date time to prevent infinite re-renders
  const bookingDateTime = useMemo(() => {
    if (!selectedTime) return null;
    try {
      const dt = new Date(selectedDate);
      const [h, m] = selectedTime.split(':');
      dt.setHours(parseInt(h), parseInt(m), 0, 0);
      return dt;
    } catch (error) {
      console.error('Error constructing booking date time:', error);
      return null;
    }
  }, [selectedDate, selectedTime]);

  // Preload restaurant data
  useEffect(() => {
    if (params.restaurantId) {
      preloadRestaurant(params.restaurantId, [2, 4, partySize]);
    }
  }, [params.restaurantId, preloadRestaurant, partySize]);

  // Initialize preselected offer with validation
  useEffect(() => {
    if (
      params.preselectedOfferId &&
      params.offerTitle &&
      params.offerDiscount &&
      params.redemptionCode
    ) {
      const discount = parseInt(params.offerDiscount, 10);
      if (!isNaN(discount) && discount > 0) {
        setPreselectedOffer({
          id: params.preselectedOfferId,
          title: params.offerTitle,
          discount,
          redemptionCode: params.redemptionCode,
        });
      }
    }
  }, [
    params.preselectedOfferId,
    params.offerTitle,
    params.offerDiscount,
    params.redemptionCode,
  ]);

  // Fetch max booking days with error handling
  useEffect(() => {
    async function fetchMaxDays() {
      if (profile?.id && restaurant?.id) {
        try {
          const days = await getMaxBookingWindow(
            profile.id,
            restaurant.id,
            restaurant.booking_window_days || 30
          );
          setMaxBookingDays(days);
        } catch (error) {
          console.error('Error fetching max booking days:', error);
          setMaxBookingDays(30); // fallback
        }
      }
    }
    fetchMaxDays();
  }, [profile?.id, restaurant?.id, restaurant?.booking_window_days]);

  const availableOffers = useMemo(() => {
    return offers.filter(
      (offer) =>
        offer &&
        offer.restaurant_id === params.restaurantId &&
        !offer.usedAt &&
        new Date(offer.expiresAt || offer.valid_until) > new Date() &&
        offer.id !== preselectedOffer?.id
    );
  }, [offers, params.restaurantId, preselectedOffer?.id]);

  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, []);

  // FIXED: Reset loyalty points when date/time/party size changes
  useEffect(() => {
    setSelectedLoyaltyPoints(null);
  }, [selectedDate, selectedTime, partySize]);

  // Optimized event handlers
  const handleDateChange = useCallback((date: Date) => {
    if (date.toDateString() === selectedDate.toDateString()) return;

    setSelectedDate(date);
    setCurrentStep('time');
    clearSelectedSlot();
    setSelectedLoyaltyPoints(null); // Reset loyalty points

    // Clear any pending transitions
    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }
  }, [selectedDate, clearSelectedSlot]);

  const handlePartySizeChange = useCallback((size: number) => {
    if (size === partySize) return;

    setPartySize(size);
    setCurrentStep('time');
    clearSelectedSlot();
    setSelectedLoyaltyPoints(null); // Reset loyalty points

    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }
  }, [partySize, clearSelectedSlot]);

  const handleTimeSelect = useCallback(async (time: string) => {
    // Clear any existing timeout
    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }

    try {
      // Fetch options and transition to experience step
      await fetchSlotOptions(time);

      // Smooth transition with haptic feedback
      stepTransitionRef.current = setTimeout(() => {
        setCurrentStep('experience');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 200);
    } catch (error) {
      console.error('Error fetching slot options:', error);
      Alert.alert('Error', 'Failed to load seating options. Please try again.');
    }
  }, [fetchSlotOptions]);

  const handleBackToTimeSelection = useCallback(() => {
    setCurrentStep('time');
    clearSelectedSlot();
    setSelectedLoyaltyPoints(null); // Reset loyalty points
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleExperienceConfirm = useCallback(async (tableIds: string[], selectedOption: TableOption) => {
    if (!selectedSlotOptions || !restaurant || !bookingDateTime) {
      Alert.alert("Error", "Missing booking information");
      return;
    }
    try {
      const success = await confirmBooking({
        restaurantId: params.restaurantId,
        bookingTime: bookingDateTime,
        partySize: partySize,
        specialRequests: undefined,
        occasion: undefined,
        dietaryNotes: undefined,
        tablePreferences: undefined,
        bookingPolicy: restaurant.booking_policy,
        expectedLoyaltyPoints: selectedLoyaltyPoints?.available ? selectedLoyaltyPoints.pointsToAward : 0,
        appliedOfferId: preselectedOffer?.id,
        loyaltyRuleId: selectedLoyaltyPoints?.available ? selectedLoyaltyPoints.ruleId : undefined,
        tableIds: JSON.stringify(tableIds),
        requiresCombination: selectedOption.requiresCombination
      });
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error confirming booking:', error);
      Alert.alert('Error', 'Failed to confirm booking. Please try again.');
    }
  }, [
    selectedSlotOptions,
    restaurant,
    bookingDateTime,
    params.restaurantId,
    partySize,
    selectedLoyaltyPoints,
    preselectedOffer,
    confirmBooking,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    };
  }, []);

  // Loading state with better UX
  if (!restaurant || restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-muted-foreground text-center">
            Loading restaurant information...
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Preparing your dining experience
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRequestBooking = restaurant?.booking_policy === "request";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Enhanced Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable
          onPress={() => router.back()}
          className="p-2 -ml-2 rounded-full"
          hitSlop={8}
        >
          <ChevronLeft size={24} />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text className="text-center font-semibold">
            {currentStep === 'time' ? 'Select Date & Time' : 'Choose Your Experience'}
          </Text>
          <Muted className="text-center text-sm" numberOfLines={1}>
            {restaurant.name}
          </Muted>
        </View>
        <View className="w-10" />
      </View>

      {/* Progress Indicator */}
      <ProgressIndicator
        currentStep={currentStep}
        hasSelectedSlot={hasSelectedSlot}
        selectedTime={selectedTime}
        experienceCount={experienceCount}
      />

      {/* Restaurant Info Card */}
      <RestaurantInfoCard restaurant={restaurant} />

      {/* Quick Stats */}
      {hasTimeSlots && (
        <QuickStats
          restaurant={restaurant}
          timeSlots={timeSlots}
          isLoading={timeSlotsLoading}
          selectedLoyaltyPoints={selectedLoyaltyPoints}
          isRequestBooking={isRequestBooking}
          hasLoyaltyProgram={hasLoyaltyProgram}
        />
      )}

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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

          {/* Configuration Selectors - Disabled in experience step */}
          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            maxPartySize={restaurant.max_party_size || 12}
            disabled={currentStep === 'experience'}
          />

          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={maxBookingDays}
            disabled={currentStep === 'experience'}
          />

          {/* Step 1: Time Selection */}
          {currentStep === 'time' && (
            <>
              <TimeSlots
                slots={timeSlots}
                selectedTime={selectedTime}
                onTimeSelect={handleTimeSelect}
                loading={timeSlotsLoading}
                showLiveIndicator={true}
                error={error}
              />

              {/* Error message */}
              {error && (
                <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                  <Text className="text-red-600 dark:text-red-400 text-sm font-medium">
                    {error}
                  </Text>
                  <Pressable
                    onPress={() => refresh(true)}
                    className="mt-2 self-start"
                  >
                    <Text className="text-red-600 dark:text-red-400 text-sm underline">
                      Retry
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* FIXED: Loyalty Points Display for Time Step - only when time is selected */}
              {bookingDateTime && !isRequestBooking && hasLoyaltyProgram && (
                <LoyaltyPointsDisplay
                  restaurantId={params.restaurantId}
                  bookingTime={bookingDateTime}
                  partySize={partySize}
                  onPointsCalculated={setSelectedLoyaltyPoints}
                />
              )}
            </>
          )}

          {/* Step 2: Experience Selection */}
          {currentStep === 'experience' && (
            <>
              {/* Back navigation */}
              <Pressable
                onPress={handleBackToTimeSelection}
                className="flex-row items-center gap-2 p-2 -ml-2 self-start rounded-lg"
              >
                <ArrowLeft size={20} color="#3b82f6" />
                <Text className="text-primary font-medium">Back to Time Selection</Text>
              </Pressable>

              {/* Experience Header */}
              {hasMultipleExperiences && (
                <View className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <View className="flex-row items-center gap-2">
                    <Sparkles size={16} color="#8b5cf6" />
                    <Text className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      {experienceCount} unique dining experiences available
                    </Text>
                  </View>
                  <Text className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    Each offers a different atmosphere and setting for your meal
                  </Text>
                </View>
              )}

              {/* FIXED: Loyalty Points Display for Experience Step */}
              {bookingDateTime && !isRequestBooking && hasLoyaltyProgram && (
                <LoyaltyPointsDisplay
                  restaurantId={params.restaurantId}
                  bookingTime={bookingDateTime}
                  partySize={partySize}
                  onPointsCalculated={setSelectedLoyaltyPoints}
                />
              )}

              <TableOptions
                slotOptions={selectedSlotOptions}
                onConfirm={handleExperienceConfirm}
                onBack={handleBackToTimeSelection}
                loading={slotOptionsLoading}
              />
            </>
          )}

          {/* Additional Content - Only show on time step */}
          {currentStep === 'time' && (
            <>
              {/* Other Offers Preview */}
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
                  {isRequestBooking ? (
                    <>
                      <View className="flex-row items-start gap-2">
                        <Timer size={16} color="#f97316" className="mt-0.5" />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
                            Request booking restaurant
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            Submit your request and receive confirmation within 2 hours
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        • The restaurant will review availability
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        • You'll be notified once confirmed
                      </Text>
                      {restaurant.cancellation_window_hours && (
                        <Text className="text-sm text-muted-foreground">
                          • Free cancellation up to {restaurant.cancellation_window_hours} hours before
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text className="text-sm text-muted-foreground">
                        • Instant confirmation
                      </Text>
                      {restaurant.cancellation_window_hours && (
                        <Text className="text-sm text-muted-foreground">
                          • Free cancellation up to {restaurant.cancellation_window_hours} hours before
                        </Text>
                      )}
                      <Text className="text-sm text-muted-foreground">
                        • Please arrive on time to keep your reservation
                      </Text>
                    </>
                  )}
                  {preselectedOffer && (
                    <Text className="text-sm text-green-600 dark:text-green-400">
                      • Your {preselectedOffer.discount}% discount will be applied
                    </Text>
                  )}
                  {selectedLoyaltyPoints?.available && (
                    <Text className="text-sm text-amber-600 dark:text-amber-400">
                      • Earn {selectedLoyaltyPoints.pointsToAward} loyalty points
                    </Text>
                  )}
                  <Text className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    • Real-time availability with curated dining experiences
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Enhanced Bottom CTA */}
      <View className="p-4 border-t border-border bg-background">
        {isRequestBooking && (
          <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 mb-3">
            <View className="flex-row items-center gap-2">
              <Timer size={14} color="#f97316" />
              <Text className="text-xs text-orange-700 dark:text-orange-300 flex-1">
                This restaurant requires booking approval
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="font-semibold">
              {formatSelectedDate(selectedDate)}
              {selectedTime && ` at ${selectedTime}`}
            </Text>
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-sm text-muted-foreground">
                Party of {partySize}
                {!isRequestBooking && selectedLoyaltyPoints?.available && ` • Earn ${selectedLoyaltyPoints.pointsToAward} points`}
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
            {currentStep === 'experience' && primaryExperience && (
              <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Recommended: {primaryExperience}
              </Text>
            )}
          </View>

          {/* Dynamic CTA based on step */}
          {currentStep === 'time' ? (
            <View className="items-end ml-4">
              <Text className="text-xs text-muted-foreground mb-1 text-right">
                {isLoading ? 'Loading times...' : hasTimeSlots ? 'Select time above' : 'No times available'}
              </Text>
              <View className="w-20 h-10 bg-muted/50 rounded-lg items-center justify-center">
                {isLoading && <ActivityIndicator size="small" />}
                {!isLoading && !hasTimeSlots && (
                  <Pressable onPress={() => refresh(true)}>
                    <Text className="text-xs text-primary">Retry</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <View className="items-end ml-4">
              <Text className="text-xs text-muted-foreground mb-1 text-right">
                {confirmingBooking ? 'Confirming...' : 'Select experience above'}
              </Text>
              {confirmingBooking && (
                <View className="w-20 h-10 bg-muted/50 rounded-lg items-center justify-center">
                  <ActivityIndicator size="small" />
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}