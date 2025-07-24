import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { PARTY_SIZES } from "@/constants/searchConstants";

interface BookingFilters {
  date: Date | null;
  time: string;
  partySize: number | null;
  availableOnly: boolean;
}

interface PartySizePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onPartySizeSelect: (size: number | null) => void;
  onClose: () => void;
}

export const PartySizePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onPartySizeSelect,
    onClose,
  }: PartySizePickerModalProps) => {
    const handlePartySizeSelect = (size: number | null) => {
      onPartySizeSelect(size);
      onClose();
    };

    const getDisplayText = (size: number | null) => {
      if (size === null) return "Any party size";
      return `${size} ${size === 1 ? "Person" : "People"}`;
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
              <Text className="font-semibold text-lg">Select Party Size</Text>
            </View>

            <ScrollView className="max-h-64">
              {PARTY_SIZES.map((size, index) => {
                const isSelected = size === bookingFilters.partySize;

                return (
                  <Pressable
                    key={index}
                    onPress={() => handlePartySizeSelect(size)}
                    className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : ""}`}
                    >
                      {getDisplayText(size)}
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
