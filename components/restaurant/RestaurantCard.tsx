// components/restaurant/RestaurantCard.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Star, DollarSign, MapPin, Clock, Heart } from "lucide-react-native";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { P, Muted } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface RestaurantCardProps {
  restaurant: Restaurant;
  variant?: "default" | "compact" | "featured";
  onPress?: () => void;
  onFavoritePress?: () => void;
  isFavorite?: boolean;
  className?: string;
}

export function RestaurantCard({
  restaurant,
  variant = "default",
  onPress,
  onFavoritePress,
  isFavorite = false,
  className,
}: RestaurantCardProps) {
  const router = useRouter();

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

  if (variant === "compact") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn("bg-card rounded-lg overflow-hidden", className)}
      >
        <View className="flex-row p-3">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-16 h-16 rounded-lg"
            contentFit="cover"
          />
          <View className="flex-1 ml-3">
            <Text className="font-semibold" numberOfLines={1}>
              {restaurant.name}
            </Text>
            <Muted className="text-sm" numberOfLines={1}>
              {restaurant.cuisine_type} • {"$".repeat(restaurant.price_range)}
            </Muted>
            <View className="flex-row items-center gap-2 mt-1">
              <View className="flex-row items-center gap-1">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs">{restaurant.average_rating.toFixed(1)}</Text>
              </View>
              <Muted className="text-xs">
                {restaurant.booking_policy === "instant" ? "Instant Book" : "Request"}
              </Muted>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === "featured") {
    return (
      <Pressable
        onPress={handlePress}
        className={cn("bg-card rounded-xl overflow-hidden shadow-sm", className)}
      >
        <View className="relative">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-full h-48"
            contentFit="cover"
          />
          {onFavoritePress && (
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
          {restaurant.featured && (
            <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded">
              <Text className="text-xs text-primary-foreground font-medium">
                Featured
              </Text>
            </View>
          )}
        </View>
        <View className="p-4">
          <Text className="font-semibold text-lg mb-1">{restaurant.name}</Text>
          <P className="text-muted-foreground mb-2">{restaurant.cuisine_type}</P>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
                <Text className="font-medium">{restaurant.average_rating.toFixed(1)}</Text>
                <Muted className="text-sm">({restaurant.total_reviews})</Muted>
              </View>
              <Text className="text-muted-foreground">
                {"$".repeat(restaurant.price_range)}
              </Text>
            </View>
            <Text className={cn(
              "text-sm font-medium",
              restaurant.booking_policy === "instant" ? "text-green-600" : "text-orange-600"
            )}>
              {restaurant.booking_policy === "instant" ? "Instant" : "Request"}
            </Text>
          </View>
          {restaurant.tags && restaurant.tags.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-2">
              {restaurant.tags.slice(0, 3).map((tag) => (
                <View key={tag} className="bg-muted px-2 py-1 rounded-full">
                  <Text className="text-xs">{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // Default variant
  return (
    <Pressable
      onPress={handlePress}
      className={cn("bg-card rounded-xl overflow-hidden shadow-sm", className)}
    >
      <View className="flex-row">
        <Image
          source={{ uri: restaurant.main_image_url }}
          className="w-28 h-28"
          contentFit="cover"
        />
        <View className="flex-1 p-3">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="font-semibold text-base">{restaurant.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {restaurant.cuisine_type} • {"$".repeat(restaurant.price_range)}
              </Text>
            </View>
            {onFavoritePress && (
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
            {restaurant.average_rating > 0 && (
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm font-medium">
                  {restaurant.average_rating.toFixed(1)}
                </Text>
                <Muted className="text-xs">({restaurant.total_reviews})</Muted>
              </View>
            )}
            
            {restaurant.address && (
              <View className="flex-row items-center gap-1 flex-1">
                <MapPin size={14} color="#666" />
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {restaurant.address.split(",")[0]}
                </Text>
              </View>
            )}
          </View>
          
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                {restaurant.opening_time} - {restaurant.closing_time}
              </Text>
            </View>
            
            <Text className={cn(
              "text-xs font-medium",
              restaurant.booking_policy === "instant" ? "text-green-600" : "text-orange-600"
            )}>
              {restaurant.booking_policy === "instant" ? "Instant Book" : "Request"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
