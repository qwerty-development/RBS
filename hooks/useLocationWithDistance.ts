// hooks/useLocationWithDistance.ts - Fixed with better debugging
import { useState, useEffect, useCallback } from "react";
import { LocationService, LocationData } from "@/lib/locationService";
import { EventEmitter } from "@/lib/eventEmitter";

// Create event emitter for location updates
const locationEventEmitter = new EventEmitter();

export function useLocationWithDistance() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async () => {
    console.log("🔄 useLocationWithDistance: Getting current location");
    try {
      setLoading(true);
      setError(null);
      
      const locationData = await LocationService.getCurrentLocation();
      console.log("✅ useLocationWithDistance: Got location data:", locationData);
      
      setLocation(locationData);
      // Emit location update event
      locationEventEmitter.emit("locationUpdated", locationData);
      
      console.log("📡 useLocationWithDistance: Emitted location update event");
    } catch (err) {
      const errorMessage = "Failed to get location";
      console.error("❌ useLocationWithDistance error:", err);
      setError(errorMessage);
      
      // Set default location as fallback
      const defaultLocation = {
        latitude: 33.8938,
        longitude: 35.5018,
        city: "Beirut",
        district: "Central District",
        country: "Lebanon",
      };
      
      console.log("🔄 useLocationWithDistance: Using default location as fallback");
      setLocation(defaultLocation);
      locationEventEmitter.emit("locationUpdated", defaultLocation);
    } finally {
      setLoading(false);
      console.log("✅ useLocationWithDistance: Loading complete");
    }
  }, []);

  const updateLocation = useCallback(async (newLocation: LocationData) => {
    console.log("💾 useLocationWithDistance: Updating location to:", newLocation);
    
    setLocation(newLocation);
    await LocationService.updateLocation(newLocation);
    
    // Emit location update event
    locationEventEmitter.emit("locationUpdated", newLocation);
    console.log("📡 useLocationWithDistance: Emitted location update for new location");
  }, []);

  const clearLocation = useCallback(async () => {
    console.log("🗑️ useLocationWithDistance: Clearing location");
    await LocationService.clearLocation();
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // Subscribe to location updates from other components
  useEffect(() => {
    const handleLocationUpdate = (newLocation: LocationData) => {
      console.log("📡 useLocationWithDistance: Received location update event:", newLocation);
      setLocation(newLocation);
    };

    locationEventEmitter.on("locationUpdated", handleLocationUpdate);

    return () => {
      console.log("🔄 useLocationWithDistance: Cleaning up event listener");
      locationEventEmitter.off("locationUpdated", handleLocationUpdate);
    };
  }, []);

  useEffect(() => {
    console.log("🚀 useLocationWithDistance: Initializing location service");
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Debug current state
  useEffect(() => {
    console.log("📊 useLocationWithDistance state:", {
      location,
      loading,
      error,
      displayName: LocationService.getLocationDisplayName(location)
    });
  }, [location, loading, error]);

  return {
    location,
    loading,
    error,
    refresh: getCurrentLocation,
    updateLocation,
    clearLocation,
    calculateDistance: LocationService.calculateDistance,
    formatDistance: LocationService.formatDistance,
    getDisplayName: () => LocationService.getLocationDisplayName(location),
  };
}