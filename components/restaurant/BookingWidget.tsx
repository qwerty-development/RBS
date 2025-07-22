// components/restaurant/BookingWidget.tsx (Optimized)
import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, Alert } from "react-native";
import { 
  ArrowLeft, Calendar as CalendarIcon, Users as UsersIcon, 
  Sparkles, CheckCircle, MapPin 
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";
import { useAvailability } from "@/hooks/useAvailability";
import { TimeSlots, TableOptions } from "@/components/booking/TimeSlots";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface BookingWidgetProps {
  restaurant: Restaurant;
  onBookingSuccess: (tableIds: string[], selectedTime: string, selectedDate: Date, partySize: number, selectedOption: any) => void;
}

export const BookingWidget: React.FC<BookingWidgetProps> = ({
  restaurant,
  onBookingSuccess,
}) => {
  // State for booking parameters
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [partySize, setPartySize] = useState(2);
  const [currentStep, setCurrentStep] = useState<'config' | 'time' | 'experience'>('config');

  // Use the enhanced availability hook
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
    experienceCount,
    hasMultipleExperiences,
    primaryExperience,
  } = useAvailability({
    restaurantId: restaurant.id,
    date: selectedDate,
    partySize,
    enableRealtime: true,
    mode: 'time-first',
  });

  // Handle configuration changes
  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentStep('config');
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handlePartySizeChange = useCallback((size: number) => {
    setPartySize(size);
    setCurrentStep('config');
    clearSelectedSlot();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  // Handle step progression
  const handleContinueToTimeSelection = useCallback(() => {
    setCurrentStep('time');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleTimeSelect = useCallback(async (time: string) => {
    await fetchSlotOptions(time);
    setCurrentStep('experience');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const handleExperienceConfirm = useCallback((tableIds: string[], selectedOption: any) => {
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

  return (
    <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm border border-border">
      <H3 className="mb-4">Reserve Your Experience</H3>

      {/* Step 1: Configuration */}
      {currentStep === 'config' && (
        <>
          {/* Date Selection */}
          <View className="mb-4">
            <Text className="font-medium mb-2">Select Date</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="gap-2"
            >
              {Array.from({ length: 14 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();

                return (
                  <Pressable
                    key={i}
                    onPress={() => handleDateChange(date)}
                    className={`px-4 py-3 rounded-lg mr-2 min-w-[70px] ${
                      isSelected ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <Text
                      className={`text-center font-medium text-xs ${
                        isSelected ? "text-primary-foreground" : ""
                      }`}
                    >
                      {isToday
                        ? "Today"
                        : date.toLocaleDateString("en-US", { weekday: "short" })}
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
                      {date.toLocaleDateString("en-US", { month: "short" })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Party Size Selection */}
          <View className="mb-4">
            <Text className="font-medium mb-2">Party Size</Text>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                <Pressable
                  key={size}
                  onPress={() => handlePartySizeChange(size)}
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
            {partySize > 8 && (
              <Text className="text-sm text-muted-foreground mt-1">
                For larger parties, please call the restaurant
              </Text>
            )}
          </View>

          {/* Continue Button */}
          <Button onPress={handleContinueToTimeSelection} className="w-full">
            <CalendarIcon size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Find Available Times</Text>
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
          />

          {error && (
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mt-3">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </Text>
            </View>
          )}
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
                <CalendarIcon size={12} color="#666" />
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