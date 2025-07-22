// components/restaurant/BookingWidget.tsx (Fully Optimized)
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { View, ScrollView, Pressable, Alert, Dimensions } from "react-native";
import { 
  ArrowLeft, Calendar as CalendarIcon, Users as UsersIcon, 
  Sparkles, CheckCircle, MapPin, Clock, Zap, Trophy
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { useAvailability, useAvailabilityPreloader } from "@/hooks/useAvailability";
import { TimeSlots, TableOptions } from "@/components/booking/TimeSlots";
import { TableOption } from "@/lib/AvailabilityService";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface BookingWidgetProps {
  restaurant: Restaurant;
  onBookingSuccess: (
    tableIds: string[], 
    selectedTime: string, 
    selectedDate: Date, 
    partySize: number, 
    selectedOption: TableOption
  ) => void;
  initialDate?: Date;
  initialPartySize?: number;
}

// Optimized date selector with memoization
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDays?: number;
}>(({ selectedDate, onDateChange, maxDays = 14 }) => {
  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    for (let i = 0; i < maxDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    return datesArray;
  }, [maxDays]);

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString("en-US", { 
      weekday: "short",
      month: "short", 
      day: "numeric" 
    });
  }, []);

  return (
    <View className="mb-4">
      <Text className="font-medium mb-2">Select Date</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="gap-2"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {dates.map((date, i) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => onDateChange(date)}
              className={`px-4 py-3 rounded-lg mr-2 min-w-[70px] ${
                isSelected ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-center font-medium text-xs ${
                  isSelected ? "text-primary-foreground" : ""
                }`}
              >
                {date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </Text>
              <Text
                className={`text-center text-lg font-bold ${
                  isSelected ? "text-primary-foreground" : ""
                }`}
              >
                {date.getDate()}
              </Text>
              <Text
                className={`text-center text-xs ${
                  isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {formatDate(date)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

// Optimized party size selector
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxSize?: number;
}>(({ partySize, onPartySizeChange, maxSize = 8 }) => {
  const sizes = useMemo(() => 
    Array.from({ length: maxSize }, (_, i) => i + 1),
    [maxSize]
  );

  return (
    <View className="mb-4">
      <Text className="font-medium mb-2">Party Size</Text>
      <View className="flex-row gap-2">
        {sizes.map((size) => (
          <Pressable
            key={size}
            onPress={() => onPartySizeChange(size)}
            className={`flex-1 py-2 rounded-lg ${
              partySize === size ? "bg-primary" : "bg-muted"
            }`}
          >
            <Text
              className={`text-center font-medium ${
                partySize === size ? "text-primary-foreground" : ""
              }`}
            >
              {size}
            </Text>
          </Pressable>
        ))}
      </View>
      {partySize > maxSize && (
        <Text className="text-sm text-muted-foreground mt-1">
          For larger parties, please call the restaurant
        </Text>
      )}
    </View>
  );
});

// Step indicator component
const StepIndicator = React.memo<{
  currentStep: 'config' | 'time' | 'experience';
  hasTimeSlots: boolean;
  hasSelectedSlot: boolean;
}>(({ currentStep, hasTimeSlots, hasSelectedSlot }) => {
  const steps = [
    { id: 'config', label: 'Date & Size', completed: hasTimeSlots },
    { id: 'time', label: 'Time', completed: hasSelectedSlot },
    { id: 'experience', label: 'Experience', completed: false },
  ];

  return (
    <View className="flex-row justify-center mb-4">
      {steps.map((step, index) => (
        <View key={step.id} className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${
              currentStep === step.id
                ? "bg-primary"
                : step.completed
                ? "bg-green-500"
                : "bg-muted"
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                currentStep === step.id || step.completed
                  ? "text-white"
                  : "text-muted-foreground"
              }`}
            >
              {index + 1}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View
              className={`w-8 h-0.5 mx-1 ${
                step.completed ? "bg-green-500" : "bg-muted"
              }`}
            />
          )}
        </View>
      ))}
    </View>
  );
});

// Quick stats component
const QuickStats = React.memo<{
  restaurant: Restaurant;
  timeSlots: any[];
  isLoading: boolean;
}>(({ restaurant, timeSlots, isLoading }) => {
  if (isLoading) {
    return (
      <View className="flex-row justify-around py-2 mb-4">
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded animate-pulse mb-1" />
          <View className="w-12 h-3 bg-muted rounded animate-pulse" />
        </View>
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded animate-pulse mb-1" />
          <View className="w-16 h-3 bg-muted rounded animate-pulse" />
        </View>
        <View className="items-center">
          <View className="w-8 h-4 bg-muted rounded animate-pulse mb-1" />
          <View className="w-14 h-3 bg-muted rounded animate-pulse" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row justify-around py-2 mb-4 border-b border-border/50">
      <View className="items-center">
        <Text className="text-lg font-bold text-primary">
          {timeSlots.length}
        </Text>
        <Text className="text-xs text-muted-foreground">Times</Text>
      </View>
      <View className="items-center">
        <View className="flex-row items-center gap-1">
          <Zap size={12} color="#f59e0b" />
          <Text className="text-lg font-bold text-amber-600">
            {restaurant.booking_policy === 'instant' ? 'Instant' : '2hr'}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">Booking</Text>
      </View>
      <View className="items-center">
        <View className="flex-row items-center gap-1">
          <Trophy size={12} color="#10b981" />
          <Text className="text-lg font-bold text-green-600">
            {restaurant.average_rating?.toFixed(1) || '4.5'}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">Rating</Text>
      </View>
    </View>
  );
});

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  restaurant,
  onBookingSuccess,
  initialDate,
  initialPartySize = 2,
}) => {
  // State management with better defaults
  const [selectedDate, setSelectedDate] = useState(() => initialDate || new Date());
  const [partySize, setPartySize] = useState(initialPartySize);
  const [currentStep, setCurrentStep] = useState<'config' | 'time' | 'experience'>('config');

  // Refs for optimization
  const stepTransitionRef = useRef<NodeJS.Timeout | null>(null);
  
  // Preloader hook for better performance
  const { preloadRestaurant } = useAvailabilityPreloader();

  // Enhanced availability hook with optimizations
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
    isLoading,
    experienceCount,
    hasMultipleExperiences,
  } = useAvailability({
    restaurantId: restaurant.id,
    date: selectedDate,
    partySize,
    enableRealtime: true,
    mode: 'time-first',
    preloadNext: true,
  });

  // Preload restaurant data when component mounts
  useEffect(() => {
    preloadRestaurant(restaurant.id, [2, 4, partySize]);
  }, [restaurant.id, preloadRestaurant, partySize]);

  // Handle configuration changes with optimized state updates
  const handleDateChange = useCallback((date: Date) => {
    if (date.toDateString() === selectedDate.toDateString()) return;
    
    setSelectedDate(date);
    setCurrentStep('config');
    clearSelectedSlot();
    
    // Clear any pending transitions
    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedDate, clearSelectedSlot]);

  const handlePartySizeChange = useCallback((size: number) => {
    if (size === partySize) return;
    
    setPartySize(size);
    setCurrentStep('config');
    clearSelectedSlot();
    
    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [partySize, clearSelectedSlot]);

  // Step progression with optimized transitions
  const handleContinueToTimeSelection = useCallback(() => {
    if (!hasTimeSlots) return;
    
    setCurrentStep('time');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [hasTimeSlots]);

  const handleTimeSelect = useCallback(async (time: string) => {
    // Clear any existing timeout
    if (stepTransitionRef.current) {
      clearTimeout(stepTransitionRef.current);
    }

    // Start fetching options immediately
    await fetchSlotOptions(time);
    
    // Transition to experience step with slight delay for better UX
    stepTransitionRef.current = setTimeout(() => {
      setCurrentStep('experience');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
  }, [fetchSlotOptions]);

  const handleBackToConfig = useCallback(() => {
    setCurrentStep('config');
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleBackToTime = useCallback(() => {
    setCurrentStep('time');
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleExperienceConfirm = useCallback((
    tableIds: string[], 
    selectedOption: TableOption
  ) => {
    if (!selectedSlotOptions) {
      Alert.alert("Error", "Missing seating information");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onBookingSuccess(tableIds, selectedSlotOptions.time, selectedDate, partySize, selectedOption);
  }, [selectedSlotOptions, selectedDate, partySize, onBookingSuccess]);

  // Format date for display
  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    };
  }, []);

  // Optimized render with better loading states
  return (
    <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm border border-border">
      <H3 className="mb-4">Reserve Your Experience</H3>

      {/* Step Indicator */}
      <StepIndicator 
        currentStep={currentStep} 
        hasTimeSlots={hasTimeSlots}
        hasSelectedSlot={hasSelectedSlot}
      />

      {/* Quick Stats */}
      {currentStep !== 'config' && (
        <QuickStats 
          restaurant={restaurant}
          timeSlots={timeSlots}
          isLoading={timeSlotsLoading}
        />
      )}

      {/* Step 1: Configuration */}
      {currentStep === 'config' && (
        <>
          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDays={14}
          />

          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            maxSize={8}
          />

          <Button 
            onPress={handleContinueToTimeSelection} 
            className="w-full"
            disabled={timeSlotsLoading}
          >
            <CalendarIcon size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              {timeSlotsLoading ? "Loading..." : "Find Available Times"}
            </Text>
          </Button>
        </>
      )}

      {/* Step 2: Time Selection */}
      {currentStep === 'time' && (
        <>
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={handleBackToConfig}
              className="flex-row items-center gap-2"
            >
              <ArrowLeft size={16} color="#3b82f6" />
              <Text className="text-primary text-sm">Change Date/Size</Text>
            </Pressable>
            <View className="items-end">
              <View className="flex-row items-center gap-2">
                <MapPin size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {formatSelectedDate(selectedDate)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <UsersIcon size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {partySize} guest{partySize > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          <TimeSlots
            slots={timeSlots}
            selectedTime={selectedTime}
            onTimeSelect={handleTimeSelect}
            loading={timeSlotsLoading}
            showLiveIndicator={true}
            error={error}
          />
        </>
      )}

      {/* Step 3: Experience Selection */}
      {currentStep === 'experience' && (
        <>
          <View className="flex-row items-center justify-between mb-4">
            <Pressable
              onPress={handleBackToTime}
              className="flex-row items-center gap-2"
            >
              <ArrowLeft size={16} color="#3b82f6" />
              <Text className="text-primary text-sm">Change Time</Text>
            </Pressable>
            <View className="items-end">
              <View className="flex-row items-center gap-2">
                <Clock size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {formatSelectedDate(selectedDate)} at {selectedTime}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <UsersIcon size={12} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {partySize} guest{partySize > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Experience Header */}
          {hasMultipleExperiences && (
            <View className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 mb-4">
              <View className="flex-row items-center gap-2">
                <Sparkles size={16} color="#8b5cf6" />
                <Text className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  {experienceCount} unique dining experiences available
                </Text>
              </View>
              <Text className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Each offers a different atmosphere and setting
              </Text>
            </View>
          )}

          <TableOptions
            slotOptions={selectedSlotOptions}
            onConfirm={handleExperienceConfirm}
            onBack={handleBackToTime}
            loading={slotOptionsLoading}
          />
        </>
      )}

      {/* Booking Policy Note */}
      <View className="mt-3 pt-3 border-t border-border">
        <View className="flex-row items-center justify-center gap-2">
          <CheckCircle size={12} color="#10b981" />
          <Text className="text-xs text-muted-foreground text-center">
            {restaurant.booking_policy === "instant"
              ? "Instant confirmation • Real-time availability"
              : "Restaurant will confirm within 2 hours"}
          </Text>
        </View>
      </View>
    </View>
  );
};