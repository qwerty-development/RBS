import React, { useMemo } from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface BookingFilters {
  date: Date | null;
  time: string;
  partySize: number | null;
  availableOnly: boolean;
}

interface DatePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onDateSelect: (date: Date | null) => void;
  onClose: () => void;
}

export const DatePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onDateSelect,
    onClose,
  }: DatePickerModalProps) => {
    // Generate next 14 days
    const dateOptions = useMemo(() => {
      const dates = [];
      const today = new Date();

      for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }

      return dates;
    }, []);

    const handleDateSelect = (date: Date | null) => {
      onDateSelect(date);
      onClose();
    };

    const getDateDisplayText = (date: Date) => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      if (date.toDateString() === today.toDateString()) return "Today";
      if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    };

    const isDateSelected = (date: Date | null) => {
      if (bookingFilters.date === null && date === null) return true;
      if (bookingFilters.date === null || date === null) return false;
      return date.toDateString() === bookingFilters.date.toDateString();
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent={false}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={onClose}
        >
          <Pressable
            className="bg-background rounded-lg w-80 max-h-96"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="p-4 border-b border-border">
              <Text className="font-semibold text-lg">Select Date</Text>
            </View>

            <ScrollView className="max-h-64">
              {/* Any Date Option */}
              <Pressable
                onPress={() => handleDateSelect(null)}
                className={`p-4 border-b border-border ${isDateSelected(null) ? "bg-primary/10" : ""}`}
              >
                <Text
                  className={`font-medium ${isDateSelected(null) ? "text-primary" : ""}`}
                >
                  Any date
                </Text>
              </Pressable>

              {/* Specific Dates */}
              {dateOptions.map((date, index) => {
                const isSelected = isDateSelected(date);

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleDateSelect(date)}
                    className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : ""}`}
                    >
                      {getDateDisplayText(date)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="p-4">
              <Button variant="outline" onPress={onClose}>
                <Text>Cancel</Text>
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);
