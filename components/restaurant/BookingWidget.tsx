import React from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

type TimeSlot = {
  time: string;
  available: boolean;
  availableCapacity: number;
};

interface BookingWidgetProps {
  restaurant: Restaurant;
  selectedDate: Date;
  selectedTime: string;
  partySize: number;
  availableSlots: TimeSlot[];
  loadingSlots: boolean;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
  onPartySizeChange: (size: number) => void;
  onBooking: () => void;
}

export const BookingWidget = ({
  restaurant,
  selectedDate,
  selectedTime,
  partySize,
  availableSlots,
  loadingSlots,
  onDateChange,
  onTimeChange,
  onPartySizeChange,
  onBooking,
}: BookingWidgetProps) => {
  return (
    <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm">
      <H3 className="mb-4">Make a Reservation</H3>

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
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <Pressable
                key={i}
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
                  {isToday
                    ? "Today"
                    : date.toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
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
                    isSelected
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
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
        {partySize > 8 && (
          <Text className="text-sm text-muted-foreground mt-1">
            For larger parties, please call the restaurant
          </Text>
        )}
      </View>

      {/* Time Slot Selection */}
      <View className="mb-4">
        <Text className="font-medium mb-2">Available Times</Text>
        {loadingSlots ? (
          <View className="flex-row items-center justify-center py-4">
            <ActivityIndicator size="small" />
            <Text className="ml-2 text-muted-foreground">
              Loading availability...
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {availableSlots.map((slot) => (
              <Pressable
                key={slot.time}
                onPress={() => {
                  if (slot.available) {
                    console.log("Selected time:", slot.time);
                    onTimeChange(slot.time);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                disabled={!slot.available}
                className={`px-4 py-2 rounded-lg min-w-[70px] ${
                  selectedTime === slot.time
                    ? "bg-primary border-2 border-primary"
                    : slot.available
                      ? "bg-muted border border-border"
                      : "bg-muted/50 border border-muted"
                }`}
                style={{
                  opacity: slot.available ? 1 : 0.5,
                }}
              >
                <Text
                  className={`font-medium text-center ${
                    selectedTime === slot.time
                      ? "text-primary-foreground"
                      : !slot.available
                        ? "text-muted-foreground"
                        : ""
                  }`}
                >
                  {slot.time}
                </Text>
                {slot.available &&
                  slot.availableCapacity < 5 &&
                  slot.availableCapacity > 0 && (
                    <Text className="text-xs text-orange-600 text-center mt-1">
                      {slot.availableCapacity} left
                    </Text>
                  )}
              </Pressable>
            ))}
            {availableSlots.length === 0 && (
              <Text className="text-muted-foreground text-center w-full py-4">
                No availability for this date
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Selected Time Confirmation */}
      {selectedTime && (
        <View className="mb-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
          <Text className="text-xs text-green-800 dark:text-green-200">
            Selected: {selectedTime}
          </Text>
        </View>
      )}

      {/* Booking Button */}
      <Button onPress={onBooking} disabled={!selectedTime} className="w-full">
        <Text>
          {restaurant.booking_policy === "instant"
            ? "Book Now"
            : "Request Booking"}
        </Text>
      </Button>

      {/* Booking Policy Note */}
      {restaurant.booking_policy === "request" && (
        <Text className="text-xs text-muted-foreground text-center mt-2">
          Restaurant will confirm within 2 hours
        </Text>
      )}
    </View>
  );
};
