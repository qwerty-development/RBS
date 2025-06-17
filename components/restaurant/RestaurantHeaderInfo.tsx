import React from "react";
import { View } from "react-native";
import { Star } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  average_rating?: number;
  total_reviews?: number;
  review_summary?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
};

interface RestaurantHeaderInfoProps {
  restaurant: Restaurant;
  highlightOfferId?: string;
}

export const RestaurantHeaderInfo = ({
  restaurant,
  highlightOfferId,
}: RestaurantHeaderInfoProps) => {
  return (
    <View className="px-4 pt-4 pb-2">
      <H1>{restaurant.name}</H1>
      <View className="flex-row items-center gap-3 mt-2">
        <Text className="text-muted-foreground">{restaurant.cuisine_type}</Text>
        <Text className="text-muted-foreground">•</Text>
        <Text className="text-muted-foreground">
          {"$".repeat(restaurant.price_range)}
        </Text>
        <Text className="text-muted-foreground">•</Text>
        <View className="flex-row items-center gap-1">
          <Star size={16} color="#f59e0b" fill="#f59e0b" />
          <Text className="font-medium">
            {restaurant.review_summary?.average_rating?.toFixed(1) ||
              restaurant.average_rating?.toFixed(1) ||
              "N/A"}
          </Text>
          <Text className="text-muted-foreground">
            (
            {restaurant.review_summary?.total_reviews ||
              restaurant.total_reviews ||
              0}
            )
          </Text>
        </View>
      </View>

      {highlightOfferId && (
        <View className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Text className="font-semibold text-primary">
            🎉 Special Offer Available!
          </Text>
          <Text className="text-sm text-muted-foreground mt-1">
            You came here from a special offer. Don't miss out!
          </Text>
        </View>
      )}
    </View>
  );
};
