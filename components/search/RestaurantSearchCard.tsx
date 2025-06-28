// components/search/RestaurantSearchCard.tsx
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
import { cn } from "@/lib/utils";

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

// Original interface for search screen
interface SearchScreenProps {
  item: Restaurant;
  bookingFilters: BookingFilters;
  favorites: Set<string>;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onDirections: (restaurant: Restaurant) => Promise<void>;
  onPress?: () => void;
  variant?: never;
  showActions?: never;
  disabled?: never;
  className?: never;
  restaurant?: never;
}

// New interface for playlist/other screens
interface PlaylistScreenProps {
  restaurant: Restaurant;
  onPress?: () => void;
  variant?: "default" | "compact";
  showActions?: boolean;
  disabled?: boolean;
  className?: string;
  item?: never;
  bookingFilters?: never;
  favorites?: never;
  onToggleFavorite?: never;
  onDirections?: never;
}

type RestaurantSearchCardProps = SearchScreenProps | PlaylistScreenProps;

export const RestaurantSearchCard = (props: RestaurantSearchCardProps) => {
  const router = useRouter();

  // Determine which props pattern we're using
  const isSearchScreen = 'item' in props && props.item !== undefined;
  
  // Extract the restaurant data based on props pattern
  const restaurant = isSearchScreen ? props.item : props.restaurant;
  const variant = isSearchScreen ? "default" : (props.variant || "default");
  const showActions = isSearchScreen ? true : (props.showActions !== false);
  const disabled = isSearchScreen ? false : (props.disabled || false);
  const className = isSearchScreen ? "" : (props.className || "");

  // Safety check
  if (!restaurant) {
    return null;
  }

  const handleRestaurantPress = () => {
    if (disabled) return;
    
    if (props.onPress) {
      props.onPress();
    } else {
      router.push(`/restaurant/${restaurant.id}`);
    }
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    if (isSearchScreen && props.onToggleFavorite) {
      props.onToggleFavorite(restaurant.id);
    }
  };

  const handleDirectionsPress = (e: any) => {
    e.stopPropagation();
    if (isSearchScreen && props.onDirections) {
      props.onDirections(restaurant);
    }
  };

  const isFavorite = isSearchScreen ? props.favorites?.has(restaurant.id) : false;

  return (
    <Pressable
      onPress={handleRestaurantPress}
      disabled={disabled}
      className={cn(
        "bg-card rounded-lg shadow-sm border border-border overflow-hidden",
        variant === "compact" ? "mb-2" : "mb-4",
        disabled && "opacity-60",
        className
      )}
    >
      <View className="relative">
        <Image
          source={{ uri: restaurant?.main_image_url || "" }}
          className={cn(
            "w-full",
            variant === "compact" ? "h-32" : "h-48"
          )}
          contentFit="cover"
        />

        {/* Favorite button overlay - only show in search screen */}
        {isSearchScreen && showActions && (
          <Pressable
            onPress={handleFavoritePress}
            className="absolute top-3 right-3 bg-white/80 rounded-full p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={20}
              color={isFavorite ? "#ef4444" : "#666"}
              fill={isFavorite ? "#ef4444" : "transparent"}
            />
          </Pressable>
        )}

        {/* Booking policy badge */}
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
                {restaurant.booking_policy === "instant" ? "Instant Book" : "Request"}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View className={cn("p-4", variant === "compact" && "p-3")}>
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-3">
            <Text 
              className={cn(
                "font-semibold mb-1",
                variant === "compact" ? "text-base" : "text-lg"
              )} 
              numberOfLines={1}
            >
              {restaurant.name}
            </Text>
            <Text className="text-sm text-muted-foreground mb-1">
              {restaurant.address}
            </Text>
            <Text className="text-muted-foreground mb-2">
              {restaurant.cuisine_type}
            </Text>

            <View className="flex-row items-center gap-4 mb-2">
              {(restaurant.average_rating || 0) > 0 && (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text className="text-sm font-medium">
                    {restaurant.average_rating?.toFixed(1)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    ({restaurant.total_reviews || 0})
                  </Text>
                </View>
              )}

              <View className="flex-row items-center gap-1">
                <DollarSign size={14} color="#666" />
                <Text className="text-sm">{"$".repeat(restaurant.price_range)}</Text>
              </View>

              {restaurant.distance && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={14} color="#666" />
                  <Text className="text-sm text-muted-foreground">
                    {restaurant.distance < 1
                      ? `${(restaurant.distance * 1000).toFixed(0)}m`
                      : `${restaurant.distance.toFixed(1)}km`}
                  </Text>
                </View>
              )}
            </View>

            {/* Availability indicator - only show in search screen with booking filters */}
            {isSearchScreen && typeof restaurant.isAvailable === "boolean" && props.bookingFilters && (
              <View
                className={`px-2 py-1 rounded-full self-start mb-2 ${
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
                  {restaurant.isAvailable
                    ? `Available ${props.bookingFilters.time}`
                    : `Fully booked ${props.bookingFilters.time}`}
                </Text>
              </View>
            )}

            {restaurant.tags && restaurant.tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1">
                {restaurant.tags.slice(0, 3).map((tag) => (
                  <View key={tag} className="bg-muted px-2 py-0.5 rounded-full">
                    <Text className="text-xs">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Bottom section with opening hours and actions */}
        {variant !== "compact" && (
          <View className="border-t border-border pt-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Clock size={14} color="#666" />
                <Text className="text-xs text-muted-foreground">
                  {restaurant.opening_time} - {restaurant.closing_time}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Text
                  className={`text-xs font-medium ${
                    restaurant.booking_policy === "instant"
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {restaurant.booking_policy === "instant"
                    ? "Instant Book"
                    : "Request to Book"}
                </Text>

                {isSearchScreen && showActions && (
                  <Pressable
                    onPress={handleDirectionsPress}
                    className="p-1"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Navigation size={16} color="#3b82f6" />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};