import React from "react";
import { View, Pressable, Image } from "react-native";
import { Text } from "@/components/ui/text";

interface CuisineItem {
  id: string;
  label: string;
  image: any;
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
      <View className="w-20 h-20 bg-muted rounded-full items-center justify-center mb-2 overflow-hidden">
        <Image
          source={cuisine.image}
          className="w-16 h-16 rounded-full"
          resizeMode="cover"
        />
      </View>
      <Text className="text-sm font-medium">{cuisine.label}</Text>
    </Pressable>
  );
}
