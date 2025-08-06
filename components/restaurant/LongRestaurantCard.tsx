// components/restaurant/EnhancedRestaurantCard.tsx
import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  MapPin,
  Clock,
  Heart,
  ChevronRight,
  Tag,
  Calendar,
} from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface EnhancedRestaurantCardProps {
  restaurant: Restaurant;
  variant?: "default" | "detailed" | "compact";
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
  className?: string;
  showQuickActions?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function EnhancedRestaurantCard({
  restaurant,
  variant = "default",
  onPress,
  onFavoritePress,
  isFavorite = false,
  className,
  showQuickActions = false,
}: EnhancedRestaurantCardProps) {
  const router = useRouter();

  // Use the availability hook
  const {
    formatOperatingHours,
    checkAvailability,
    loading: availabilityLoading,
  } = useRestaurantAvailability(restaurant.id);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurant.id },
      });
    }
  };

  const handleQuickBook = (e: any) => {
    e.stopPropagation();
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        quickBook: "true",
      },
    });
  };

  const handleViewMenu = (e: any) => {
    e.stopPropagation();
    router.push({
      pathname: "/restaurant/[id]/menu",
      params: { id: restaurant.id },
    });
  };

  // Compact variant for lists where space is limited
  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm border border-border mb-2",
          className,
        )}
      >
        <View className="flex-row p-3">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-20 h-20 rounded-lg"
            contentFit="cover"
          />

          <View className="flex-1 ml-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text
                  className="font-semibold text-base mb-1"
                  numberOfLines={1}
                >
                  {restaurant.name}
                </Text>
                <Text
                  className="text-sm text-muted-foreground"
                  numberOfLines={1}
                >
                  {restaurant.cuisine_type}
                </Text>
              </View>
              {onFavoritePress && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onFavoritePress();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Heart
                    size={18}
                    color={isFavorite ? "#ef4444" : "#666"}
                    fill={isFavorite ? "#ef4444" : "transparent"}
                  />
                </Pressable>
              )}
            </View>

            <View className="flex-row items-center gap-3 mt-2">
              <View className="flex-row items-center gap-1">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs font-medium">
                  {restaurant.average_rating?.toFixed(1) || "N/A"}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {"$".repeat(restaurant.price_range)}
              </Text>
              <Text
                className={cn(
                  "text-xs font-medium",
                  restaurant.booking_policy === "instant"
                    ? "text-green-600"
                    : "text-orange-600",
                )}
              >
                {restaurant.booking_policy === "instant"
                  ? "Instant"
                  : "Request"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // Detailed variant with full information and actions
  if (variant === "detailed") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm border border-border",
          className,
        )}
      >
        {/* Full Width Image */}
        <View className="relative">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-full h-48"
            contentFit="cover"
          />

          {/* Favorite Button Overlay */}
          {onFavoritePress && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onFavoritePress();
              }}
              className="absolute top-3 right-3 bg-black/50 rounded-full p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Heart
                size={20}
                color={isFavorite ? "#ef4444" : "white"}
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
            </Pressable>
          )}

          {/* Featured Badge */}
          {restaurant.featured && (
            <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded">
              <Text className="text-xs text-primary-foreground font-medium">
                Featured
              </Text>
            </View>
          )}

          {/* Booking Policy Badge */}
          <View className="absolute bottom-3 right-3">
            <View
              className={cn(
                "px-2 py-1 rounded-full",
                restaurant.booking_policy === "instant"
                  ? "bg-green-600"
                  : "bg-orange-600",
              )}
            >
              <Text className="text-xs text-white font-medium">
                {restaurant.booking_policy === "instant"
                  ? "Instant Book"
                  : "Request"}
              </Text>
            </View>
          </View>
        </View>

        {/* Restaurant Information */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <H3 className="text-lg mb-1" numberOfLines={1}>
                {restaurant.name}
              </H3>
              <Text className="text-muted-foreground text-sm">
                {restaurant.cuisine_type}
              </Text>
            </View>
          </View>

          {/* Rating and Price Row */}
          <View className="flex-row items-center gap-4 mb-3">
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-semibold">
                {restaurant.average_rating?.toFixed(1) || "N/A"}
              </Text>
              {restaurant.total_reviews > 0 && (
                <Text className="text-sm text-muted-foreground">
                  ({restaurant.total_reviews} reviews)
                </Text>
              )}
            </View>
            <Text className="text-sm font-semibold text-muted-foreground">
              {"$".repeat(restaurant.price_range)} •{" "}
              {
                ["Budget", "Moderate", "Upscale", "Fine Dining"][
                  restaurant.price_range - 1
                ]
              }
            </Text>
          </View>

          {/* Location and Hours Row */}
          <View className="space-y-2 mb-3">
            <View className="flex-row items-center gap-2">
              <MapPin size={16} color="#666" />
              <Text className="text-sm text-muted-foreground flex-1">
                {restaurant.address || "Location not available"}
              </Text>
            </View>

            {!availabilityLoading && (
              <View className="flex-row items-center gap-2">
                <Clock
                  size={16}
                  color={
                    checkAvailability(new Date()).isOpen ? "#10b981" : "#ef4444"
                  }
                />
                <Text
                  className={cn(
                    "text-sm font-medium",
                    checkAvailability(new Date()).isOpen
                      ? "text-green-600"
                      : "text-red-600",
                  )}
                >
                  {checkAvailability(new Date()).isOpen ? "Open" : "Closed"}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  • {formatOperatingHours()}
                </Text>
              </View>
            )}
          </View>

          {/* Tags Row */}
          {restaurant.tags && restaurant.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {restaurant.tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  className="bg-primary/10 rounded-full px-3 py-1 border border-primary/20"
                >
                  <Text className="text-xs text-primary font-medium">
                    {tag}
                  </Text>
                </View>
              ))}
              {restaurant.tags.length > 3 && (
                <View className="bg-muted rounded-full px-3 py-1 border border-border">
                  <Text className="text-xs text-muted-foreground font-medium">
                    +{restaurant.tags.length - 3} more
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Quick Actions Bar */}
        {showQuickActions && (
          <View className="px-4 py-3">
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleQuickBook}
                className="flex-1 bg-primary rounded-lg py-3 px-4 flex-row items-center justify-center gap-2 border border-primary"
              >
                <Calendar size={18} color="white" />
                <Text className="text-primary-foreground font-semibold">
                  {restaurant.booking_policy === "instant"
                    ? "Book Now"
                    : "Request Booking"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleViewMenu}
                className="flex-1 bg-background rounded-lg py-3 px-4 flex-row items-center justify-center gap-2 border border-border"
              >
                <Tag size={18} color="#666" />
                <Text className="text-foreground font-semibold">View Menu</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Pressable>
    );
  }

  // Default variant - balanced between compact and detailed
  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        "bg-card rounded-xl overflow-hidden shadow-sm border border-border",
        className,
      )}
    >
      {/* Full Width Image */}
      <View className="relative">
        <Image
          source={{ uri: restaurant.main_image_url }}
          className="w-full h-40"
          contentFit="cover"
        />

        {/* Favorite Button Overlay */}
        {onFavoritePress && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onFavoritePress();
            }}
            className="absolute top-3 right-3 bg-black/50 rounded-full p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={18}
              color={isFavorite ? "#ef4444" : "white"}
              fill={isFavorite ? "#ef4444" : "transparent"}
            />
          </Pressable>
        )}

        {/* Featured Badge */}
        {restaurant.featured && (
          <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded">
            <Text className="text-xs text-primary-foreground font-medium">
              Featured
            </Text>
          </View>
        )}
      </View>

      {/* Restaurant Information */}
      <View className="p-4">
        <H3 className="mb-1" numberOfLines={1}>
          {restaurant.name}
        </H3>
        <P className="text-muted-foreground text-sm mb-3">
          {restaurant.cuisine_type}
        </P>

        <View className="flex-row items-center gap-3 mb-2">
          <View className="flex-row items-center gap-1">
            <Star size={14} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-sm font-medium">
              {restaurant.average_rating?.toFixed(1) || "N/A"}
            </Text>
            {restaurant.total_reviews > 0 && (
              <Text className="text-xs text-muted-foreground">
                ({restaurant.total_reviews})
              </Text>
            )}
          </View>
          <Text className="text-sm text-muted-foreground">
            {"$".repeat(restaurant.price_range)}
          </Text>
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#666" />
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {restaurant.address?.split(",")[0] || "N/A"}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          {!availabilityLoading && (
            <View className="flex-row items-center gap-1">
              <Clock
                size={14}
                color={
                  checkAvailability(new Date()).isOpen ? "#10b981" : "#ef4444"
                }
              />
              <Text
                className={cn(
                  "text-xs font-medium",
                  checkAvailability(new Date()).isOpen
                    ? "text-green-600"
                    : "text-red-600",
                )}
              >
                {checkAvailability(new Date()).isOpen ? "Open" : "Closed"}
              </Text>
              <Text className="text-xs text-muted-foreground">
                • {formatOperatingHours()}
              </Text>
            </View>
          )}

          <Text
            className={cn(
              "text-xs font-medium",
              restaurant.booking_policy === "instant"
                ? "text-green-600"
                : "text-orange-600",
            )}
          >
            {restaurant.booking_policy === "instant"
              ? "Instant Book"
              : "Request"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
