// app/(protected)/booking/availability.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
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
import { useAvailability } from "@/hooks/useAvailability";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";

// Import the new optimized components
import { TimeSlots, TableOptions } from "@/components/booking/TimeSlots";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

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

// Preselected Offer Preview Component
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

// Loyalty Preview Component
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

// Regular Offers Preview Component
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
  const [partySize, setPartySize] = useState(2);
  const [maxBookingDays, setMaxBookingDays] = useState(30);
  const [currentStep, setCurrentStep] = useState<'time' | 'experience'>('time');

  // Track preselected offer
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
  } | null>(null);

  // Custom hooks
  const { restaurant, loading: restaurantLoading } = useRestaurant(params.restaurantId);

  // NEW: Use the enhanced availability hook with two-step flow
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
  } = useAvailability({
    restaurantId: params.restaurantId,
    date: selectedDate,
    partySize,
    enableRealtime: true,
    mode: 'time-first',
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
    setCurrentStep('time');
    clearSelectedSlot();
  }, [clearSelectedSlot]);

  const handlePartySizeChange = useCallback((size: number) => {
    setPartySize(size);
    setCurrentStep('time');
    clearSelectedSlot();
  }, [clearSelectedSlot]);

  // NEW: Handle time selection (step 1 -> step 2)
  const handleTimeSelect = useCallback(async (time: string) => {
    await fetchSlotOptions(time);
    setCurrentStep('experience');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [fetchSlotOptions]);

  // NEW: Handle going back to time selection
  const handleBackToTimeSelection = useCallback(() => {
    setCurrentStep('time');
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  // NEW: Handle experience confirmation (step 2 -> booking)
  const handleExperienceConfirm = useCallback((tableIds: string[], selectedOption: any) => {
    if (!selectedSlotOptions || !restaurant) {
      Alert.alert("Error", "Missing experience or restaurant information");
      return;
    }

    const navigationParams: any = {
      restaurantId: params.restaurantId,
      restaurantName: restaurant.name,
      date: selectedDate.toISOString(),
      time: selectedSlotOptions.time,
      partySize: partySize.toString(),
      earnablePoints: earnablePoints.toString(),
      tableIds: JSON.stringify(tableIds),
      requiresCombination: selectedOption.requiresCombination ? "true" : "false",
    };

    // Include preselected offer if available
    if (preselectedOffer) {
      navigationParams.offerId = preselectedOffer.id;
      navigationParams.offerTitle = preselectedOffer.title;
      navigationParams.offerDiscount = preselectedOffer.discount.toString();
      navigationParams.redemptionCode = preselectedOffer.redemptionCode;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: "/booking/create",
      params: navigationParams,
    });
  }, [
    selectedSlotOptions,
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

  // Format date for display
  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, []);

  // Loading state
  if (!restaurant || restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4 text-muted-foreground">Loading restaurant...</Text>
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
          <Text className="text-center font-semibold">
            {currentStep === 'time' ? 'Select Date & Time' : 'Choose Your Experience'}
          </Text>
          <Muted className="text-center text-sm">{restaurant.name}</Muted>
        </View>
        <View className="w-10" />
      </View>

      {/* Progress Indicator */}
      <View className="px-4 py-3 bg-muted/30">
        <View className="flex-row items-center justify-center gap-4">
          <View className={`flex-row items-center gap-2 ${currentStep === 'time' ? 'opacity-100' : 'opacity-60'}`}>
            <View className={`w-8 h-8 rounded-full items-center justify-center ${
              currentStep === 'time' ? 'bg-primary' : hasSelectedSlot ? 'bg-green-500' : 'bg-primary'
            }`}>
              <Text className="text-white font-bold text-sm">1</Text>
            </View>
            <Text className="font-medium text-sm">Select Time</Text>
          </View>
          
          <View className={`w-8 h-px ${hasSelectedSlot ? 'bg-green-500' : 'bg-border'}`} />
          
          <View className={`flex-row items-center gap-2 ${currentStep === 'experience' ? 'opacity-100' : 'opacity-60'}`}>
            <View className={`w-8 h-8 rounded-full items-center justify-center ${
              currentStep === 'experience' && hasSelectedSlot ? 'bg-primary' : 
              hasSelectedSlot ? 'bg-green-500' : 'bg-muted'
            }`}>
              <Text className={`font-bold text-sm ${hasSelectedSlot ? 'text-white' : 'text-muted-foreground'}`}>2</Text>
            </View>
            <Text className="font-medium text-sm">Choose Experience</Text>
          </View>
        </View>
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
            onPartySizeChange={handlePartySizeChange}
            maxPartySize={restaurant.max_party_size || 12}
          />

          {/* Date Selector */}
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={maxBookingDays}
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
              />

              {/* Error message if any */}
              {error && (
                <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <Text className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Step 2: Experience Selection */}
          {currentStep === 'experience' && (
            <>
              {/* Back to time selection option */}
              <Pressable
                onPress={handleBackToTimeSelection}
                className="flex-row items-center gap-2 p-2 -ml-2"
              >
                <ArrowLeft size={20} color="#3b82f6" />
                <Text className="text-primary font-medium">Back to Time Selection</Text>
              </Pressable>

              {/* Experience Header */}
              {hasMultipleExperiences && (
                <View className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3">
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

              <TableOptions
                slotOptions={selectedSlotOptions}
                onConfirm={handleExperienceConfirm}
                onBack={handleBackToTimeSelection}
                loading={slotOptionsLoading}
              />
            </>
          )}

          {/* Loyalty Preview - Only show on step 1 */}
          {currentStep === 'time' && profile && (
            <LoyaltyPreview
              earnablePoints={earnablePoints}
              userTier={userTier}
              userPoints={userPoints}
            />
          )}

          {/* Other Offers Preview - Only show on step 1 */}
          {currentStep === 'time' && !preselectedOffer && (
            <OffersPreview
              availableOffers={availableOffers}
              onViewOffers={handleViewOffers}
            />
          )}

          {/* Booking Policies - Only show on step 1 */}
          {currentStep === 'time' && (
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
                  • Real-time availability with curated dining experiences
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA - Updated for experience flow */}
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="font-semibold">
              {formatSelectedDate(selectedDate)}
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
            {/* Show primary experience when selected */}
            {currentStep === 'experience' && primaryExperience && (
              <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Recommended: {primaryExperience}
              </Text>
            )}
          </View>
          
          {/* Show different CTA based on current step */}
          {currentStep === 'time' ? (
            <View className="items-end">
              <Text className="text-xs text-muted-foreground mb-1">
                {hasTimeSlots ? 'Select a time above' : 'Loading times...'}
              </Text>
              <View className="w-20 h-10 bg-muted/50 rounded-lg items-center justify-center">
                {timeSlotsLoading && <ActivityIndicator size="small" />}
              </View>
            </View>
          ) : (
            <Button
              onPress={() => {
                // This shouldn't be needed since TableOptions handles confirmation
                // But keeping as fallback
                if (selectedSlotOptions && selectedSlotOptions.primaryOption) {
                  const tableIds = selectedSlotOptions.primaryOption.tables.map((t: any) => t.id);
                  handleExperienceConfirm(tableIds, selectedSlotOptions.primaryOption);
                }
              }}
              disabled={!hasSelectedSlot || slotOptionsLoading}
              className="px-6"
            >
              <Text className="text-white font-bold">
                {slotOptionsLoading ? "Loading..." : "Continue"}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}