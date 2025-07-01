import React from "react";
import { View, Pressable, Alert, Platform, Linking } from "react-native";
import { Navigation, MapPin } from "lucide-react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface BookingMapSectionProps {
  restaurant: {
    name: string;
    address: string;
    location: any;
  };
}

export const BookingMapSection: React.FC<BookingMapSectionProps> = ({
  restaurant,
}) => {
  // Extract coordinates from PostGIS geography type
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

  const openDirections = async () => {
    const coords = extractLocationCoordinates(restaurant.location);
    if (!coords) {
      Alert.alert("Error", "Location data not available");
      return;
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });

    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        Alert.alert("Error", "Unable to open maps");
      }
    }
  };

  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Location</H3>
      <Pressable
        onPress={openDirections}
        className="bg-card rounded-lg overflow-hidden border border-border"
      >
        <MapView
          style={{ height: 200 }}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: mapCoordinates.latitude,
            longitude: mapCoordinates.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker
            coordinate={mapCoordinates}
            title={restaurant.name}
            description={restaurant.address}
          />
        </MapView>
        <View className="p-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-medium">{restaurant.address}</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Tap for directions
            </Text>
          </View>
          <Navigation size={20} color="#3b82f6" />
        </View>
      </Pressable>
    </View>
  );
};
