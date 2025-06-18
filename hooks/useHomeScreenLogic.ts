import { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";

// Type definitions
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

interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  restaurant: Restaurant;
  valid_until: string;
}

interface LocationData {
  latitude?: number;
  longitude?: number;
  city: string;
  district: string;
}

interface QuickFilter {
  id: string;
  label: string;
  icon: any;
  color: string;
  params: Record<string, string>;
}

export function useHomeScreenLogic() {
  const { profile } = useAuth();
  const router = useRouter();

  // Core data states
  const [featuredRestaurants, setFeaturedRestaurants] = useState<Restaurant[]>(
    []
  );
  const [newRestaurants, setNewRestaurants] = useState<Restaurant[]>([]);
  const [topRatedRestaurants, setTopRatedRestaurants] = useState<Restaurant[]>(
    []
  );
  const [trendingRestaurants, setTrendingRestaurants] = useState<Restaurant[]>(
    []
  );
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);

  // UI state management
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locationPermissionDenied, setLocationPermissionDenied] =
    useState(false);

  // Performance optimization refs
  const hasInitialLoad = useRef(false);

  // Helper function to get cuisine display name
  const getCuisineName = useCallback((cuisineId: string): string => {
    const cuisineNames: Record<string, string> = {
      'lebanese': 'Lebanese',
      'italian': 'Italian',
      'japanese': 'Japanese',
      'sushi': 'Sushi',
      'indian': 'Indian',
      'mexican': 'Mexican',
      'chinese': 'Chinese',
      'french': 'French',
      'american': 'American',
      'mediterranean': 'Mediterranean',
      'thai': 'Thai',
      'greek': 'Greek',
      'turkish': 'Turkish',
      'korean': 'Korean',
      'vietnamese': 'Vietnamese',
      'spanish': 'Spanish',
      'brazilian': 'Brazilian',
      'moroccan': 'Moroccan',
      'persian': 'Persian',
      'armenian': 'Armenian',
    };
    
    return cuisineNames[cuisineId.toLowerCase()] || 
           cuisineId.charAt(0).toUpperCase() + cuisineId.slice(1);
  }, []);

  // Location Management
  const loadLocation = useCallback(async () => {
    try {
      const savedLocation = await AsyncStorage.getItem("@selected_location");

      if (savedLocation) {
        const parsedLocation = JSON.parse(savedLocation);
        console.log("Using saved location:", parsedLocation);
        setLocation(parsedLocation);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationPermissionDenied(true);
        const defaultLocation = {
          city: "Beirut",
          district: "Central District",
        };
        setLocation(defaultLocation);
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [address] = await Location.reverseGeocodeAsync({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });

      const gpsLocation = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        city: address.city || "Beirut",
        district: address.district || address.subregion || "Central District",
      };

      console.log("Using GPS location:", gpsLocation);
      setLocation(gpsLocation);
    } catch (error) {
      console.error("Location error:", error);
      const fallbackLocation = {
        city: "Beirut",
        district: "Central District",
      };
      setLocation(fallbackLocation);
    }
  }, []);

  const checkForLocationUpdates = useCallback(async () => {
    try {
      const savedLocation = await AsyncStorage.getItem("@selected_location");
      if (savedLocation) {
        const parsedLocation = JSON.parse(savedLocation);

        if (
          !location ||
          location.city !== parsedLocation.city ||
          location.district !== parsedLocation.district
        ) {
          console.log("Location updated:", parsedLocation);
          setLocation(parsedLocation);
        }
      }
    } catch (error) {
      console.error("Error checking for location updates:", error);
    }
  }, [location]);

  // Data Fetching Functions
  const fetchFeaturedRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("featured", true)
        .gte("average_rating", 4.0)
        .order("average_rating", { ascending: false })
        .limit(8);

      if (error) throw error;
      setFeaturedRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching featured restaurants:", error);
    }
  }, []);

  const fetchNewRestaurants = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      setNewRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching new restaurants:", error);
    }
  }, []);

  const fetchTopRatedRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .gte("average_rating", 4.5)
        .gte("total_reviews", 10)
        .order("average_rating", { ascending: false })
        .order("total_reviews", { ascending: false })
        .limit(6);

      if (error) throw error;
      setTopRatedRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching top rated restaurants:", error);
    }
  }, []);

  const fetchTrendingRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .gte("average_rating", 4.0)
        .gte("total_reviews", 5)
        .order("total_reviews", { ascending: false })
        .limit(6);

      if (error) throw error;
      setTrendingRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching trending restaurants:", error);
    }
  }, []);

  const fetchNearbyRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("average_rating", { ascending: false })
        .limit(6);

      if (error) throw error;
      setNearbyRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching nearby restaurants:", error);
    }
  }, [location]);

  const fetchSpecialOffers = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("special_offers")
        .select(
          `
					*,
					restaurant:restaurants (*)
				`
        )
        .lte("valid_from", now)
        .gte("valid_until", now)
        .order("discount_percentage", { ascending: false })
        .limit(5);

      if (error) throw error;

      const validOffers = (data || []).filter((offer) => {
        return offer.restaurant && offer.restaurant.id;
      });

      setSpecialOffers(validOffers);
    } catch (error) {
      console.error("Error fetching special offers:", error);
    }
  }, []);

  // Unified Data Loading
  const loadAllData = useCallback(async () => {
    setLoading(true);

    await Promise.all([
      fetchFeaturedRestaurants(),
      fetchNewRestaurants(),
      fetchTopRatedRestaurants(),
      fetchTrendingRestaurants(),
      fetchNearbyRestaurants(),
      fetchSpecialOffers(),
    ]);

    setLoading(false);
  }, [
    fetchFeaturedRestaurants,
    fetchNewRestaurants,
    fetchTopRatedRestaurants,
    fetchTrendingRestaurants,
    fetchNearbyRestaurants,
    fetchSpecialOffers,
  ]);

  // Event Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkForLocationUpdates();
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData, checkForLocationUpdates]);

  const handleLocationPress = useCallback(() => {
    router.push("/(protected)/location-selector");
  }, [router]);

  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      if (
        !restaurantId ||
        typeof restaurantId !== "string" ||
        restaurantId.trim() === ""
      ) {
        console.error("Invalid restaurant ID provided:", restaurantId);
        Alert.alert(
          "Error",
          "Restaurant information is not available. Please try again."
        );
        return;
      }

      try {
        router.push({
          pathname: "/(protected)/restaurant/[id]",
          params: { id: restaurantId.trim() },
        });
      } catch (error) {
        console.error("Navigation error:", error);
        Alert.alert(
          "Error",
          "Unable to open restaurant details. Please try again."
        );
      }
    },
    [router]
  );

  const handleQuickFilter = useCallback(
    (filter: QuickFilter) => {
      router.push({
        pathname: "/(protected)/(tabs)/search",
        params: filter.params,
      });
    },
    [router]
  );

  // FIXED: handleCuisinePress now correctly handles cuisineId string parameter
  const handleCuisinePress = useCallback((cuisineId: string) => {
    console.log("Navigating to cuisine:", cuisineId);
    
    if (!cuisineId || typeof cuisineId !== "string" || cuisineId.trim() === "") {
      console.error("Invalid cuisine ID provided:", cuisineId);
      Alert.alert(
        "Error",
        "Cuisine information is not available. Please try again."
      );
      return;
    }

    try {
      // Navigate to cuisine-specific screen
      router.push({
        pathname: "/(protected)/cuisine/[cuisineId]",
        params: {
          cuisineId: cuisineId.trim(),
          cuisineName: getCuisineName(cuisineId),
        },
      });
    } catch (error) {
      console.error("Cuisine navigation error:", error);
      Alert.alert(
        "Error",
        "Unable to open cuisine page. Please try again."
      );
    }
  }, [router, getCuisineName]);

  const handleOfferPress = useCallback(
    (offer: SpecialOffer) => {
      if (!offer?.restaurant?.id) {
        console.error("Invalid offer or restaurant data:", offer);
        Alert.alert(
          "Error",
          "Offer information is not available. Please try again."
        );
        return;
      }

      try {
        router.push({
          pathname: "/(protected)/restaurant/[id]",
          params: {
            id: offer.restaurant.id,
            highlightOfferId: offer.id,
          },
        });
      } catch (error) {
        console.error("Offer navigation error:", error);
        Alert.alert(
          "Error",
          "Unable to open restaurant details. Please try again."
        );
      }
    },
    [router]
  );

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  // Lifecycle Management
  useEffect(() => {
    const initializeHome = async () => {
      if (!hasInitialLoad.current) {
        await loadLocation();
        hasInitialLoad.current = true;
      }
    };

    initializeHome();
  }, [loadLocation]);

  useEffect(() => {
    if (location && profile) {
      loadAllData();
    }
  }, [location, profile, loadAllData]);

  useEffect(() => {
    checkForLocationUpdates();
  }, [checkForLocationUpdates]);

  // Navigation handlers
  const handleOffersPress = useCallback(() => {
    router.push("/(protected)/offers");
  }, [router]);

  const handleSearchPress = useCallback(() => {
    router.push("/(protected)/(tabs)/search");
  }, [router]);

  const handleSearchWithParams = useCallback(
    (params: Record<string, string>) => {
      router.push({ 
        pathname: "/(protected)/(tabs)/search", 
        params 
      });
    },
    [router]
  );

  const handleProfilePress = useCallback(() => {
    router.push("/(protected)/(tabs)/profile");
  }, [router]);

  return {
    // State
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    trendingRestaurants,
    specialOffers,
    nearbyRestaurants,
    location,
    refreshing,
    loading,
    locationPermissionDenied,
    profile,

    // Handlers
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleQuickFilter,
    handleCuisinePress,
    handleOfferPress,
    handleOffersPress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
    getGreeting,
  };
}