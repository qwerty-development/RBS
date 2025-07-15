import React from "react";
import { View } from "react-native";
import { MapPin, Star } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";

interface RestaurantFrequencyData {
  id: string;
  name: string;
  visits: number;
  lastVisit: string;
  cuisineType: string;
  averageRating: number;
}

interface InsightsTopRestaurantsProps {
  restaurantFrequency: RestaurantFrequencyData[];
}

export const InsightsTopRestaurants: React.FC<InsightsTopRestaurantsProps> = ({
  restaurantFrequency,
}) => {
  if (!restaurantFrequency.length) return null;

  return (
    <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
      <View className="p-5">
        <View className="flex-row items-center gap-3 mb-4">
          <MapPin size={20} color="#10b981" />
          <H3 className="text-foreground">Favorite Restaurants</H3>
        </View>
        <View className="space-y-4">
          {restaurantFrequency.slice(0, 5).map((restaurant, index) => (
            <View key={`${restaurant.id}-${index}`} className="w-full">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 pr-3">
                  <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center flex-shrink-0">
                    <Text className="text-primary font-bold text-sm">
                      #{index + 1}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="font-medium text-foreground"
                      numberOfLines={1}
                    >
                      {restaurant.name}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <Muted
                        className="text-sm flex-shrink-1"
                        numberOfLines={1}
                      >
                        {restaurant.cuisineType}
                      </Muted>
                      {restaurant.averageRating > 0 && (
                        <View className="flex-row items-center gap-1 flex-shrink-0">
                          <Star size={12} color="#f59e0b" fill="#f59e0b" />
                          <Text className="text-xs text-muted-foreground">
                            {restaurant.averageRating.toFixed(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <View className="items-end flex-shrink-0">
                  <Text className="font-bold text-foreground">
                    {restaurant.visits} visits
                  </Text>
                  <Muted className="text-xs">
                    {new Date(restaurant.lastVisit).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </Muted>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};
