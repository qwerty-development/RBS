import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Star, DollarSign, MapPin, Heart } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { LocationService } from "@/lib/locationService";

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

type Restaurant = {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  address: string;
  price_range: number;
  average_rating?: number;
  total_reviews?: number;
  distance?: number | null;
  isAvailable?: boolean;
  booking_policy?: "instant" | "request";
};

interface MinimalRestaurantSearchCardProps {
  item: Restaurant;
  bookingFilters: BookingFilters;
  favorites: Set<string>;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onPress?: () => void;
}

export const MinimalRestaurantSearchCard = ({
  item: restaurant,
  bookingFilters,
  favorites,
  onToggleFavorite,
  onPress,
}: MinimalRestaurantSearchCardProps) => {
  const router = useRouter();

  const handleRestaurantPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/restaurant/${restaurant.id}`);
    }
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    onToggleFavorite(restaurant.id);
  };

  const isFavorite = favorites?.has(restaurant.id) || false;

  return (
    <Pressable
      onPress={handleRestaurantPress}
      className="bg-card rounded-lg shadow-sm border border-border overflow-hidden mb-3"
    >
      {/* Taller Image on Top */}
      <View className="relative">
        <Image
          source={{ uri: restaurant?.main_image_url || "" }}
          className="w-full h-56"
          contentFit="cover"
        />

        {/* Favorite button overlay */}
        <Pressable
          onPress={handleFavoritePress}
          className="absolute top-3 right-3 bg-white/80 rounded-full p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart
            size={18}
            color={isFavorite ? "#ef4444" : "#666"}
            fill={isFavorite ? "#ef4444" : "transparent"}
          />
        </Pressable>

        {/* Compact booking policy badge */}
        {restaurant.booking_policy && (
          <View className="absolute bottom-3 left-3">
            <View
              className={`px-2 py-1 rounded-full ${
                restaurant.booking_policy === "instant"
                  ? "bg-green-500/90"
                  : "bg-orange-500/90"
              }`}
            >
              <Text className="text-xs text-white font-medium">
                {restaurant.booking_policy === "instant"
                  ? "Instant"
                  : "Request"}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Content underneath */}
      <View className="p-3">
        <View className="flex-row items-start justify-between mb-1">
          <Text
            className="font-semibold text-base flex-1 mr-2"
            numberOfLines={1}
          >
            {restaurant.name}
          </Text>

          {/* Availability indicator */}
          {typeof restaurant.isAvailable === "boolean" && (
            <View
              className={`px-1.5 py-0.5 rounded-full ${
                restaurant.isAvailable
                  ? "bg-green-100 dark:bg-green-900/20"
                  : "bg-red-100 dark:bg-red-900/20"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  restaurant.isAvailable
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {restaurant.isAvailable ? "Available" : "Full"}
              </Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-muted-foreground mb-2" numberOfLines={1}>
          {restaurant.cuisine_type}
        </Text>

        <View className="flex-row items-center gap-3">
          {/* Rating */}
          {(restaurant.average_rating || 0) > 0 && (
            <View className="flex-row items-center gap-1">
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-medium">
                {restaurant.average_rating?.toFixed(1)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                ({restaurant.total_reviews || 0})
              </Text>
            </View>
          )}

          {/* Price range */}
          <View className="flex-row items-center gap-1">
            <DollarSign size={12} color="#666" />
            <Text className="text-sm">
              {"$".repeat(restaurant.price_range)}
            </Text>
          </View>

          {/* Distance */}
          {restaurant.distance !== undefined &&
            restaurant.distance !== null && (
              <View className="flex-row items-center gap-1">
                <MapPin size={12} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  {LocationService.formatDistance(restaurant.distance)}
                </Text>
              </View>
            )}
        </View>
      </View>
    </Pressable>
  );
};
