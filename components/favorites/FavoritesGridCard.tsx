import React from "react";
import { View, Pressable, Animated } from "react-native";
import { Star } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import type { Favorite } from "@/hooks/useFavorites";

interface FavoritesGridCardProps {
  item: Favorite;
  onPress: (restaurantId: string) => void;
  onLongPress: (favoriteId: string, restaurantName: string) => void;
  removingId: string | null;
  fadeAnim: Animated.Value;
  scaleAnim: Animated.Value;
}

export const FavoritesGridCard: React.FC<FavoritesGridCardProps> = ({
  item,
  onPress,
  onLongPress,
  removingId,
  fadeAnim,
  scaleAnim,
}) => {
  return (
    <Animated.View
      style={{
        opacity: removingId === item.id ? fadeAnim : 1,
        transform: [{ scale: removingId === item.id ? scaleAnim : 1 }],
      }}
      className="flex-1 p-2"
    >
      <Pressable
        onPress={() => onPress(item.restaurant_id)}
        onLongPress={() => onLongPress(item.id, item.restaurant.name)}
        className="bg-card rounded-xl overflow-hidden shadow-sm"
      >
        <Image
          source={{ uri: item.restaurant.main_image_url }}
          className="w-full h-32"
          contentFit="cover"
        />
        <View className="p-3">
          <Text className="font-semibold text-sm" numberOfLines={1}>
            {item.restaurant.name}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {item.restaurant.cuisine_type}
          </Text>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs">
                {item.restaurant.average_rating?.toFixed(1) || "N/A"}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {"$".repeat(item.restaurant.price_range)}
            </Text>
          </View>

          {(item.total_bookings || 0) > 0 && (
            <View className="mt-2 bg-primary/10 rounded px-2 py-1">
              <Text className="text-xs text-primary font-medium">
                Visited {item.total_bookings}x
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};
