// components/restaurant/DirectionsButton.tsx
import React, { useCallback } from "react";
import { Pressable, Platform, Linking, Alert } from "react-native";
import { Navigation } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { Database } from "@/types/supabase";

type Restaurant = {
  id: string;
  name: string;
  staticCoordinates?: { lat: number; lng: number };
  coordinates?: { latitude: number; longitude: number };
  [key: string]: any;
};

interface DirectionsButtonProps {
  restaurant: Restaurant;
  onDirections?: (restaurant: Restaurant) => void;
  variant?: "icon" | "button" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function DirectionsButton({
  restaurant,
  onDirections,
  variant = "icon",
  size = "md",
  className,
  showText = false,
}: DirectionsButtonProps) {
  // Directions handler - follows the same pattern as search functionality
  const handleDirections = useCallback(async () => {
    if (onDirections) {
      // Use the provided onDirections handler if available
      onDirections(restaurant);
      return;
    }

    // Default directions implementation using processed coordinates
    const r: any = restaurant;
    const coords = r.staticCoordinates || 
      (r.coordinates ? {
        lat: r.coordinates.latitude,
        lng: r.coordinates.longitude,
      } : {
        lat: 33.8938, // Default Beirut coordinates
        lng: 35.5018,
      });

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.lat},${coords.lng}`;
    const label = encodeURIComponent(restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error("Error opening maps:", error);
        Alert.alert("Error", "Unable to open maps application");
      }
    }
  }, [restaurant, onDirections]);

  const getIconSize = () => {
    switch (size) {
      case "sm": return 16;
      case "lg": return 24;
      default: return 20;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm": return "text-xs";
      case "lg": return "text-base";
      default: return "text-sm";
    }
  };

  if (variant === "icon") {
    return (
      <Pressable
        onPress={(e) => {
          e.stopPropagation(); // Prevent card press
          handleDirections();
        }}
        className={cn(
          "bg-black/50 rounded-full p-2",
          className,
        )}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Navigation size={getIconSize()} color="white" />
      </Pressable>
    );
  }

  if (variant === "button") {
    return (
      <Pressable
        onPress={handleDirections}
        className={cn(
          "flex-row items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full",
          className,
        )}
      >
        <Navigation size={getIconSize()} color="#3b82f6" />
        <Text className={cn("text-primary font-medium", getTextSize())}>
          Directions
        </Text>
      </Pressable>
    );
  }

  if (variant === "text") {
    return (
      <Pressable
        onPress={handleDirections}
        className={cn(
          "flex-row items-center gap-1",
          className,
        )}
      >
        <Navigation size={getIconSize()} color="#666" />
        {showText && (
          <Text className={cn("text-muted-foreground", getTextSize())}>
            Directions
          </Text>
        )}
      </Pressable>
    );
  }

  return null;
} 