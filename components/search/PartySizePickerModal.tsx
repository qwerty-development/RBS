import React from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

interface PartySizePickerModalProps {
  visible: boolean;
  bookingFilters: BookingFilters;
  onPartySizeSelect: (size: number) => void;
  onClose: () => void;
}

export const PartySizePickerModal = React.memo(
  ({
    visible,
    bookingFilters,
    onPartySizeSelect,
    onClose,
  }: PartySizePickerModalProps) => {
    const handlePartySizeSelect = (size: number) => {
      onPartySizeSelect(size);
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
              <Text className="font-semibold text-lg">Select Party Size</Text>
            </View>

            <ScrollView className="max-h-64">
              {PARTY_SIZES.map((size) => {
                const isSelected = size === bookingFilters.partySize;

                return (
                  <Pressable
                    key={size}
                    onPress={() => handlePartySizeSelect(size)}
                    className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : ""}`}
                    >
                      {size} {size === 1 ? "Person" : "People"}
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
