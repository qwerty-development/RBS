import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  DollarSign,
  MapPin,
  Clock,
  Navigation,
  Heart,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";

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
  opening_time: string;
  closing_time: string;
  booking_policy: "instant" | "request";
  price_range: number;
  average_rating?: number;
  total_reviews?: number;
  distance?: number;
  isAvailable?: boolean;
  tags?: string[] | null;
};

interface RestaurantSearchCardProps {
  item: Restaurant;
  bookingFilters: BookingFilters;
  favorites: Set<string>;
  onToggleFavorite: (restaurantId: string) => void;
  onDirections: (restaurant: Restaurant) => void;
}

export const RestaurantSearchCard = ({
  item,
  bookingFilters,
  favorites,
  onToggleFavorite,
  onDirections,
}: RestaurantSearchCardProps) => {
  const router = useRouter();

  const handleRestaurantPress = () => {
    router.push(`/restaurant/${item.id}`);
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    onToggleFavorite(item.id);
  };

  const handleDirectionsPress = (e: any) => {
    e.stopPropagation();
    onDirections(item);
  };

  return (
    <Pressable
      onPress={handleRestaurantPress}
      className="bg-card rounded-lg shadow-sm border border-border mb-4 overflow-hidden"
    >
      <View className="relative">
        <Image
          source={{ uri: item.main_image_url }}
          className="w-full h-48"
          contentFit="cover"
        />

        {/* Favorite button overlay */}
        <Pressable
          onPress={handleFavoritePress}
          className="absolute top-3 right-3 bg-white/80 rounded-full p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart
            size={20}
            color={favorites.has(item.id) ? "#ef4444" : "#666"}
            fill={favorites.has(item.id) ? "#ef4444" : "transparent"}
          />
        </Pressable>

        {/* Booking policy badge */}
        <View className="absolute bottom-3 left-3">
          <View
            className={`px-2 py-1 rounded-full ${
              item.booking_policy === "instant"
                ? "bg-green-500/90"
                : "bg-orange-500/90"
            }`}
          >
            <Text className="text-xs text-white font-medium">
              {item.booking_policy === "instant" ? "Instant Book" : "Request"}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text className="text-lg font-semibold mb-1" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-sm text-muted-foreground mb-1">
              {item.address}
            </Text>
            <Text className="text-muted-foreground mb-2">
              {item.cuisine_type}
            </Text>

            <View className="flex-row items-center gap-4 mb-2">
              {(item.average_rating || 0) > 0 && (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text className="text-sm font-medium">
                    {item.average_rating?.toFixed(1)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    ({item.total_reviews || 0})
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-1">
                <DollarSign size={14} color="#666" />
                <Text className="text-sm">{"$".repeat(item.price_range)}</Text>
              </View>

              {item.distance && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={14} color="#666" />
                  <Text className="text-sm text-muted-foreground">
                    {item.distance < 1
                      ? `${(item.distance * 1000).toFixed(0)}m`
                      : `${item.distance.toFixed(1)}km`}
                  </Text>
                </View>
              )}
            </View>

            {/* Availability indicator */}
            {/* Availability indicator - always show if we have availability info */}
            {typeof item.isAvailable === "boolean" && (
              <View
                className={`px-2 py-1 rounded-full self-start mb-2 ${
                  item.isAvailable
                    ? "bg-green-100 dark:bg-green-900/20"
                    : "bg-red-100 dark:bg-red-900/20"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    item.isAvailable
                      ? "text-green-800 dark:text-green-200"
                      : "text-red-800 dark:text-red-200"
                  }`}
                >
                  {item.isAvailable
                    ? `Available ${bookingFilters.time}`
                    : `Fully booked ${bookingFilters.time}`}
                </Text>
              </View>
            )}

            {item.tags && item.tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <View key={tag} className="bg-muted px-2 py-0.5 rounded-full">
                    <Text className="text-xs">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View className="border-t border-border px-4 py-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                {item.opening_time} - {item.closing_time}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Text
                className={`text-xs font-medium ${
                  item.booking_policy === "instant"
                    ? "text-green-600"
                    : "text-orange-600"
                }`}
              >
                {item.booking_policy === "instant"
                  ? "Instant Book"
                  : "Request to Book"}
              </Text>

              <Pressable
                onPress={handleDirectionsPress}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Navigation size={16} color="#3b82f6" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};
