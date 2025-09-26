// components/search/RestaurantSearchCard.tsx
import React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useNavigationModal } from "@/context/modal-provider";
import * as Haptics from "expo-haptics";
import {
  Star,
  DollarSign,
  MapPin,
  Clock,
  Navigation,
  Heart,
  Trash2,
  Zap,
  Timer,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { cn } from "@/lib/utils";
import { LocationService } from "@/lib/locationService";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

type Restaurant = {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  address: string;
  booking_policy: "instant" | "request";
  price_range: number;
  average_rating?: number | null;
  total_reviews?: number | null;
  distance?: number | null;
  isAvailable?: boolean;
  tags?: string[] | null;
  restaurant_hours?: {
    day_of_week: string;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
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
  onDelete?: never;
  isDeleting?: never;
  showDeleteButton?: never;
}

// New interface for playlist/other screens
interface PlaylistScreenProps {
  restaurant: Restaurant;
  onPress?: () => void;
  variant?: "default" | "compact";
  showActions?: boolean;
  disabled?: boolean;
  className?: string;
  onDelete?: (restaurantId: string) => Promise<void>;
  isDeleting?: boolean;
  showDeleteButton?: boolean;
  item?: never;
  bookingFilters?: never;
  favorites?: never;
  onToggleFavorite?: never;
  onDirections?: never;
}

// Additional interface for search with restaurant prop and separate handlers
interface SearchWithRestaurantProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  onPress?: () => void;
  onToggleFavorite: () => Promise<void>;
  onOpenDirections: () => Promise<void>;
  variant?: never;
  showActions?: never;
  disabled?: never;
  className?: never;
  onDelete?: never;
  isDeleting?: never;
  showDeleteButton?: never;
  item?: never;
  bookingFilters?: never;
  favorites?: never;
  onDirections?: never;
}

type RestaurantSearchCardProps =
  | SearchScreenProps
  | PlaylistScreenProps
  | SearchWithRestaurantProps;

export const RestaurantSearchCard = (props: RestaurantSearchCardProps) => {
  const router = useRouter();
  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();

  // Determine which props pattern we're using
  const isSearchScreen = "item" in props && props.item !== undefined;
  const isSearchWithRestaurant =
    "isFavorite" in props && "onToggleFavorite" in props;
  const isActualSearchScreen = isSearchScreen || isSearchWithRestaurant;

  // Extract the restaurant data based on props pattern
  const restaurant = isSearchScreen ? props.item : props.restaurant;
  const variant = isActualSearchScreen ? "default" : props.variant || "default";
  const showActions = isActualSearchScreen ? true : props.showActions !== false;
  const disabled = isActualSearchScreen ? false : props.disabled || false;
  const className = isActualSearchScreen ? "" : props.className || "";
  const showDeleteButton = isActualSearchScreen
    ? false
    : props.showDeleteButton || false;
  const isDeleting = isActualSearchScreen ? false : props.isDeleting || false;

  // Safety check
  if (!restaurant) {
    return null;
  }

  const handleRestaurantPress = () => {
    if (disabled) return;

    // Check if any modal is already open
    if (isAnyModalOpen) {
      return;
    }

    // Use navigation modal to prevent multiple modals
    openNavigationModal(`restaurant-${restaurant.id}`, () => {
      if (props.onPress) {
        props.onPress();
      } else {
        router.push(`/restaurant/${restaurant.id}`);
      }
    });
  };

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    // Add haptic feedback for better UX
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isSearchScreen && props.onToggleFavorite) {
      props.onToggleFavorite(restaurant.id);
    } else if (isSearchWithRestaurant && props.onToggleFavorite) {
      props.onToggleFavorite();
    }
  };

  const handleDirectionsPress = (e: any) => {
    e.stopPropagation();
    if (isSearchScreen && props.onDirections) {
      props.onDirections(restaurant);
    } else if (isSearchWithRestaurant && props.onOpenDirections) {
      props.onOpenDirections();
    }
  };

  const handleDeletePress = (e: any) => {
    e.stopPropagation();
    if (!isSearchScreen && props.onDelete) {
      props.onDelete(restaurant.id);
    }
  };

  const isFavorite = isSearchScreen
    ? props.favorites?.has(restaurant.id)
    : isSearchWithRestaurant
      ? props.isFavorite
      : false;

  return (
    <Pressable
      onPress={handleRestaurantPress}
      disabled={disabled}
      className={cn(
        "bg-card rounded-lg shadow-sm border border-border overflow-hidden",
        variant === "compact" ? "mb-2" : "mb-3",
        disabled && "opacity-60",
        className,
      )}
    >
      <View className="relative">
        <Image
          source={{ uri: restaurant?.main_image_url || "" }}
          className={cn("w-full", variant === "compact" ? "h-40" : "h-60")}
          contentFit="cover"
        />

        {/* Favorite button overlay - only show in search screen */}
        {isActualSearchScreen && showActions && (
          <Pressable
            onPress={handleFavoritePress}
            className="absolute top-3 right-3 rounded-full p-2 active:scale-90 transition-transform"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={17}
              color={isFavorite ? "#ef4444" : "#ffffff"}
              fill={isFavorite ? "#ef4444" : "transparent"}
              strokeWidth={isFavorite ? 2 : 1.5}
            />
          </Pressable>
        )}

        {/* Delete button overlay - only show in playlist context */}
        {!isActualSearchScreen && showDeleteButton && (
          <Pressable
            onPress={handleDeletePress}
            disabled={isDeleting}
            className="absolute top-3 right-3 bg-red-500/90 rounded-full p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Trash2 size={16} color="#fff" />
            )}
          </Pressable>
        )}

        {/* Booking policy badge */}
        {restaurant.booking_policy && (
          <View className="absolute top-3 left-3">
            <View
              className={`px-2 py-1 rounded-lg border bg-background/90 backdrop-blur-sm ${
                restaurant.booking_policy === "instant"
                  ? "border-emerald-200 dark:border-emerald-800"
                  : "border-amber-200 dark:border-amber-800"
              }`}
            >
              <View className="flex-row items-center gap-1">
                {restaurant.booking_policy === "instant" ? (
                  <Zap size={10} color="#10b981" />
                ) : (
                  <Timer size={10} color="#f59e0b" />
                )}
                <Text
                  className={`text-xs font-medium ${
                    restaurant.booking_policy === "instant"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {restaurant.booking_policy === "instant"
                    ? "Instant"
                    : "Request"}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View className={cn("p-3", variant === "compact" && "p-2")}>
        <View className="flex-row items-start justify-between mb-1">
          <View className="flex-1 mr-3">
            <Text
              className={cn(
                "font-semibold mb-1",
                variant === "compact" ? "text-base" : "text-lg",
              )}
              numberOfLines={1}
            >
              {restaurant.name}
            </Text>
            <Text className="text-muted-foreground text-sm mb-1">
              {restaurant.cuisine_type}
            </Text>

            <Text className="text-xs text-muted-foreground mb-2">
              {restaurant.address}
            </Text>

            {/* Compact row with rating, price, and distance with dot dividers */}
            <View className="flex-row items-center flex-wrap">
              {/* Rating */}
              <View className="flex-row items-center">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs font-medium ml-1">
                  {restaurant.average_rating && restaurant.average_rating > 0
                    ? restaurant.average_rating.toFixed(1)
                    : "-"}
                </Text>
                <Text className="text-xs text-muted-foreground ml-1">
                  ({restaurant.total_reviews || 0})
                </Text>
              </View>

              {/* Dot divider */}
              <Text className="text-muted-foreground mx-2 text-xs">•</Text>

              {/* Price */}
              <View className="flex-row items-center">
                <DollarSign size={12} color="#666" />
                <Text className="text-xs ml-1">
                  {"$".repeat(restaurant.price_range)}
                </Text>
              </View>

              {/* Distance with dot divider */}
              {restaurant.distance !== undefined &&
                restaurant.distance !== null && (
                  <>
                    <Text className="text-muted-foreground mx-2 text-xs">
                      •
                    </Text>
                    <View className="flex-row items-center">
                      <MapPin size={12} color="#666" />
                      <Text className="text-xs text-muted-foreground ml-1">
                        {LocationService.formatDistance(restaurant.distance)}
                      </Text>
                    </View>
                  </>
                )}
            </View>

            {/* Availability indicator - only show in search screen with booking filters */}
            {isSearchScreen &&
              typeof restaurant.isAvailable === "boolean" &&
              props.bookingFilters && (
                <View
                  className={`px-2 py-1 rounded-full self-start mt-2 ${
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
          </View>
        </View>
      </View>
    </Pressable>
  );
};
