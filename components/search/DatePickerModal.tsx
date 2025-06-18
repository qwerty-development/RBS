import React, { useMemo } from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

interface DatePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onDateSelect: (date: Date) => void;
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

    const handleDateSelect = (date: Date) => {
      onDateSelect(date);
      onClose();
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
              {dateOptions.map((date, index) => {
                const isSelected =
                  date.toDateString() === bookingFilters.date.toDateString();
                const isToday =
                  date.toDateString() === new Date().toDateString();

                return (
                  <Pressable
                    key={index}
                    onPress={() => handleDateSelect(date)}
                    className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : ""}`}
                    >
                      {isToday
                        ? "Today"
                        : date.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
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
  }
);
