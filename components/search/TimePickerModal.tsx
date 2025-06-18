import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

const TIME_SLOTS = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

interface TimePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onTimeSelect: (time: string) => void;
  onClose: () => void;
}

export const TimePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onTimeSelect,
    onClose,
  }: TimePickerModalProps) => {
    const handleTimeSelect = (time: string) => {
      onTimeSelect(time);
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
              <Text className="font-semibold text-lg">Select Time</Text>
            </View>

            <ScrollView className="max-h-64">
              {TIME_SLOTS.map((time) => {
                const isSelected = time === bookingFilters.time;

                return (
                  <Pressable
                    key={time}
                    onPress={() => handleTimeSelect(time)}
                    className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : ""}`}
                    >
                      {time}
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
