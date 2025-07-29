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
  location?: any;
  [key: string]: any;
} | any;

interface DirectionsButtonProps {
  restaurant: Restaurant;
  onDirections?: (restaurant: Restaurant) => void;
  variant?: "icon" | "button" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
  // Custom styling props
  iconColor?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  // Custom button styling
  buttonVariant?: "default" | "outline" | "ghost" | "destructive";
  // Custom icon styling
  iconClassName?: string;
  textClassName?: string;
}

export function DirectionsButton({
  restaurant,
  onDirections,
  variant = "icon",
  size = "md",
  className,
  showText = false,
  // Custom styling props
  iconColor,
  textColor,
  backgroundColor,
  borderColor,
  buttonVariant = "default",
  iconClassName,
  textClassName,
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
    let coords = r.staticCoordinates || 
      (r.coordinates ? {
        lat: r.coordinates.latitude,
        lng: r.coordinates.longitude,
      } : null);

    // If no processed coordinates, try to extract from location
    if (!coords && r.location) {
      const extractedCoords = extractLocationCoordinates(r.location);
      if (extractedCoords) {
        coords = {
          lat: extractedCoords.latitude,
          lng: extractedCoords.longitude,
        };
      }
    }

    // Fallback to default coordinates
    if (!coords) {
      coords = {
        lat: 33.8938, // Default Beirut coordinates
        lng: 35.5018,
      };
    }

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

  // Helper function to extract coordinates from PostGIS location
  const extractLocationCoordinates = (location: any) => {
    if (!location) return null;

    if (typeof location === "string" && location.startsWith("POINT(")) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(" ").map(Number);
        return { latitude: lat, longitude: lng };
      }
    }

    if (location.type === "Point" && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }

    if (location.lat && location.lng) {
      return { latitude: location.lat, longitude: location.lng };
    }

    if (location.latitude && location.longitude) {
      return { latitude: location.latitude, longitude: location.longitude };
    }

    return null;
  };

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
    const defaultIconColor = iconColor || "white";
    const defaultBgColor = backgroundColor || "bg-black/50";
    
    return (
      <Pressable
        onPress={(e) => {
          e.stopPropagation(); // Prevent card press
          handleDirections();
        }}
        className={cn(
          "rounded-full p-2",
          defaultBgColor,
          className,
        )}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Navigation 
          size={getIconSize()} 
          color={defaultIconColor}
          className={iconClassName}
        />
      </Pressable>
    );
  }

  if (variant === "button") {
    const defaultIconColor = iconColor || "#3b82f6";
    const defaultTextColor = textColor || "text-primary";
    const defaultBgColor = backgroundColor || "bg-primary/10";
    
    return (
      <Pressable
        onPress={handleDirections}
        className={cn(
          "flex-row items-center gap-1 px-3 py-1.5 rounded-full",
          defaultBgColor,
          borderColor && `border ${borderColor}`,
          className,
        )}
      >
        <Navigation 
          size={getIconSize()} 
          color={defaultIconColor}
          className={iconClassName}
        />
        <Text className={cn(
          "font-medium", 
          getTextSize(),
          defaultTextColor,
          textClassName
        )}>
          Directions
        </Text>
      </Pressable>
    );
  }

  if (variant === "text") {
    const defaultIconColor = iconColor || "#666";
    const defaultTextColor = textColor || "text-muted-foreground";
    
    return (
      <Pressable
        onPress={handleDirections}
        className={cn(
          "flex-row items-center gap-1",
          className,
        )}
      >
        <Navigation 
          size={getIconSize()} 
          color={defaultIconColor}
          className={iconClassName}
        />
        {showText && (
          <Text className={cn(
            getTextSize(),
            defaultTextColor,
            textClassName
          )}>
            Directions
          </Text>
        )}
      </Pressable>
    );
  }

  return null;
} 