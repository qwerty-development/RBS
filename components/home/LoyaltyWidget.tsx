import React from "react";
import { View, Pressable } from "react-native";
import { Trophy } from "lucide-react-native";
import { Muted } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";

interface LoyaltyWidgetProps {
  loyaltyPoints: number;
  onPress: () => void;
  colorScheme: "light" | "dark" | null;
}

export function LoyaltyWidget({
  loyaltyPoints,
  onPress,
  colorScheme,
}: LoyaltyWidgetProps) {
  if (!loyaltyPoints || loyaltyPoints <= 0) {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-6 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20"
    >
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center gap-2 mb-1">
            <Trophy
              size={20}
              color={colorScheme === "dark" ? "#fbbf24" : "#f59e0b"}
            />
            <Text className="font-bold text-lg">{loyaltyPoints} Points</Text>
          </View>
          <Muted className="text-sm">
            Tap to view rewards and exclusive offers
          </Muted>
        </View>
      </View>
    </Pressable>
  );
}
