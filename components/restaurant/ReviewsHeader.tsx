import React from "react";
import { View, Pressable } from "react-native";
import { ChevronLeft, Filter } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";

interface ReviewsHeaderProps {
  restaurantName: string;
  onBack: () => void;
  onFilter: () => void;
}

export const ReviewsHeader: React.FC<ReviewsHeaderProps> = ({
  restaurantName,
  onBack,
  onFilter,
}) => {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border">
      <Pressable onPress={onBack} className="p-2 -ml-2">
        <ChevronLeft size={24} />
      </Pressable>
      <View className="flex-1 mx-4">
        <Text className="text-center font-semibold">Reviews</Text>
        <Muted className="text-center text-sm">{restaurantName}</Muted>
      </View>
      <Pressable onPress={onFilter} className="p-2">
        <Filter size={20} />
      </Pressable>
    </View>
  );
};
