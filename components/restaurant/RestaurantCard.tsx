// components/restaurant/RestaurantCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Star, DollarSign, MapPin, Clock, Heart } from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { P, Muted, H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";

type BaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Support flexible restaurant types
type Restaurant = BaseRestaurant & {
  tags?: string[];
  // Add any additional fields that might be missing
  [key: string]: any;
};

interface RestaurantCardProps {
  restaurant?: Restaurant;
  item?: Restaurant; // Support both prop names for backward compatibility
  variant?: "default" | "compact" | "featured" | "horizontal";
  onPress?: (restaurantId: string) => void; // Made required string parameter
  onFavoritePress?: () => void;
  isFavorite?: boolean;
  className?: string;
  showFavorite?: boolean;
}

export function RestaurantCard({
  restaurant,
  item,
  variant = "default",
  onPress,
  onFavoritePress,
  isFavorite = false,
  className,
  showFavorite = true,
}: RestaurantCardProps) {
  const router = useRouter();

  // Support both restaurant and item props for backward compatibility
  const restaurantData = restaurant || item;

  if (!restaurantData || !restaurantData.id) {
    console.warn("Invalid restaurant data:", restaurantData);
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress(restaurantData.id);
    } else {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantData.id },
      });
    }
  };

  const renderStars = (rating: number) => (
    <View className="flex-row items-center gap-1">
      <Star
        size={variant === "compact" ? 12 : 14}
        color="#f59e0b"
        fill="#f59e0b"
      />
      <Text
        className={cn(
          "font-medium",
          variant === "compact" ? "text-xs" : "text-sm"
        )}
      >
        {rating?.toFixed(1) || "N/A"}
      </Text>
      {variant !== "compact" && (
        <Muted className="text-xs">({restaurantData.total_reviews || 0})</Muted>
      )}
    </View>
  );

  const renderPriceRange = (priceRange: number) => (
    <Text
      className={cn(
        "text-muted-foreground",
        variant === "compact" ? "text-xs" : "text-sm"
      )}
    >
      {"$".repeat(priceRange || 1)}
    </Text>
  );

  const renderTags = (tags: string[]) => {
    if (!tags || tags.length === 0) return null;
    const maxTags = variant === "compact" ? 2 : 3;

    return (
      <View className="flex-row flex-wrap gap-1 mt-2">
        {tags.slice(0, maxTags).map((tag) => (
          <View key={tag} className="bg-muted px-2 py-1 rounded-full">
            <Text className="text-xs">{tag}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card border border-border rounded-xl overflow-hidden shadow-sm mr-3 w-64",
          className
        )}
      >
        <Image
          source={{ uri: restaurantData.main_image_url }}
          className="w-full h-32"
          contentFit="cover"
        />
        <View className="p-3">
          <Text className="font-semibold text-sm mb-1" numberOfLines={1}>
            {restaurantData.name}
          </Text>
          <Text
            className="text-xs text-muted-foreground mb-2"
            numberOfLines={1}
          >
            {restaurantData.cuisine_type}
          </Text>
          <View className="flex-row items-center justify-between">
            {renderStars(restaurantData.average_rating)}
            {renderPriceRange(restaurantData.price_range)}
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === "featured") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm mr-4 w-72",
          className
        )}
      >
        <View className="relative">
          <Image
            source={{ uri: restaurantData.main_image_url }}
            className="w-full h-48"
            contentFit="cover"
          />
          {showFavorite && onFavoritePress && (
            <Pressable
              onPress={onFavoritePress}
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
          {restaurantData.featured && (
            <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded-full">
              <Text className="text-xs text-primary-foreground font-medium">
                Featured
              </Text>
            </View>
          )}
        </View>
        <View className="p-4">
          <H3 className="mb-1">{restaurantData.name}</H3>
          <P className="text-muted-foreground mb-2">
            {restaurantData.cuisine_type}
          </P>
          <View className="flex-row items-center justify-between">
            {renderStars(restaurantData.average_rating)}
            {renderPriceRange(restaurantData.price_range)}
          </View>
          {renderTags(restaurantData.tags)}
        </View>
      </Pressable>
    );
  }

  if (variant === "horizontal") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm",
          className
        )}
      >
        <View className="flex-row">
          <Image
            source={{ uri: restaurantData.main_image_url }}
            className="w-28 h-28"
            contentFit="cover"
          />
          <View className="flex-1 p-3">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="font-semibold text-base">
                  {restaurantData.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {restaurantData.cuisine_type} •{" "}
                  {renderPriceRange(restaurantData.price_range)}
                </Text>
              </View>
              {showFavorite && onFavoritePress && (
                <Pressable
                  onPress={onFavoritePress}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Heart
                    size={20}
                    color={isFavorite ? "#ef4444" : "#666"}
                    fill={isFavorite ? "#ef4444" : "transparent"}
                  />
                </Pressable>
              )}
            </View>

            <View className="flex-row items-center gap-3 mt-2">
              {restaurantData.average_rating > 0 &&
                renderStars(restaurantData.average_rating)}

              {restaurantData.address && (
                <View className="flex-row items-center gap-1 flex-1">
                  <MapPin size={14} color="#666" />
                  <Text
                    className="text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {restaurantData.address.split(",")[0]}
                  </Text>
                </View>
              )}
            </View>

            {restaurantData.booking_policy && (
              <Text
                className={cn(
                  "text-sm font-medium mt-2",
                  restaurantData.booking_policy === "instant"
                    ? "text-green-600"
                    : "text-orange-600"
                )}
              >
                {restaurantData.booking_policy === "instant"
                  ? "Instant Book"
                  : "Request to Book"}
              </Text>
            )}

            {renderTags(restaurantData.tags)}
          </View>
        </View>
      </Pressable>
    );
  }

  // Default variant - same as horizontal for backward compatibility
  return (
    <Pressable
      onPress={handlePress}
      className={cn("bg-card rounded-xl overflow-hidden shadow-sm", className)}
    >
      <View className="flex-row">
        <Image
          source={{ uri: restaurantData.main_image_url }}
          className="w-28 h-28"
          contentFit="cover"
        />
        <View className="flex-1 p-3">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="font-semibold text-base">
                {restaurantData.name}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {restaurantData.cuisine_type} •{" "}
                {"$".repeat(restaurantData.price_range)}
              </Text>
            </View>
            {showFavorite && onFavoritePress && (
              <Pressable
                onPress={onFavoritePress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Heart
                  size={20}
                  color={isFavorite ? "#ef4444" : "#666"}
                  fill={isFavorite ? "#ef4444" : "transparent"}
                />
              </Pressable>
            )}
          </View>

          <View className="flex-row items-center gap-3 mt-2">
            {restaurantData.average_rating > 0 && (
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm font-medium">
                  {restaurantData.average_rating.toFixed(1)}
                </Text>
                <Muted className="text-xs">
                  ({restaurantData.total_reviews})
                </Muted>
              </View>
            )}

            {restaurantData.address && (
              <View className="flex-row items-center gap-1 flex-1">
                <MapPin size={14} color="#666" />
                <Text
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {restaurantData.address.split(",")[0]}
                </Text>
              </View>
            )}
          </View>

          {restaurantData.booking_policy && (
            <Text
              className={cn(
                "text-sm font-medium mt-2",
                restaurantData.booking_policy === "instant"
                  ? "text-green-600"
                  : "text-orange-600"
              )}
            >
              {restaurantData.booking_policy === "instant"
                ? "Instant Book"
                : "Request to Book"}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
