// components/debug/LocationTestButton.tsx - Add this to your search header temporarily
import React, { useState } from "react";
import { Pressable, Alert } from "react-native";
import { Text } from "@/components/ui/text";
import { LocationService } from "@/lib/locationService";
import * as Location from "expo-location";

export function LocationTestButton() {
  const [testing, setTesting] = useState(false);

  const testLocationService = async () => {
    if (testing) return;

    setTesting(true);

    try {
      // Test 1: Check permissions

      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== "granted") {
        const { status: newStatus } =
          await Location.requestForegroundPermissionsAsync();
      }

      // Test 2: Get current position

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      // Test 3: Reverse geocode

      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      // Test 4: Use LocationService

      const locationData = await LocationService.getCurrentLocation();

      Alert.alert(
        "Location Test Results",
        `✅ Location: ${locationData.city}, ${locationData.district}\n` +
          `📍 Coordinates: ${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}\n` +
          `🔐 Permission: ${status}`,
      );
    } catch (error) {
      console.error("❌ Location test failed:", error);
      Alert.alert("Location Test Failed", error.message || "Unknown error");
    } finally {
      setTesting(false);
    }
  };

  if (!__DEV__) return null;

  return (
    <Pressable
      onPress={testLocationService}
      className={`bg-blue-500 px-3 py-1 rounded ${testing ? "opacity-50" : ""}`}
      disabled={testing}
    >
      <Text className="text-white text-xs font-bold">
        {testing ? "Testing..." : "🧪 Test Location"}
      </Text>
    </Pressable>
  );
}
