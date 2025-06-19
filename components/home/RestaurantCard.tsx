import React from "react";
import { View, Pressable } from "react-native";
import { Star } from "lucide-react-native";
import { H3, P } from "@/components/ui/typography";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";

interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  tags: string[];
  average_rating: number;
  total_reviews: number;
  address: string;
  price_range: number;
  booking_policy: "instant" | "request";
  created_at?: string;
  featured?: boolean;
}

interface RestaurantCardProps {
  item: Restaurant;
  variant?: "default" | "compact" | "featured";
  onPress: (restaurantId: string) => void;
}

export function RestaurantCard({
  item,
  variant = "default",
  onPress,
}: RestaurantCardProps) {
  if (!item || !item.id) {
    console.warn("Invalid restaurant item:", item);
    return null;
  }

  const handlePress = () => {
    onPress(item.id);
  };

  if (variant === "compact") {
    return (
      <Pressable onPress={handlePress} className="mr-3 w-64">
        <View className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <Image
            source={{ uri: item.main_image_url }}
            className="w-full h-32"
            contentFit="cover"
          />
          <View className="p-3">
            <Text className="font-semibold text-sm mb-1" numberOfLines={1}>
              {item.name}
            </Text>
            <Text
              className="text-xs text-muted-foreground mb-2"
              numberOfLines={1}
            >
              {item.cuisine_type}
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-xs font-medium">
                  {item.average_rating?.toFixed(1) || "N/A"}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {"$".repeat(item.price_range || 1)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} className="mr-4 w-72">
      <View className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <Image
          source={{ uri: item.main_image_url }}
          className="w-full h-48"
          contentFit="cover"
        />
        {variant === "featured" && (
          <View className="absolute top-3 left-3 bg-primary px-2 py-1 rounded-full">
            <Text className="text-xs text-primary-foreground font-medium">
              Featured
            </Text>
          </View>
        )}
        <View className="p-4">
          <H3 className="mb-1">{item.name}</H3>
          <P className="text-muted-foreground mb-2">{item.cuisine_type}</P>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="font-medium">
                {item.average_rating?.toFixed(1) || "N/A"}
              </Text>
              <Text className="text-muted-foreground">
                ({item.total_reviews || 0})
              </Text>
            </View>
            <Text className="text-muted-foreground">
              {"$".repeat(item.price_range || 1)}
            </Text>
          </View>
          {item.tags && item.tags.length > 0 && (
            <View className="flex-row gap-2 mt-2">
              {item.tags.slice(0, 2).map((tag) => (
                <View key={tag} className="bg-muted px-2 py-1 rounded-full">
                  <Text className="text-xs">{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
