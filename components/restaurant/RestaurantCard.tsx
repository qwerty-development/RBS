// components/restaurant/RestaurantCard.tsx
import React, { useState, useMemo, useCallback } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Star, Heart, FolderPlus, Award, MapPin } from "lucide-react-native";
import { format } from "date-fns";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { AddToPlaylistModal } from "@/components/playlists/AddToPlaylistModal"; // Assuming this path is correct
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { useRestaurantOpenHours } from "@/hooks/useRestaurantOpenHours";
import { useRestaurantLoyalty } from "@/hooks/useRestaurantLoyalty";
import {
  useRestaurantPress,
  useQuickActionPress,
} from "@/hooks/useHapticPress";
import { useNavigationModal } from "@/context/modal-provider";

type BaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Support flexible restaurant types
type Restaurant = BaseRestaurant & {
  tags?: string[] | null;
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

function RestaurantCardComponent({
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

  // Haptic press hooks
  const { handlePress: handleRestaurantPress } = useRestaurantPress();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Modal state management
  const { openNavigationModal, isAnyModalOpen } = useNavigationModal();

  // Support both restaurant and item props for backward compatibility
  const restaurantData = restaurant || item;

  // Use the new open hours hook
  const { checkAvailability, loading: availabilityLoading } =
    useRestaurantOpenHours(restaurantData?.id || "");

  // Use the loyalty hook to check if restaurant has loyalty program
  const { hasLoyaltyProgram, balance } = useRestaurantLoyalty(
    restaurantData?.id,
  );

  // Memoize current date and time to prevent recreation on every render
  const currentDateTime = useMemo(
    () => ({
      date: new Date(),
      time: format(new Date(), "HH:mm"),
    }),
    [],
  );

  // Memoize availability status
  const isOpen = useMemo(() => {
    if (!showAvailability || availabilityLoading) return true;
    return checkAvailability(currentDateTime.date, currentDateTime.time).isOpen;
  }, [
    showAvailability,
    availabilityLoading,
    checkAvailability,
    currentDateTime,
  ]);

  if (!restaurantData || !restaurantData.id) {
    console.warn("Invalid restaurant data:", restaurantData);
    return null;
  }

  const handlePress = () => {
    handleRestaurantPress(() => {
      // Check if any modal is already open
      if (isAnyModalOpen) {
        return;
      }

      // Use navigation modal to prevent multiple modals
      openNavigationModal(`restaurant-${restaurantData.id}`, () => {
        if (onPress) {
          onPress(restaurantData.id);
        } else {
          router.push({
            pathname: "/restaurant/[id]",
            params: { id: restaurantData.id },
          });
        }
      });
    });
  };

  const handleAddToPlaylistPress = () => {
    handleQuickActionPress(() => {
      setPlaylistModalVisible(true);
    });
  };

  const handlePlaylistSuccess = (playlistName: string) => {
    // You can add a Toast notification here for better UX

    setPlaylistModalVisible(false);
  };

  const renderStars = (rating: number) => {
    return (
      <View className="flex-row items-center gap-1.5">
        <View className="flex-row items-center gap-0.5">
          <Star
            size={variant === "compact" ? 12 : 14}
            color="#F2B25F"
            fill="#F2B25F"
          />
          <Text
            className={cn(
              "font-semibold",
              variant === "compact" ? "text-xs" : "text-sm",
            )}
          >
            {rating && rating > 0 ? rating.toFixed(1) : "-"}
          </Text>
        </View>
      </View>
    );
  };

  const renderPriceRange = (priceRange?: number | null) => {
    if (!priceRange) return null; // Don't show anything if no price range data

    return (
      <View className="bg-muted px-2 py-1 rounded-full">
        <Text
          className={cn(
            "text-muted-foreground font-medium",
            variant === "compact" ? "text-xs" : "text-sm",
          )}
        >
          {"$".repeat(priceRange)}
        </Text>
      </View>
    );
  };

  // Render status dot (green for open, red for closed) - Memoized
  const renderStatusDot = useCallback(() => {
    if (!showAvailability || availabilityLoading) return null;

    return (
      <View
        className={cn(
          "w-2 h-2 rounded-full",
          isOpen ? "bg-green-500" : "bg-red-500",
        )}
      />
    );
  }, [showAvailability, availabilityLoading, isOpen]);

  // Remove graying out effect - always show full opacity
  const getCardOpacity = () => {
    return "opacity-100";
  };

  // Render loyalty indicator
  const renderLoyaltyIndicator = () => {
    if (!showLoyalty || !hasLoyaltyProgram) return null;

    // Check if restaurant has enough loyalty points left
    const hasPointsAvailable = balance && balance.current_balance > 0;

    if (!hasPointsAvailable) return null;

    return <Award size={14} color="#F2B25F" fill="#F2B25F" />;
  };

  // Using a Fragment to wrap the card and the modal
  return (
    <>
      {variant === "compact" && (
        <Pressable onPress={handlePress}>
          <Card
            variant="subtle"
            noPadding={true}
            style={{
              marginRight: 12,
              width: 240,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 10,
              backgroundColor: "white",
            }}
            className={cn(getCardOpacity(), "shadow-sm", className)}
          >
            <View className="relative">
              <Image
                source={{
                  uri:
                    restaurantData.main_image_url ||
                    "@/assets/default-avatar.jpeg",
                }}
                className="w-full h-32"
                contentFit="cover"
              />
              {/* Favorite button overlay */}
              {showFavorite && onFavoritePress && (
                <Pressable
                  onPress={() =>
                    handleQuickActionPress(() => onFavoritePress())
                  }
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Heart
                    size={16}
                    color={isFavorite ? "#ef4444" : "white"}
                    fill={isFavorite ? "#ef4444" : "transparent"}
                  />
                </Pressable>
              )}
            </View>

            <View className="p-3">
              {/* Name and Cuisine in a row */}
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <Text
                    className="font-bold text-base flex-1"
                    numberOfLines={1}
                  >
                    {restaurantData.name}
                  </Text>
                  {renderStatusDot()}
                </View>
                <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                  <Text
                    className="text-xs font-medium text-primary"
                    numberOfLines={1}
                  >
                    {restaurantData.cuisine_type}
                  </Text>
                </View>
              </View>

              {/* Rating and Price */}
              <View className="flex-row items-center justify-between mb-2">
                {renderStars(restaurantData.average_rating || 0)}
                <View className="flex-row items-center gap-2">
                  {renderLoyaltyIndicator()}
                  {renderPriceRange(restaurantData.price_range)}
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      )}

      {variant === "featured" && (
        <Pressable onPress={handlePress}>
          <Card
            variant="elevated"
            noPadding={true}
            style={{
              marginRight: 16,
              width: 288,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 15,
              backgroundColor: "white",
            }}
            className={cn(getCardOpacity(), "shadow-md", className)}
          >
            <View className="relative">
              <Image
                source={{
                  uri:
                    restaurantData.main_image_url ||
                    "@/assets/default-avatar.jpeg",
                }}
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
                    onPress={() =>
                      handleQuickActionPress(() => onFavoritePress())
                    }
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
              {/* Name and Cuisine in a row */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2 flex-1 mr-3">
                  <Text className="font-bold text-lg flex-1" numberOfLines={1}>
                    {restaurantData.name}
                  </Text>
                  {renderStatusDot()}
                </View>
                <View className="bg-primary/10 px-3 py-1.5 rounded-full">
                  <Text
                    className="text-sm font-medium text-primary"
                    numberOfLines={1}
                  >
                    {restaurantData.cuisine_type}
                  </Text>
                </View>
              </View>

              {/* Rating and Price */}
              <View className="flex-row items-center justify-between mb-3">
                {renderStars(restaurantData.average_rating || 0)}
                <View className="flex-row items-center gap-2">
                  {renderLoyaltyIndicator()}
                  {renderPriceRange(restaurantData.price_range)}
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      )}

      {(variant === "horizontal" || variant === "default") && (
        <Pressable onPress={handlePress}>
          <Card
            variant="default"
            noPadding={true}
            style={{
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.28,
              shadowRadius: 7,
              elevation: 8,
              backgroundColor: "white",
            }}
            className={cn(getCardOpacity(), "shadow-sm", className)}
          >
            <View className="flex-row">
              <View className="relative">
                <Image
                  source={{
                    uri:
                      restaurantData.main_image_url ||
                      "@/assets/default-avatar.jpeg",
                  }}
                  className="w-32 h-32 rounded-l-lg"
                  contentFit="cover"
                />
                {/* Favorite button overlay */}
                {showFavorite && onFavoritePress && (
                  <Pressable
                    onPress={() =>
                      handleQuickActionPress(() => onFavoritePress())
                    }
                    className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Heart
                      size={14}
                      color={isFavorite ? "#ef4444" : "white"}
                      fill={isFavorite ? "#ef4444" : "transparent"}
                    />
                  </Pressable>
                )}
              </View>

              <View className="flex-1 p-3">
                {/* Name and Cuisine */}
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    <Text
                      className="font-bold text-base flex-1"
                      numberOfLines={1}
                    >
                      {restaurantData.name}
                    </Text>
                    {renderStatusDot()}
                  </View>
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                    <Text
                      className="text-xs font-medium text-primary"
                      numberOfLines={1}
                    >
                      {restaurantData.cuisine_type}
                    </Text>
                  </View>
                </View>

                {/* Rating and Price */}
                <View className="flex-row items-center justify-between mb-2">
                  {renderStars(restaurantData.average_rating || 0)}
                  <View className="flex-row items-center gap-2">
                    {renderLoyaltyIndicator()}
                    {renderPriceRange(restaurantData.price_range)}
                  </View>
                </View>
              </View>
            </View>
          </Card>
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

// Export memoized component for better performance
export const RestaurantCard = React.memo(RestaurantCardComponent);
