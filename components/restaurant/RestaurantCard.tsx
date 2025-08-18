// components/restaurant/RestaurantCard.tsx
import React, { useState, useCallback } from "react";
import { View, Pressable, Platform, Linking, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  Star,
  DollarSign,
  MapPin,
  Heart,
  FolderPlus,
  Award,
  Clock,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { P, Muted, H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { AddToPlaylistModal } from "@/components/playlists/AddToPlaylistModal"; // Assuming this path is correct
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";
import { useRestaurantLoyalty } from "@/hooks/useRestaurantLoyalty";

type BaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Support flexible restaurant types
type Restaurant = BaseRestaurant & {
  tags?: string[];
  staticCoordinates?: { lat: number; lng: number };
  coordinates?: { latitude: number; longitude: number };
  // Add any additional fields that might be missing
  [key: string]: any;
};

interface RestaurantCardProps {
  restaurant?: Restaurant;
  item?: Restaurant; // Support both prop names for backward compatibility
  variant?: "default" | "compact" | "featured" | "horizontal";
  onPress?: (restaurantId: string) => void;
  onFavoritePress?: () => void;
  onDirections?: (restaurant: Restaurant) => void; // New prop for directions
  isFavorite?: boolean;
  className?: string;
  showFavorite?: boolean;
  showAddToPlaylistButton?: boolean; // New prop for playlist feature
  showDirections?: boolean; // New prop to control directions button visibility
  showAvailability?: boolean; // New prop to show/hide availability status
  showLoyalty?: boolean; // New prop to show/hide loyalty indicator
}

export function RestaurantCard({
  restaurant,
  item,
  variant = "default",
  onPress,
  onFavoritePress,
  onDirections,
  isFavorite = false,
  className,
  showFavorite = true,
  showAddToPlaylistButton = true, // Default to true
  showDirections = false, // Default to false
  showAvailability = true, // Default to true
  showLoyalty = true, // Default to true
}: RestaurantCardProps) {
  const router = useRouter();
  const [isPlaylistModalVisible, setPlaylistModalVisible] = useState(false);

  // Support both restaurant and item props for backward compatibility
  const restaurantData = restaurant || item;

  // Use the availability hook
  const { checkAvailability, loading: availabilityLoading } =
    useRestaurantAvailability(restaurantData?.id || "");

  // Use the loyalty hook to check if restaurant has loyalty program
  const { hasLoyaltyProgram, balance } = useRestaurantLoyalty(
    restaurantData?.id,
  );

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

  const handleAddToPlaylistPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaylistModalVisible(true);
  };

  const handlePlaylistSuccess = (playlistName: string) => {
    // You can add a Toast notification here for better UX
    console.log(`Added ${restaurantData.name} to ${playlistName}`);
    setPlaylistModalVisible(false);
  };

  const renderStars = (rating: number) => (
    <View className="flex-row items-center gap-1">
      <Star
        size={variant === "compact" ? 12 : 14}
        color="#F2B25F"
        fill="#F2B25F"
      />
      <Text
        className={cn(
          "font-medium",
          variant === "compact" ? "text-xs" : "text-sm",
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
        variant === "compact" ? "text-xs" : "text-sm",
      )}
    >
      {"$".repeat(priceRange || 1)}
    </Text>
  );

  // Render availability status (without hours)
  const renderAvailabilityStatus = () => {
    if (!showAvailability || availabilityLoading) return null;

    const today = new Date();
    const availability = checkAvailability(today);

    return (
      <View className="flex-row items-center gap-1 mt-1">
        <Clock size={12} color={availability.isOpen ? "#F2B25F" : "#792339"} />
        <Text
          className={cn(
            "text-xs font-medium",
            availability.isOpen ? "text-primary" : "text-foreground",
          )}
        >
          {availability.isOpen ? "Open" : "Closed"}
        </Text>
      </View>
    );
  };

  // Render loyalty indicator
  const renderLoyaltyIndicator = () => {
    if (!showLoyalty || !hasLoyaltyProgram) return null;

    // Check if restaurant has enough loyalty points left
    const hasPointsAvailable = balance && balance.current_balance > 0;

    if (!hasPointsAvailable) return null;

    return (
      <View className="flex-row items-center gap-1 mt-1">
        <Award size={14} color="#f59e0b" fill="#f59e0b" />
        <Text className="text-xs font-medium text-amber-600">
          Loyalty Points Available
        </Text>
      </View>
    );
  };

  // Using a Fragment to wrap the card and the modal
  return (
    <>
      {variant === "compact" && (
        <Pressable
          onPress={handlePress}
          className={cn(
            "bg-card border-2 border-border rounded-xl overflow-hidden shadow-sm mr-3 w-64",
            className,
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
            {renderAvailabilityStatus()}
            {renderLoyaltyIndicator()}
          </View>
        </Pressable>
      )}

      {variant === "featured" && (
        <Pressable
          onPress={handlePress}
          className={cn(
            "bg-card border-2 border-border rounded-xl overflow-hidden shadow-sm mr-4 w-72",
            className,
          )}
        >
          <View className="relative">
            <Image
              source={{ uri: restaurantData.main_image_url }}
              className="w-full h-48"
              contentFit="cover"
            />
            {/* Action Buttons */}
            <View className="absolute top-3 right-3 flex-row gap-2">
              {showDirections && (
                <DirectionsButton
                  restaurant={restaurantData}
                  onDirections={onDirections}
                  variant="icon"
                  size="md"
                  backgroundColor="bg-black/50"
                  iconColor="white"
                />
              )}
              {showAddToPlaylistButton && (
                <Pressable
                  onPress={handleAddToPlaylistPress}
                  className="bg-black/50 rounded-full p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FolderPlus size={20} color="white" />
                </Pressable>
              )}
              {showFavorite && onFavoritePress && (
                <Pressable
                  onPress={onFavoritePress}
                  className="bg-black/50 rounded-full p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Heart
                    size={20}
                    color={isFavorite ? "#ef4444" : "white"}
                    fill={isFavorite ? "#ef4444" : "transparent"}
                  />
                </Pressable>
              )}
            </View>

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
            {renderAvailabilityStatus()}
            {renderLoyaltyIndicator()}
          </View>
        </Pressable>
      )}

      {(variant === "horizontal" || variant === "default") && (
        <Pressable
          onPress={handlePress}
          className={cn(
            "bg-card border-2 border-border rounded-xl overflow-hidden shadow-sm",
            className,
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
                <View className="flex-1 pr-2">
                  <Text className="font-semibold text-base">
                    {restaurantData.name}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {restaurantData.cuisine_type} •{" "}
                    {renderPriceRange(restaurantData.price_range)}
                  </Text>
                </View>
                {/* Action Buttons */}
                <View className="flex-row items-center gap-2">
                  {showDirections && (
                    <DirectionsButton
                      restaurant={restaurantData}
                      onDirections={onDirections}
                      variant="text"
                      size="md"
                    />
                  )}
                  {showAddToPlaylistButton && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent card press
                        handleAddToPlaylistPress();
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FolderPlus size={20} color="#666" />
                    </Pressable>
                  )}
                  {showFavorite && onFavoritePress && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent card press
                        onFavoritePress();
                      }}
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
              </View>

              <View className="flex-row items-center gap-3 mt-2">
                {restaurantData.average_rating > 0 &&
                  renderStars(restaurantData.average_rating)}

                {restaurantData.address && (
                  <View className="flex-row items-center gap-1 flex-1">
                    <MapPin size={14} color="#787878" />
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
                      ? "text-primary"
                      : "text-accent",
                  )}
                >
                  {restaurantData.booking_policy === "instant"
                    ? "Instant Book"
                    : "Request to Book"}
                </Text>
              )}

              {renderAvailabilityStatus()}
              {renderLoyaltyIndicator()}
            </View>
          </View>
        </Pressable>
      )}

      {/* Add to Playlist Modal (rendered outside the card pressable) */}
      <AddToPlaylistModal
        visible={isPlaylistModalVisible}
        restaurantId={restaurantData.id}
        restaurantName={restaurantData.name}
        onClose={() => setPlaylistModalVisible(false)}
        onSuccess={handlePlaylistSuccess}
      />
    </>
  );
}
