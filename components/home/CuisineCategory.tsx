import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

interface CuisineItem {
  id: string;
  label: string;
  emoji: string;
  popular?: boolean;
}

interface CuisineCategoryProps {
  cuisine: CuisineItem;
  onPress: (cuisineId: string) => void;
}

export function CuisineCategory({ cuisine, onPress }: CuisineCategoryProps) {
  const handlePress = () => {
    onPress(cuisine.id);
  };

  return (
    <Pressable onPress={handlePress} className="items-center">
      <View className="w-16 h-16 bg-muted rounded-full items-center justify-center mb-2">
        <Text className="text-3xl">{cuisine.emoji}</Text>
      </View>
      <Text className="text-sm font-medium">{cuisine.label}</Text>
    </Pressable>
  );
}
