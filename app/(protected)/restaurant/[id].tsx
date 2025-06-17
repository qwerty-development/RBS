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
  ThumbsUp,
  MoreVertical,
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

// 1. ENHANCED TYPE DEFINITIONS WITH REVIEW INTEGRATION
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
  // ENHANCED: Review summary integration
  review_summary?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
};

// ENHANCED: Complete review type with all new fields
type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
  // Extended fields from enhanced schema
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  value_rating?: number;
  recommend_to_friend?: boolean;
  visit_again?: boolean;
  tags?: string[];
  photos?: string[];
};

type TimeSlot = {
  time: string;
  available: boolean;
  availableCapacity: number;
};

// 2. REVIEW COMPONENT DEFINITIONS (Inline for completeness)
interface ReviewCardProps {
  review: Review;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

const ReviewCard = ({ 
  review, 
  isOwner = false, 
  onEdit, 
  onDelete, 
  showActions = true 
}: ReviewCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color="#f59e0b"
            fill={star <= rating ? "#f59e0b" : "transparent"}
          />
        ))}
      </View>
    );
  };

  const renderDetailedRatings = () => {
    const ratings = [
      { label: 'Food', value: review.food_rating },
      { label: 'Service', value: review.service_rating },
      { label: 'Ambiance', value: review.ambiance_rating },
      { label: 'Value', value: review.value_rating },
    ].filter(r => r.value && r.value > 0);

    if (ratings.length === 0) return null;

    return (
      <View className="mt-3 p-3 bg-muted/20 rounded-lg">
        <View className="flex-row flex-wrap gap-4">
          {ratings.map((rating) => (
            <View key={rating.label} className="flex-1 min-w-[70px]">
              <Text className="text-xs text-muted-foreground mb-1">
                {rating.label}
              </Text>
              {renderStars(rating.value!, 12)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View className="bg-card border border-border rounded-lg p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
            {review.user.avatar_url ? (
              <Image
                source={{ uri: review.user.avatar_url }}
                className="w-10 h-10 rounded-full"
                contentFit="cover"
              />
            ) : (
              <Text className="text-primary font-semibold">
                {review.user.full_name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          
          <View className="flex-1">
            <Text className="font-semibold text-sm">
              {review.user.full_name}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              {renderStars(review.rating)}
              <Muted className="text-xs">
                {formatDate(review.created_at)}
              </Muted>
            </View>
          </View>
        </View>
        
        {isOwner && showActions && (
          <Pressable className="p-1">
            <MoreVertical size={16} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Review Content */}
      {review.comment && (
        <P className="text-sm leading-5 mb-3">
          {review.comment}
        </P>
      )}

      {/* Detailed Ratings */}
      {renderDetailedRatings()}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {review.tags.map((tag, index) => (
            <View key={index} className="bg-primary/10 px-2 py-1 rounded-full">
              <Text className="text-xs text-primary">
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <View className="mt-3">
          <View className="flex-row gap-2">
            {review.photos.slice(0, 4).map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                className="w-16 h-16 rounded-lg flex-1"
                contentFit="cover"
              />
            ))}
            {review.photos.length > 4 && (
              <View className="w-16 h-16 rounded-lg bg-muted items-center justify-center">
                <Text className="text-xs text-muted-foreground">
                  +{review.photos.length - 4}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Recommendation Indicators */}
      <View className="flex-row items-center gap-4 mt-3 pt-3 border-t border-border">
        {review.recommend_to_friend && (
          <View className="flex-row items-center gap-1">
            <ThumbsUp size={12} color="#10b981" />
            <Text className="text-xs text-green-600">
              Recommends to friends
            </Text>
          </View>
        )}
        
        {review.visit_again && (
          <View className="flex-row items-center gap-1">
            <Calendar size={12} color="#3b82f6" />
            <Text className="text-xs text-blue-600">
              Will visit again
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

interface ReviewSummaryProps {
  reviewSummary: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
}

const ReviewSummary = ({ reviewSummary }: ReviewSummaryProps) => {
  const renderStars = (rating: number, size: number = 20) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            color="#f59e0b"
            fill={star <= rating ? "#f59e0b" : "transparent"}
          />
        ))}
      </View>
    );
  };

  const renderRatingBar = (rating: number, count: number) => {
    const total = reviewSummary.total_reviews;
    const percentage = total > 0 ? (count / total) * 100 : 0;
    
    return (
      <View className="flex-row items-center gap-2 mb-1">
        <Text className="text-xs w-4">
          {rating}
        </Text>
        <Star size={12} color="#f59e0b" fill="#f59e0b" />
        <View className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <View 
            className="h-full bg-yellow-400"
            style={{ width: `${percentage}%` }}
          />
        </View>
        <Text className="text-xs w-8 text-right text-muted-foreground">
          {count}
        </Text>
      </View>
    );
  };

  if (reviewSummary.total_reviews === 0) {
    return (
      <View className="bg-card border border-border rounded-lg p-4">
        <Text className="text-center text-muted-foreground">
          No reviews yet. Be the first to review!
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-card border border-border rounded-lg p-4">
      {/* Overall Rating */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="items-center">
          <Text className="text-3xl font-bold">
            {reviewSummary.average_rating.toFixed(1)}
          </Text>
          {renderStars(Math.round(reviewSummary.average_rating))}
          <Muted className="text-xs mt-1">
            {reviewSummary.total_reviews} review{reviewSummary.total_reviews !== 1 ? 's' : ''}
          </Muted>
        </View>

        <View className="flex-1 ml-6">
          {[5, 4, 3, 2, 1].map((rating) => 
            renderRatingBar(
              rating, 
              reviewSummary.rating_distribution[rating.toString()] || 0
            )
          )}
        </View>
      </View>

      {/* Detailed Ratings */}
      <View className="border-t border-border pt-4">
        <Text className="font-semibold mb-3">Detailed Ratings</Text>
        <View className="flex-row flex-wrap gap-4">
          {Object.entries(reviewSummary.detailed_ratings).map(([key, value]) => {
            if (!value) return null;
            const label = key.replace('_avg', '').replace(/^\w/, c => c.toUpperCase());
            
            return (
              <View key={key} className="flex-1 min-w-[70px]">
                <Text className="text-xs text-muted-foreground mb-1">
                  {label}
                </Text>
                {renderStars(Math.round(value), 14)}
                <Text className="text-xs mt-1">
                  {value.toFixed(1)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recommendation Rate */}
      {reviewSummary.recommendation_percentage > 0 && (
        <View className="border-t border-border pt-4 mt-4">
          <View className="flex-row items-center gap-2">
            <ThumbsUp size={16} color="#10b981" />
            <Text className="text-sm">
              {reviewSummary.recommendation_percentage}% recommend to friends
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// 3. SCREEN CONFIGURATION CONSTANTS
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;
const MAP_HEIGHT = 200;

// 3.1 Feature Icons Mapping
const FEATURE_ICONS = {
  "Outdoor Seating": Trees,
  "Valet Parking": Car,
  "Parking Available": Car,
  "Shisha": Cigarette,
  "Live Music": Music,
  "Free WiFi": Wifi,
};

// 3.2 Dietary Icons Mapping
const DIETARY_ICONS = {
  "Vegetarian": "🥗",
  "Vegan": "🌱",
  "Halal": "🥩",
  "Gluten-Free": "🌾",
  "Kosher": "✡️",
  "Dairy-Free": "🥛",
  "Nut-Free": "🥜",
};

// 3.3 Days of the week
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RestaurantDetailsScreen() {
  // 4. CORE STATE MANAGEMENT ARCHITECTURE
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  // Safe parameter extraction with multiple fallbacks
  let params;
  let id: string | undefined;
  
  try {
    params = useLocalSearchParams<{ id: string; highlightOfferId?: string }>();
    if (params && typeof params === 'object') {
      id = params.id;
    }
  } catch (error) {
    console.error("Error getting route params:", error);
    params = {};
    id = undefined;
  }
  
  if (!params || typeof params !== 'object') {
    params = {};
  }
  
  if (typeof id !== 'string' || !id.trim()) {
    id = undefined;
  }
  
  const highlightOfferId = params.highlightOfferId;
  console.log("Restaurant Details - Params:", params, "ID:", id);
  
  // 4.1 Restaurant Data States
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  
  // 4.2 Booking Widget States
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // 4.3 UI State Management
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews">("overview");
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // 4.4 Performance Optimization Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // 5. Early return if no ID is provided
  useEffect(() => {
    if (!id) {
      console.error("No restaurant ID provided");
      setLoading(false);
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

  // 6. ENHANCED DATA FETCHING WITH REVIEW INTEGRATION
  const fetchRestaurantDetails = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching restaurant details for ID:", id);
      
      // 6.1 Fetch restaurant with all details including review_summary
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
      
      // 6.2 Check if restaurant is favorited
      if (profile?.id) {
        const { data: favoriteData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", profile.id)
          .eq("restaurant_id", id)
          .single();
        
        setIsFavorite(!!favoriteData);
      }
      
      // 6.3 ENHANCED: Fetch reviews with user details and expanded data
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
        .limit(20);
      
      if (reviewsError) {
        console.warn("Reviews fetch error:", reviewsError);
      } else {
        console.log("Reviews fetched:", reviewsData?.length || 0);
        setReviews(reviewsData || []);
      }
      
    } catch (error) {
      console.error("Error fetching restaurant details:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  }, [id, profile?.id]);

  // 7. Available Time Slots Fetching (Preserved from original)
  const fetchAvailableSlots = useCallback(async () => {
    if (!restaurant || !id) return;
    
    setLoadingSlots(true);
    
    try {
      console.log("Generating time slots for restaurant:", restaurant.name);
      
      const slots = generateTimeSlots(
        restaurant.opening_time,
        restaurant.closing_time,
        30
      );
      
      console.log("Generated slots:", slots);
      
      const dateStr = selectedDate.toISOString().split("T")[0];
      
      try {
        const { data: availabilityData } = await supabase
          .from("restaurant_availability")
          .select("*")
          .eq("restaurant_id", id)
          .eq("date", dateStr);
        
        console.log("Availability data:", availabilityData);
        
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

  // 8. Time Slot Generation Algorithm (Preserved)
  const generateTimeSlots = (openTime: string, closeTime: string, intervalMinutes: number = 30) => {
    const slots: { time: string }[] = [];
    
    try {
      const [openHour, openMinute] = openTime.split(":").map(Number);
      const [closeHour, closeMinute] = closeTime.split(":").map(Number);
      
      let currentHour = openHour;
      let currentMinute = openMinute;
      
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

  // 9. All other handlers (Preserved from original)
  const toggleFavorite = useCallback(async () => {
    if (!profile?.id || !restaurant || !id) return;
    
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profile.id)
          .eq("restaurant_id", id);
        
        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: profile.id,
            restaurant_id: id,
          });
        
        if (error) throw error;
        setIsFavorite(true);
      }
      
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Error", "Failed to update favorite status");
    }
  }, [profile?.id, restaurant, isFavorite, id]);

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

  const extractLocationCoordinates = (location: any) => {
    if (!location) {
      return null;
    }
    
    if (typeof location === 'string' && location.startsWith('POINT(')) {
      const coords = location.match(/POINT\(([^)]+)\)/);
      if (coords && coords[1]) {
        const [lng, lat] = coords[1].split(' ').map(Number);
        return { latitude: lat, longitude: lng };
      }
    }
    
    if (location.type === 'Point' && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { latitude: lat, longitude: lng };
    }
    
    if (Array.isArray(location) && location.length >= 2) {
      const [lng, lat] = location;
      return { latitude: lat, longitude: lng };
    }
    
    if (location.lat && location.lng) {
      return { latitude: location.lat, longitude: location.lng };
    }
    
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

  const openImageGallery = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
  }, []);

  // 10. NEW: Review Navigation Handler
  const navigateToCreateReview = useCallback(async () => {
    if (!profile?.id || !restaurant || !id) {
      Alert.alert("Authentication Required", "Please log in to write a review");
      return;
    }

    // Check if user has any completed bookings at this restaurant
    const { data: completedBookings, error } = await supabase
      .from("bookings")
      .select("id, booking_time")
      .eq("user_id", profile.id)
      .eq("restaurant_id", id)
      .eq("status", "completed")
      .order("booking_time", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error checking bookings:", error);
      Alert.alert("Error", "Unable to verify booking history");
      return;
    }

    if (!completedBookings || completedBookings.length === 0) {
      Alert.alert(
        "Booking Required", 
        "You need to have dined at this restaurant to write a review. Would you like to make a booking?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Book Now", 
            onPress: () => setActiveTab("overview") // Scroll to booking widget
          }
        ]
      );
      return;
    }

    // Use the most recent completed booking for review
    const latestBooking = completedBookings[0];
    
    // Check if review already exists for this booking
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", latestBooking.id)
      .single();

    if (existingReview) {
      Alert.alert("Review Exists", "You have already reviewed this visit.");
      return;
    }

    router.push({
      pathname: "/review/create",
      params: {
        bookingId: latestBooking.id,
        restaurantId: id,
        restaurantName: restaurant.name,
      },
    });
  }, [profile?.id, restaurant, id, router]);

  // 11. Helper Functions (Preserved)
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

  // 12. Lifecycle Management
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

  // 13. Loading and Error States (Preserved)
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

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

  // 14. Image Gallery Modal (Preserved)
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

  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  // 15. MAIN RENDER WITH ENHANCED REVIEW INTEGRATION
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Image Gallery with Parallax Effect (Preserved) */}
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
          
          <Pressable
            onPress={() => router.back()}
            className="absolute top-4 left-4 bg-black/50 rounded-full p-2"
          >
            <ChevronLeft size={24} color="white" />
          </Pressable>

          <Pressable
            onPress={() => openImageGallery(imageIndex)}
            className="absolute top-4 right-4 bg-black/50 rounded-full p-2"
          >
            <Camera size={24} color="white" />
          </Pressable>

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

        {/* Quick Actions Bar (Preserved) */}
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

        {/* Restaurant Header Info (Enhanced with review data) */}
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
              <Text className="font-medium">
                {restaurant.review_summary?.average_rating?.toFixed(1) || 
                 restaurant.average_rating?.toFixed(1) || "N/A"}
              </Text>
              <Text className="text-muted-foreground">
                ({restaurant.review_summary?.total_reviews || restaurant.total_reviews || 0})
              </Text>
            </View>
          </View>

          {highlightOfferId && (
            <View className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <Text className="font-semibold text-primary">🎉 Special Offer Available!</Text>
              <Text className="text-sm text-muted-foreground mt-1">
                You came here from a special offer. Don't miss out!
              </Text>
            </View>
          )}
        </View>

        {/* Tab Navigation (Preserved) */}
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

        {/* Tab Content */}
        {activeTab === "overview" && (
          <>
            {/* Booking Widget (Preserved - complete section) */}
            <View className="mx-4 mb-6 p-4 bg-card rounded-xl shadow-sm">
              <H3 className="mb-4">Make a Reservation</H3>
              
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
              
              {selectedTime && (
                <View className="mb-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <Text className="text-xs text-green-800 dark:text-green-200">
                    Selected: {selectedTime}
                  </Text>
                </View>
              )}
              
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

            {/* About Section (Preserved) */}
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

            {/* Features Grid (Preserved) */}
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

            {/* Dietary Options (Preserved) */}
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

            {/* Hours of Operation (Preserved) */}
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

            {/* Location Section (Preserved) */}
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

            {/* Contact Information (Preserved) */}
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

        {/* Menu Tab (Preserved) */}
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

        {/* ENHANCED: Reviews Tab with Full Integration */}
        {activeTab === "reviews" && (
          <View className="px-4 mb-6">
            {/* Review Summary Section */}
            {restaurant.review_summary ? (
              <View className="mb-6">
                <ReviewSummary reviewSummary={restaurant.review_summary} />
              </View>
            ) : (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                  <H3>Reviews & Ratings</H3>
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
              </View>
            )}

            {/* Write Review Button */}
            <View className="mb-6">
              <Button
                onPress={navigateToCreateReview}
                variant="outline"
                className="w-full"
              >
                <View className="flex-row items-center gap-2">
                  <Star size={16} />
                  <Text>Write a Review</Text>
                </View>
              </Button>
            </View>

            {/* Individual Reviews */}
            {reviews.length > 0 ? (
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="font-semibold">Recent Reviews</Text>
                  {reviews.length > 5 && (
                    <Pressable onPress={() => setShowAllReviews(!showAllReviews)}>
                      <Text className="text-primary text-sm">
                        {showAllReviews ? "Show Less" : "View All"}
                      </Text>
                    </Pressable>
                  )}
                </View>
                
                {reviews
                  .slice(0, showAllReviews ? undefined : 5)
                  .map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      isOwner={profile?.id === review.user_id}
                      showActions={false}
                    />
                  ))}
                
                {reviews.length > 5 && !showAllReviews && (
                  <Button
                    variant="outline"
                    onPress={() => setShowAllReviews(true)}
                    className="w-full mt-2"
                  >
                    <Text>View All {reviews.length} Reviews</Text>
                  </Button>
                )}
              </View>
            ) : (
              <View className="bg-card border border-border rounded-lg p-6 items-center">
                <Star size={32} color="#d1d5db" />
                <Text className="mt-2 font-medium">No Reviews Yet</Text>
                <Muted className="text-center mt-1">
                  Be the first to share your experience
                </Muted>
                <Button
                  onPress={navigateToCreateReview}
                  variant="default"
                  className="mt-4"
                >
                  <Text>Write First Review</Text>
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Image Gallery Modal */}
      {showImageGallery && <ImageGalleryModal />}

      {/* ENHANCED: Floating Action Button for Reviews */}
      {activeTab === "overview" && (
        <View className="absolute bottom-4 right-4">
          <Pressable
            onPress={navigateToCreateReview}
            className="bg-primary rounded-full p-3 shadow-lg"
          >
            <Star size={24} color="white" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}