// components/debug/DebugPanel.tsx - Temporary debug component
import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService } from "@/lib/locationService";

interface DebugPanelProps {
  restaurants: any[];
  searchState: any;
}

export function DebugPanel({ restaurants, searchState }: DebugPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { location, loading, error } = useLocationWithDistance();

  if (!__DEV__) return null; // Only show in development

  const debugData = {
    location: {
      current: location,
      loading,
      error,
      displayName: LocationService.getLocationDisplayName(location),
    },
    restaurants: {
      total: restaurants.length,
      withCoordinates: restaurants.filter((r) => {
        const coords =
          r.coordinates ||
          (r.staticCoordinates
            ? {
                latitude: r.staticCoordinates.lat,
                longitude: r.staticCoordinates.lng,
              }
            : null) ||
          LocationService.extractCoordinates(r.location);
        return coords !== null;
      }).length,
      withDistance: restaurants.filter(
        (r) => r.distance !== null && r.distance !== undefined,
      ).length,
      sample: restaurants.slice(0, 3).map((r) => ({
        name: r.name,
        coordinates: r.coordinates,
        staticCoordinates: r.staticCoordinates,
        location: r.location,
        distance: r.distance,
        extractedCoords: LocationService.extractCoordinates(r.location),
      })),
    },
    searchState: {
      loading: searchState.loading,
      userLocation: searchState.userLocation,
      viewMode: searchState.viewMode,
      restaurantCount: searchState.restaurants?.length || 0,
    },
  };

  return (
    <View className="absolute top-20 right-4 z-50">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="bg-red-500 px-2 py-1 rounded"
      >
        <Text className="text-white text-xs font-bold">
          🐛 DEBUG {expanded ? "▼" : "▶"}
        </Text>
      </Pressable>

      {expanded && (
        <ScrollView className="bg-black/90 rounded-lg p-3 mt-2 max-h-96 w-80">
          <Text className="text-white text-xs font-bold mb-2">
            🗺️ LOCATION DEBUG
          </Text>
          <Text className="text-green-400 text-xs">
            Loading: {debugData.location.loading ? "YES" : "NO"}
          </Text>
          <Text className="text-green-400 text-xs">
            Error: {debugData.location.error || "None"}
          </Text>
          <Text className="text-green-400 text-xs">
            Display: {debugData.location.displayName}
          </Text>
          <Text className="text-green-400 text-xs mb-2">
            Coords:{" "}
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : "None"}
          </Text>

          <Text className="text-white text-xs font-bold mb-2">
            🍽️ RESTAURANTS DEBUG
          </Text>
          <Text className="text-blue-400 text-xs">
            Total: {debugData.restaurants.total}
          </Text>
          <Text className="text-blue-400 text-xs">
            With Coords: {debugData.restaurants.withCoordinates}
          </Text>
          <Text className="text-blue-400 text-xs mb-2">
            With Distance: {debugData.restaurants.withDistance}
          </Text>

          <Text className="text-white text-xs font-bold mb-1">
            📊 SAMPLE DATA
          </Text>
          {debugData.restaurants.sample.map((r, i) => (
            <View key={i} className="mb-2 p-1 bg-gray-800 rounded">
              <Text className="text-yellow-400 text-xs font-bold">
                {r.name}
              </Text>
              <Text className="text-gray-300 text-xs">
                Coords: {r.coordinates ? "✅" : "❌"}
              </Text>
              <Text className="text-gray-300 text-xs">
                Static: {r.staticCoordinates ? "✅" : "❌"}
              </Text>
              <Text className="text-gray-300 text-xs">
                Location: {r.location ? "✅" : "❌"}
              </Text>
              <Text className="text-gray-300 text-xs">
                Extracted: {r.extractedCoords ? "✅" : "❌"}
              </Text>
              <Text className="text-gray-300 text-xs">
                Distance: {r.distance ? `${r.distance.toFixed(2)}km` : "None"}
              </Text>
            </View>
          ))}

          <Text className="text-white text-xs font-bold mb-2">
            🔍 SEARCH STATE
          </Text>
          <Text className="text-purple-400 text-xs">
            Loading: {debugData.searchState.loading ? "YES" : "NO"}
          </Text>
          <Text className="text-purple-400 text-xs">
            View: {debugData.searchState.viewMode}
          </Text>
          <Text className="text-purple-400 text-xs">
            Count: {debugData.searchState.restaurantCount}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
