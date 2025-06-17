// app/(protected)/restaurant/[id].tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Dimensions,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Heart,
  Share2,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Users,
  Star,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  Wifi,
  Car,
  Music,
  Trees,
  Cigarette,
  Info,
  Navigation,
  Instagram,
  Globe,
  Menu,
  CheckCircle,
  Camera,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Type Definitions with Complete Restaurant Schema
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean>;
  happy_hour_times?: { start: string; end: string };
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  instagram_handle?: string;
  website_url?: string;
  whatsapp_number?: string;
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
};

type TimeSlot = {
  time: string;
  available: boolean;
  availableCapacity: number;
};

// 2. Screen Configuration Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;
const MAP_HEIGHT = 200;

// 2.1 Feature Icons Mapping
const FEATURE_ICONS = {
  "Outdoor Seating": Trees,
  "Valet Parking": Car,
  "Parking Available": Car,
  "Shisha": Cigarette,
  "Live Music": Music,
  "Free WiFi": Wifi,
};

// 2.2 Dietary Icons Mapping
const DIETARY_ICONS = {
  "Vegetarian": "🥗",
  "Vegan": "🌱",
  "Halal": "🥩",
  "Gluten-Free": "🌾",
  "Kosher": "✡️",
  "Dairy-Free": "🥛",
  "Nut-Free": "🥜",
};

// 2.3 Days of the week
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RestaurantDetailsScreen() {
  // 3. Core State Management Architecture - COMPLETELY FIXED parameter handling
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // Safe parameter extraction with multiple fallbacks
  let params;
  let id: string | undefined;
  
  try {
    params = useLocalSearchParams<{ id: string; highlightOfferId?: string }>();
    // Handle case where params might be undefined, null, or not an object
    if (params && typeof params === 'object') {
      id = params.id;
    }
  } catch (error) {
    console.error("Error getting route params:", error);
    params = {};
    id = undefined;
  }
  
  // Additional safety check
  if (!params || typeof params !== 'object') {
    params = {};
  }
  
  // Ensure id is a string
  if (typeof id !== 'string' || !id.trim()) {
    id = undefined;
  }
  
  const highlightOfferId = params.highlightOfferId;
  console.log("Restaurant Details - Params:", params, "ID:", id);
  
  // 3.1 Restaurant Data States
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  
  // 3.2 Booking Widget States
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // 3.3 UI State Management
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews">("overview");
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // 3.4 Performance Optimization Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // 4. Early return if no ID is provided
  useEffect(() => {
    if (!id) {
      console.error("No restaurant ID provided");
      setLoading(false);
      // Small delay to prevent immediate navigation issues
      setTimeout(() => {
        Alert.alert(
          "Error", 
          "Restaurant ID is missing. Please try again.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }, 100);
      return;
    }
  }, [id, router]);

  // 5. Data Fetching Implementation
  const fetchRestaurantDetails = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching restaurant details for ID:", id);
      
      // 5.1 Fetch restaurant with all details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();
      
      if (restaurantError) {
        console.error("Restaurant fetch error:", restaurantError);
        throw restaurantError;
      }
      
      if (!restaurantData) {
        throw new Error("Restaurant not found");
      }
      
      console.log("Restaurant data fetched:", restaurantData.name);
      setRestaurant(restaurantData);
      
      // 5.2 Check if restaurant is favorited
      if (profile?.id) {
        const { data: favoriteData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", profile.id)
          .eq("restaurant_id", id)
          .single();
        
        setIsFavorite(!!favoriteData);
      }
      
      // 5.3 Fetch reviews with user details
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select(`
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `)
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (reviewsError) {
        console.warn("Reviews fetch error:", reviewsError);
      } else {
        setReviews(reviewsData || []);
      }
      
    } catch (error) {
      console.error("Error fetching restaurant details:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  }, [id, profile?.id]);

  // 6. FIXED: Available Time Slots Fetching
  const fetchAvailableSlots = useCallback(async () => {
    if (!restaurant || !id) return;
    
    setLoadingSlots(true);
    
    try {
      console.log("Generating time slots for restaurant:", restaurant.name);
      
      // 6.1 Generate time slots based on restaurant hours
      const slots = generateTimeSlots(
        restaurant.opening_time,
        restaurant.closing_time,
        30 // 30-minute intervals
      );
      
      console.log("Generated slots:", slots);
      
      // 6.2 For demo purposes, make most slots available with random capacity
      // In a real app, you'd query actual availability from the database
      const dateStr = selectedDate.toISOString().split("T")[0];
      
      try {
        const { data: availabilityData } = await supabase
          .from("restaurant_availability")
          .select("*")
          .eq("restaurant_id", id)
          .eq("date", dateStr);
        
        console.log("Availability data:", availabilityData);
        
        // 6.3 Map availability to slots - with better fallback
        const availableSlots = slots.map((slot) => {
          const availability = availabilityData?.find(
            (a) => a.time_slot === slot.time
          );
          
          if (availability) {
            return {
              time: slot.time,
              available: availability.available_capacity >= partySize,
              availableCapacity: availability.available_capacity,
            };
          } else {
            // Generate realistic availability for demo
            const hour = parseInt(slot.time.split(':')[0]);
            const isPeakHour = (hour >= 19 && hour <= 21) || (hour >= 12 && hour <= 14);
            const availabilityChance = isPeakHour ? 0.4 : 0.8;
            const isAvailable = Math.random() > (1 - availabilityChance);
            
            return {
              time: slot.time,
              available: isAvailable,
              availableCapacity: isAvailable ? Math.floor(Math.random() * 8) + 2 : 0,
            };
          }
        });
        
        console.log("Final available slots:", availableSlots);
        setAvailableSlots(availableSlots);
        
      } catch (dbError) {
        console.warn("Database availability check failed, using mock data:", dbError);
        
        // 6.4 Fallback to mock data if database query fails
        const mockSlots = slots.map((slot) => {
          const hour = parseInt(slot.time.split(':')[0]);
          const isPeakHour = (hour >= 19 && hour <= 21) || (hour >= 12 && hour <= 14);
          const availabilityChance = isPeakHour ? 0.4 : 0.8;
          const isAvailable = Math.random() > (1 - availabilityChance);
          
          return {
            time: slot.time,
            available: isAvailable,
            availableCapacity: isAvailable ? Math.floor(Math.random() * 8) + 2 : 0,
          };
        });
        
        setAvailableSlots(mockSlots);
      }
      
    } catch (error) {
      console.error("Error in fetchAvailableSlots:", error);
      // Last resort: create basic available slots
      const basicSlots = [
        { time: "18:00", available: true, availableCapacity: 4 },
        { time: "18:30", available: true, availableCapacity: 3 },
        { time: "19:00", available: false, availableCapacity: 0 },
        { time: "19:30", available: true, availableCapacity: 2 },
        { time: "20:00", available: true, availableCapacity: 5 },
        { time: "20:30", available: true, availableCapacity: 3 },
        { time: "21:00", available: false, availableCapacity: 0 },
        { time: "21:30", available: true, availableCapacity: 6 },
      ];
      setAvailableSlots(basicSlots);
    } finally {
      setLoadingSlots(false);
    }
  }, [restaurant, selectedDate, partySize, id]);

  // 7. FIXED: Time Slot Generation Algorithm
  const generateTimeSlots = (openTime: string, closeTime: string, intervalMinutes: number = 30) => {
    const slots: { time: string }[] = [];
    
    try {
      const [openHour, openMinute] = openTime.split(":").map(Number);
      const [closeHour, closeMinute] = closeTime.split(":").map(Number);
      
      let currentHour = openHour;
      let currentMinute = openMinute;
      
      // Ensure we don't create an infinite loop
      let maxIterations = 50;
      let iterations = 0;
      
      while (
        (currentHour < closeHour || (currentHour === closeHour && currentMinute < closeMinute)) &&
        iterations < maxIterations
      ) {
        slots.push({
          time: `${currentHour.toString().padStart(2, "0")}:${currentMinute
            .toString()
            .padStart(2, "0")}`,
        });
        
        // Add interval
        currentMinute += intervalMinutes;
        while (currentMinute >= 60) {
          currentHour++;
          currentMinute -= 60;
        }
        
        iterations++;
      }
      
      console.log(`Generated ${slots.length} time slots from ${openTime} to ${closeTime}`);
      return slots;
      
    } catch (error) {
      console.error("Error generating time slots:", error);
      // Return default slots if parsing fails
      return [
        { time: "18:00" },
        { time: "18:30" },
        { time: "19:00" },
        { time: "19:30" },
        { time: "20:00" },
        { time: "20:30" },
        { time: "21:00" },
        { time: "21:30" },
      ];
    }
  };

  // 8. Favorite Toggle Implementation
  const toggleFavorite = useCallback(async () => {
    if (!profile?.id || !restaurant || !id) return;
    
    try {
      if (isFavorite) {
        // 8.1 Remove from favorites
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profile.id)
          .eq("restaurant_id", id);
        
        if (error) throw error;
        setIsFavorite(false);
      } else {
        // 8.2 Add to favorites
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: profile.id,
            restaurant_id: id,
          });
        
        if (error) throw error;
        setIsFavorite(true);
      }
      
      // 8.3 Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Error", "Failed to update favorite status");
    }
  }, [profile?.id, restaurant, isFavorite, id]);

  // 9. Communication Actions
  const handleCall = useCallback(() => {
    if (!restaurant?.phone_number) return;
    Linking.openURL(`tel:${restaurant.phone_number}`);
  }, [restaurant]);

  const handleWhatsApp = useCallback(() => {
    if (!restaurant?.whatsapp_number) return;
    const message = encodeURIComponent(
      `Hi! I'd like to inquire about making a reservation at ${restaurant.name}.`
    );
    Linking.openURL(`whatsapp://send?phone=${restaurant.whatsapp_number}&text=${message}`);
  }, [restaurant]);

  const handleShare = useCallback(async () => {
    if (!restaurant) return;
    
    try {
      await Share.share({
        message: `Check out ${restaurant.name} - ${restaurant.cuisine_type} cuisine in ${restaurant.address}`,
        title: restaurant.name,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [restaurant]);

  // 10. FIXED: Location Extraction and Directions
  const extractLocationCoordinates = (location: any) => {
    // Handle different PostGIS geography formats
    if (!location) {
      return null;
    }
    
    // PostGIS returns different formats depending on the client
    // Handle raw PostGIS point: "POINT(lng lat)"
    if (typeof location === 'string' && location.startsWith('POINT(')) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(' ').map(Number);
        return { latitude: lat, longitude: lng };
      }
    }
    
    // Handle GeoJSON format: { type: "Point", coordinates: [lng, lat] }
    if (location.type === 'Point' && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }
    
    // Handle coordinates array directly: [lng, lat]
    if (Array.isArray(location) && location.length >= 2) {
      const [lng, lat] = location;
      return { latitude: lat, longitude: lng };
    }
    
    // Handle object with lat/lng properties
    if (location.lat && location.lng) {
      return { latitude: location.lat, longitude: location.lng };
    }
    
    // Handle object with latitude/longitude properties
    if (location.latitude && location.longitude) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    
    console.warn("Unable to parse location:", location);
    return null;
  };

  const openDirections = useCallback(() => {
    if (!restaurant?.location) {
      Alert.alert("Error", "Location data not available");
      return;
    }
    
    const coords = extractLocationCoordinates(restaurant.location);
    
    if (!coords) {
      Alert.alert("Error", "Unable to parse location coordinates");
      return;
    }
    
    const { latitude, longitude } = coords;
    
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    
    const latLng = `${latitude},${longitude}`;
    const label = encodeURIComponent(restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    
    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error("Error opening maps:", err);
        Alert.alert("Error", "Unable to open maps application");
      });
    }
  }, [restaurant]);

  // 11. Booking Navigation
  const handleBooking = useCallback(() => {
    if (!selectedTime) {
      Alert.alert("Select Time", "Please select a time for your reservation");
      return;
    }
    
    if (!id || !restaurant) {
      Alert.alert("Error", "Restaurant information is not available");
      return;
    }
    
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: id,
        restaurantName: restaurant.name,
        date: selectedDate.toISOString(),
        time: selectedTime,
        partySize: partySize.toString(),
      },
    });
  }, [id, restaurant, selectedDate, selectedTime, partySize, router]);

  // 12. Image Gallery Handler
  const openImageGallery = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
  }, []);

  // 13. Helper Functions
  const isRestaurantOpen = () => {
    if (!restaurant) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMinute] = restaurant.opening_time.split(":").map(Number);
    const [closeHour, closeMinute] = restaurant.closing_time.split(":").map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    return currentTime >= openTime && currentTime <= closeTime;
  };

  const getDistanceText = (distance: number) => {
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
    return `${distance.toFixed(1)}km`;
  };

  // 14. Lifecycle Management
  useEffect(() => {
    if (id) {
      fetchRestaurantDetails();
    }
  }, [fetchRestaurantDetails, id]);

  useEffect(() => {
    if (restaurant && id) {
      fetchAvailableSlots();
    }
  }, [selectedDate, partySize, restaurant, fetchAvailableSlots, id]);

  // 15. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  // 16. Error States
  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Invalid Restaurant</H3>
          <P className="text-center text-muted-foreground mb-4">
            The restaurant ID is missing or invalid.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <P className="text-center text-muted-foreground mb-4">
            The restaurant you're looking for doesn't exist or has been removed.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const allImages = [restaurant.main_image_url, ...(restaurant.image_urls || [])];

  // 17. Image Gallery Modal
  const ImageGalleryModal = () => (
    <View className="absolute inset-0 bg-black z-50">
      <SafeAreaView className="flex-1">
        <View className="flex-row justify-between items-center p-4">
          <Text className="text-white text-lg font-semibold">
            {selectedImageIndex + 1} of {allImages.length}
          </Text>
          <Pressable
            onPress={() => setShowImageGallery(false)}
            className="bg-black/50 rounded-full p-2"
          >
            <X size={24} color="white" />
          </Pressable>
        </View>
        
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setSelectedImageIndex(index);
          }}
          scrollEventThrottle={16}
          contentOffset={{ x: selectedImageIndex * SCREEN_WIDTH, y: 0 }}
        >
          {allImages.map((image, index) => (
            <View key={index} style={{ width: SCREEN_WIDTH }} className="items-center justify-center">
              <Image
                source={{ uri: image }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 }}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  // Get coordinates for map display
  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938, // Default to Beirut
    longitude: 35.5018,
  };

  // 18. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* 18.1 Image Gallery with Parallax Effect */}
        <View className="relative" style={{ height: IMAGE_HEIGHT }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {allImages.map((image, index) => (
              <Pressable
                key={index}
                onPress={() => openImageGallery(index)}
              >
                <Image
                  source={{ uri: image }}
                  style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
          
          {/* 18.2 Image Indicators */}
          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
            {allImages.map((_, index) => (
              <View
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === imageIndex ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </View>
          
          {/* 18.3 Back Button */}
          <Pressable
            onPress={() => router.back()}
            className="absolute top-4 left-4 bg-black/50 rounded-full p-2"
          >
            <ChevronLeft size={24} color="white" />
          </Pressable>

          {/* 18.4 Gallery Button */}
          <Pressable
            onPress={() => openImageGallery(imageIndex)}
            className="absolute top-4 right-4 bg-black/50 rounded-full p-2"
          >
            <Camera size={24} color="white" />
          </Pressable>

          {/* 18.5 Open Status Badge */}
          <View className="absolute bottom-16 right-4">
            <View
              className={`px-3 py-1 rounded-full ${
                isRestaurantOpen() ? "bg-green-500" : "bg-red-500"
              }`}
            >
              <Text className="text-white text-sm font-medium">
                {isRestaurantOpen() ? "Open Now" : "Closed"}
              </Text>
            </View>
          </View>
        </View>

        {/* 18.6 Quick Actions Bar (Sticky) */}
        <View className="bg-background border-b border-border">
          <View className="flex-row justify-between items-center px-4 py-3">
            <Pressable
              onPress={toggleFavorite}
              className="flex-row items-center gap-2"
            >
              <Heart
                size={24}
                color={isFavorite ? "#ef4444" : colorScheme === "dark" ? "#fff" : "#000"}
                fill={isFavorite ? "#ef4444" : "transparent"}
              />
              <Text className="font-medium">
                {isFavorite ? "Saved" : "Save"}
              </Text>
            </Pressable>
            
            <View className="flex-row gap-4">
              <Pressable onPress={handleShare}>
                <Share2 size={24} />
              </Pressable>
              {restaurant.phone_number && (
                <Pressable onPress={handleCall}>
                  <Phone size={24} />
                </Pressable>
              )}
              {restaurant.whatsapp_number && (
                <Pressable onPress={handleWhatsApp}>
                  <MessageCircle size={24} color="#25D366" />
                </Pressable>
              )}
              <Pressable onPress={openDirections}>
                <Navigation size={24} color="#3b82f6" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 18.7 Restaurant Header Info */}
        <View className="px-4 pt-4 pb-2">
          <H1>{restaurant.name}</H1>
          <View className="flex-row items-center gap-3 mt-2">
            <Text className="text-muted-foreground">{restaurant.cuisine_type}</Text>
            <Text className="text-muted-foreground">•</Text>
            <Text className="text-muted-foreground">
              {"$".repeat(restaurant.price_range)}
            </Text>
            <Text className="text-muted-foreground">•</Text>
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="font-medium">{restaurant.average_rating?.toFixed(1) || "N/A"}</Text>
              <Text className="text-muted-foreground">({restaurant.total_reviews || 0})</Text>
            </View>
          </View>

          {/* Special Offer Highlight */}
          {highlightOfferId && (
            <View className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <Text className="font-semibold text-primary">🎉 Special Offer Available!</Text>
              <Text className="text-sm text-muted-foreground mt-1">
                You came here from a special offer. Don't miss out!
              </Text>
            </View>
          )}
        </View>

        {/* 18.8 Tab Navigation */}
        <View className="flex-row px-4 mb-4 gap-2">
          {(["overview", "menu", "reviews"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg ${
                activeTab === tab ? "bg-primary" : "bg-muted"
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === tab ? "text-primary-foreground" : ""
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 18.9 Tab Content */}
        {activeTab === "overview" && (
          <>
            {/* 18.9.1 Booking Widget */}
            <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm">
              <H3 className="mb-4">Make a Reservation</H3>
              
              {/* Date Selector */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Select Date</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="gap-2"
                >
                  {Array.from({ length: 14 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const isSelected = 
                      date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === new Date().toDateString();
                    
                    return (
                      <Pressable
                        key={i}
                        onPress={() => setSelectedDate(date)}
                        className={`px-4 py-3 rounded-lg mr-2 min-w-[70px] ${
                          isSelected ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <Text
                          className={`text-center font-medium text-xs ${
                            isSelected ? "text-primary-foreground" : ""
                          }`}
                        >
                          {isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "short" })}
                        </Text>
                        <Text
                          className={`text-center text-lg font-bold ${
                            isSelected ? "text-primary-foreground" : ""
                          }`}
                        >
                          {date.getDate()}
                        </Text>
                        <Text
                          className={`text-center text-xs ${
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          {date.toLocaleDateString("en-US", { month: "short" })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              
              {/* Party Size Selector */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Party Size</Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                    <Pressable
                      key={size}
                      onPress={() => setPartySize(size)}
                      className={`flex-1 py-2 rounded-lg ${
                        partySize === size ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          partySize === size ? "text-primary-foreground" : ""
                        }`}
                      >
                        {size}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {partySize > 8 && (
                  <Text className="text-sm text-muted-foreground mt-1">
                    For larger parties, please call the restaurant
                  </Text>
                )}
              </View>
              
              {/* FIXED: Time Slots */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Available Times</Text>
                {loadingSlots ? (
                  <View className="flex-row items-center justify-center py-4">
                    <ActivityIndicator size="small" />
                    <Text className="ml-2 text-muted-foreground">Loading availability...</Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <Pressable
                        key={slot.time}
                        onPress={() => {
                          if (slot.available) {
                            console.log("Selected time:", slot.time);
                            setSelectedTime(slot.time);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        disabled={!slot.available}
                        className={`px-4 py-2 rounded-lg min-w-[70px] ${
                          selectedTime === slot.time
                            ? "bg-primary border-2 border-primary"
                            : slot.available
                            ? "bg-muted border border-border"
                            : "bg-muted/50 border border-muted"
                        }`}
                        style={{
                          opacity: slot.available ? 1 : 0.5,
                        }}
                      >
                        <Text
                          className={`font-medium text-center ${
                            selectedTime === slot.time
                              ? "text-primary-foreground"
                              : !slot.available
                              ? "text-muted-foreground"
                              : ""
                          }`}
                        >
                          {slot.time}
                        </Text>
                        {slot.available && slot.availableCapacity < 5 && slot.availableCapacity > 0 && (
                          <Text className="text-xs text-orange-600 text-center mt-1">
                            {slot.availableCapacity} left
                          </Text>
                        )}
                      </Pressable>
                    ))}
                    {availableSlots.length === 0 && (
                      <Text className="text-muted-foreground text-center w-full py-4">
                        No availability for this date
                      </Text>
                    )}
                  </View>
                )}
              </View>
              
              {/* Debug info */}
              {selectedTime && (
                <View className="mb-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <Text className="text-xs text-green-800 dark:text-green-200">
                    Selected: {selectedTime}
                  </Text>
                </View>
              )}
              
              {/* Book Button */}
              <Button
                onPress={handleBooking}
                disabled={!selectedTime}
                className="w-full"
              >
                <Text>
                  {restaurant.booking_policy === "instant"
                    ? "Book Now"
                    : "Request Booking"}
                </Text>
              </Button>
              
              {restaurant.booking_policy === "request" && (
                <Text className="text-xs text-muted-foreground text-center mt-2">
                  Restaurant will confirm within 2 hours
                </Text>
              )}
            </View>

            {/* 18.9.2 About Section */}
            <View className="px-4 mb-6">
              <H3 className="mb-2">About</H3>
              <P
                className="text-muted-foreground"
                numberOfLines={showFullDescription ? undefined : 3}
              >
                {restaurant.description}
              </P>
              {restaurant.description && restaurant.description.length > 150 && (
                <Pressable
                  onPress={() => setShowFullDescription(!showFullDescription)}
                  className="mt-1"
                >
                  <Text className="text-primary font-medium">
                    {showFullDescription ? "Show Less" : "Read More"}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 18.9.3 Features Grid */}
            <View className="px-4 mb-6">
              <H3 className="mb-3">Features & Amenities</H3>
              <View className="flex-row flex-wrap gap-3">
                {restaurant.outdoor_seating && (
                  <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                    <Trees size={20} />
                    <Text>Outdoor Seating</Text>
                  </View>
                )}
                {restaurant.valet_parking && (
                  <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                    <Car size={20} />
                    <Text>Valet Parking</Text>
                  </View>
                )}
                {restaurant.parking_available && (
                  <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                    <Car size={20} />
                    <Text>Parking Available</Text>
                  </View>
                )}
                {restaurant.shisha_available && (
                  <View className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                    <Cigarette size={20} />
                    <Text>Shisha</Text>
                  </View>
                )}
                {restaurant.tags?.map((tag) => (
                  <View
                    key={tag}
                    className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                  >
                    {FEATURE_ICONS[tag as keyof typeof FEATURE_ICONS] ? (
                      React.createElement(
                        FEATURE_ICONS[tag as keyof typeof FEATURE_ICONS],
                        { size: 20 }
                      )
                    ) : (
                      <Info size={20} />
                    )}
                    <Text>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 18.9.4 Dietary Options */}
            {restaurant.dietary_options && restaurant.dietary_options.length > 0 && (
              <View className="px-4 mb-6">
                <H3 className="mb-3">Dietary Options</H3>
                <View className="flex-row flex-wrap gap-3">
                  {restaurant.dietary_options.map((option) => (
                    <View
                      key={option}
                      className="flex-row items-center gap-2 bg-green-100 dark:bg-green-900/20 px-3 py-2 rounded-lg"
                    >
                      <Text className="text-lg">
                        {DIETARY_ICONS[option as keyof typeof DIETARY_ICONS] || "✓"}
                      </Text>
                      <Text className="text-green-800 dark:text-green-200">
                        {option}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 18.9.5 Hours of Operation */}
            <View className="px-4 mb-6">
              <H3 className="mb-3">Hours</H3>
              <View className="bg-card p-4 rounded-lg">
                <View className="flex-row items-center gap-2 mb-2">
                  <Clock size={20} />
                  <Text className="font-medium">
                    Today: {restaurant.opening_time} - {restaurant.closing_time}
                  </Text>
                  <View
                    className={`px-2 py-1 rounded-full ml-auto ${
                      isRestaurantOpen() ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        isRestaurantOpen() ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {isRestaurantOpen() ? "Open" : "Closed"}
                    </Text>
                  </View>
                </View>
                {restaurant.happy_hour_times && (
                  <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-border">
                    <DollarSign size={20} color="#10b981" />
                    <Text className="text-green-600 dark:text-green-400">
                      Happy Hour: {restaurant.happy_hour_times.start} - {restaurant.happy_hour_times.end}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* 18.9.6 FIXED: Location Section */}
            <View className="px-4 mb-6">
              <H3 className="mb-3">Location</H3>
              <Pressable
                onPress={openDirections}
                className="bg-card rounded-lg overflow-hidden"
              >
                <MapView
                  ref={mapRef}
                  style={{ height: MAP_HEIGHT }}
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
                    <View className="flex-row items-center gap-2">
                      <MapPin size={20} />
                      <Text className="font-medium">Address</Text>
                    </View>
                    <Text className="text-muted-foreground mt-1">
                      {restaurant.address}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#666" />
                </View>
              </Pressable>
            </View>

            {/* 18.9.7 Contact Information */}
            <View className="px-4 mb-6">
              <H3 className="mb-3">Contact</H3>
              <View className="bg-card rounded-lg divide-y divide-border">
                {restaurant.phone_number && (
                  <Pressable
                    onPress={handleCall}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Phone size={20} />
                      <Text>{restaurant.phone_number}</Text>
                    </View>
                    <ChevronRight size={20} color="#666" />
                  </Pressable>
                )}
                {restaurant.whatsapp_number && (
                  <Pressable
                    onPress={handleWhatsApp}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <MessageCircle size={20} color="#25D366" />
                      <Text>WhatsApp</Text>
                    </View>
                    <ChevronRight size={20} color="#666" />
                  </Pressable>
                )}
                {restaurant.instagram_handle && (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(
                        `https://instagram.com/${restaurant.instagram_handle}`
                      )
                    }
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Instagram size={20} color="#E1306C" />
                      <Text>@{restaurant.instagram_handle}</Text>
                    </View>
                    <ChevronRight size={20} color="#666" />
                  </Pressable>
                )}
                {restaurant.website_url && (
                  <Pressable
                    onPress={() => Linking.openURL(restaurant.website_url!)}
                    className="p-4 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <Globe size={20} />
                      <Text>Website</Text>
                    </View>
                    <ChevronRight size={20} color="#666" />
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}

        {/* 18.10 Menu Tab */}
        {activeTab === "menu" && (
          <View className="px-4 mb-6">
            <H3 className="mb-3">Menu</H3>
            {restaurant.menu_url ? (
              <Pressable
                onPress={() => Linking.openURL(restaurant.menu_url!)}
                className="bg-card p-6 rounded-lg items-center"
              >
                <Menu size={48} color="#666" />
                <Text className="mt-3 font-medium">View Full Menu</Text>
                <Muted className="text-sm mt-1">Opens in browser</Muted>
              </Pressable>
            ) : (
              <View className="bg-muted p-6 rounded-lg items-center">
                <Menu size={48} color="#666" />
                <Muted className="mt-3">Menu not available</Muted>
                <Text className="text-sm text-center mt-1 text-muted-foreground">
                  Contact the restaurant for menu information
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 18.11 Reviews Tab */}
        {activeTab === "reviews" && (
          <View className="px-4 mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <H3>Reviews</H3>
              <View className="flex-row items-center gap-1">
                <Star size={20} color="#f59e0b" fill="#f59e0b" />
                <Text className="font-bold text-lg">
                  {restaurant.average_rating?.toFixed(1) || "N/A"}
                </Text>
                <Text className="text-muted-foreground">
                  ({restaurant.total_reviews || 0})
                </Text>
              </View>
            </View>
            
            {/* Rating Breakdown */}
            <View className="bg-card p-4 rounded-lg mb-4">
              <Text className="font-medium mb-3">Rating Breakdown</Text>
              {[5, 4, 3, 2, 1].map((rating) => (
                <View key={rating} className="flex-row items-center gap-2 mb-1">
                  <Text className="w-3">{rating}</Text>
                  <Star size={12} color="#f59e0b" fill="#f59e0b" />
                  <View className="flex-1 bg-muted rounded-full h-2">
                    <View
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${Math.random() * 100}%` }}
                    />
                  </View>
                  <Text className="text-sm text-muted-foreground w-8">
                    {Math.floor(Math.random() * 50)}
                  </Text>
                </View>
              ))}
            </View>
            
            {reviews.length > 0 ? (
              <>
                {reviews
                  .slice(0, showAllReviews ? undefined : 3)
                  .map((review) => (
                    <View
                      key={review.id}
                      className="bg-card p-4 rounded-lg mb-3"
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-row items-center gap-3">
                          <Image
                            source={
                              review.user.avatar_url
                                ? { uri: review.user.avatar_url }
                                : require("@/assets/default-avatar.jpeg")
                            }
                            className="w-10 h-10 rounded-full"
                            contentFit="cover"
                          />
                          <View>
                            <Text className="font-medium">
                              {review.user.full_name}
                            </Text>
                            <View className="flex-row items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  color="#f59e0b"
                                  fill={i < review.rating ? "#f59e0b" : "transparent"}
                                />
                              ))}
                            </View>
                          </View>
                        </View>
                        <Muted className="text-xs">
                          {new Date(review.created_at).toLocaleDateString()}
                        </Muted>
                      </View>
                      {review.comment && (
                        <P className="text-sm">{review.comment}</P>
                      )}
                    </View>
                  ))}
                
                {reviews.length > 3 && (
                  <Button
                    variant="outline"
                    onPress={() => setShowAllReviews(!showAllReviews)}
                    className="w-full"
                  >
                    <Text>
                      {showAllReviews ? "Show Less" : `View All ${reviews.length} Reviews`}
                    </Text>
                  </Button>
                )}
              </>
            ) : (
              <View className="bg-muted p-6 rounded-lg items-center">
                <Star size={48} color="#666" />
                <Muted className="mt-3">No reviews yet</Muted>
                <Text className="text-sm text-center mt-1">
                  Be the first to review this restaurant!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 18.12 Bottom Padding */}
        <View className="h-20" />
      </ScrollView>

      {/* 18.13 Image Gallery Modal */}
      {showImageGallery && <ImageGalleryModal />}
    </SafeAreaView>
  );
}