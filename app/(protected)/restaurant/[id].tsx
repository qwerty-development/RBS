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
import { ReviewCard } from "@/components/restaurant/ReviewCard";
import { ReviewSummary } from "@/components/restaurant/ReviewSummary";
import { ImageGalleryModal } from "@/components/restaurant/ImageGalleryModal";
import { RestaurantHeaderInfo } from "@/components/restaurant/RestaurantHeaderInfo";
import { TabNavigation } from "@/components/restaurant/TabNavigation";
import { BookingWidget } from "@/components/restaurant/BookingWidget";
import { QuickActionsBar } from "@/components/restaurant/QuickActionsBar";
import { FeaturesAndAmenities } from "@/components/restaurant/FeaturesAndAmenities";
import { HoursSection } from "@/components/restaurant/HoursSection";
import { LocationSection } from "@/components/restaurant/LocationSection";
import { ContactSection } from "@/components/restaurant/ContactSection";
import { MenuTab } from "@/components/restaurant/MenuTab";
import { AboutSection } from "@/components/restaurant/AboutSection";

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
  average_rating?: number;
  total_reviews?: number;
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

// SCREEN CONFIGURATION CONSTANTS
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;

export default function RestaurantDetailsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  // Safe parameter extraction with multiple fallbacks
  let params;
  let id: string | undefined;

  try {
    params = useLocalSearchParams<{ id: string; highlightOfferId?: string }>();
    if (params && typeof params === "object") {
      id = params.id;
    }
  } catch (error) {
    console.error("Error getting route params:", error);
    params = {};
    id = undefined;
  }

  if (!params || typeof params !== "object") {
    params = {};
  }

  if (typeof id !== "string" || !id.trim()) {
    id = undefined;
  }

  const highlightOfferId = params.highlightOfferId;
  console.log("Restaurant Details - Params:", params, "ID:", id);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews">(
    "overview"
  );
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // Calculate review summary from reviews data
  const calculateReviewSummary = useCallback((reviewsData: Review[]) => {
    if (!reviewsData || reviewsData.length === 0) {
      return null;
    }

    const totalReviews = reviewsData.length;
    const totalRating = reviewsData.reduce(
      (sum, review) => sum + (review.rating || 0),
      0
    );
    const averageRating = totalRating / totalReviews;

    // Calculate rating distribution
    const ratingDistribution: Record<string, number> = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };

    reviewsData.forEach((review) => {
      const rating = Math.round(review.rating || 0).toString();
      if (ratingDistribution[rating] !== undefined) {
        ratingDistribution[rating]++;
      }
    });

    // Calculate detailed ratings (if available)
    const foodRatings = reviewsData
      .filter((r) => r.food_rating)
      .map((r) => r.food_rating!);
    const serviceRatings = reviewsData
      .filter((r) => r.service_rating)
      .map((r) => r.service_rating!);
    const ambianceRatings = reviewsData
      .filter((r) => r.ambiance_rating)
      .map((r) => r.ambiance_rating!);
    const valueRatings = reviewsData
      .filter((r) => r.value_rating)
      .map((r) => r.value_rating!);

    const detailedRatings = {
      food_avg:
        foodRatings.length > 0
          ? foodRatings.reduce((a, b) => a + b, 0) / foodRatings.length
          : averageRating,
      service_avg:
        serviceRatings.length > 0
          ? serviceRatings.reduce((a, b) => a + b, 0) / serviceRatings.length
          : averageRating,
      ambiance_avg:
        ambianceRatings.length > 0
          ? ambianceRatings.reduce((a, b) => a + b, 0) / ambianceRatings.length
          : averageRating,
      value_avg:
        valueRatings.length > 0
          ? valueRatings.reduce((a, b) => a + b, 0) / valueRatings.length
          : averageRating,
    };

    // Calculate recommendation percentage
    const recommendationsCount = reviewsData.filter(
      (r) => r.recommend_to_friend
    ).length;
    const recommendationPercentage =
      totalReviews > 0
        ? Math.round((recommendationsCount / totalReviews) * 100)
        : 0;

    return {
      total_reviews: totalReviews,
      average_rating: averageRating,
      rating_distribution: ratingDistribution,
      detailed_ratings: detailedRatings,
      recommendation_percentage: recommendationPercentage,
    };
  }, []);

  useEffect(() => {
    if (!id) {
      console.error("No restaurant ID provided");
      setLoading(false);
      setTimeout(() => {
        Alert.alert("Error", "Restaurant ID is missing. Please try again.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }, 100);
      return;
    }
  }, [id, router]);

  const fetchRestaurantDetails = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching restaurant details for ID:", id);

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
      console.log("Restaurant rating data:", {
        average_rating: restaurantData.average_rating,
        total_reviews: restaurantData.total_reviews,
        review_summary: restaurantData.review_summary,
      });
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
        .select(
          `
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `
        )
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (reviewsError) {
        console.warn("Reviews fetch error:", reviewsError);
      } else {
        console.log("Reviews fetched:", reviewsData?.length || 0);
        if (reviewsData && reviewsData.length > 0) {
          console.log("Sample review data:", reviewsData[0]);
        }
        setReviews(reviewsData || []);

        // Always calculate review summary from actual reviews data to ensure accuracy
        console.log("Calculating review summary from reviews data...");
        const calculatedSummary = calculateReviewSummary(reviewsData || []);
        console.log("Calculated summary:", calculatedSummary);

        if (calculatedSummary) {
          const updatedRestaurant = {
            ...restaurantData,
            review_summary: calculatedSummary,
            average_rating: calculatedSummary.average_rating,
            total_reviews: calculatedSummary.total_reviews,
          };
          console.log("Updated restaurant with calculated summary:", {
            average_rating: updatedRestaurant.average_rating,
            total_reviews: updatedRestaurant.total_reviews,
            review_summary: updatedRestaurant.review_summary,
          });
          setRestaurant(updatedRestaurant);
        } else {
          // No reviews, but still set the restaurant data with zero values
          const zeroSummary = {
            total_reviews: 0,
            average_rating: 0,
            rating_distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
            detailed_ratings: {
              food_avg: 0,
              service_avg: 0,
              ambiance_avg: 0,
              value_avg: 0,
            },
            recommendation_percentage: 0,
          };
          const updatedRestaurant = {
            ...restaurantData,
            review_summary: zeroSummary,
            average_rating: 0,
            total_reviews: 0,
          };
          console.log("No reviews found, setting zero summary");
          setRestaurant(updatedRestaurant);
        }
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
            const hour = parseInt(slot.time.split(":")[0]);
            const isPeakHour =
              (hour >= 19 && hour <= 21) || (hour >= 12 && hour <= 14);
            const availabilityChance = isPeakHour ? 0.4 : 0.8;
            const isAvailable = Math.random() > 1 - availabilityChance;

            return {
              time: slot.time,
              available: isAvailable,
              availableCapacity: isAvailable
                ? Math.floor(Math.random() * 8) + 2
                : 0,
            };
          }
        });

        console.log("Final available slots:", availableSlots);
        setAvailableSlots(availableSlots);
      } catch (dbError) {
        console.warn(
          "Database availability check failed, using mock data:",
          dbError
        );

        const mockSlots = slots.map((slot) => {
          const hour = parseInt(slot.time.split(":")[0]);
          const isPeakHour =
            (hour >= 19 && hour <= 21) || (hour >= 12 && hour <= 14);
          const availabilityChance = isPeakHour ? 0.4 : 0.8;
          const isAvailable = Math.random() > 1 - availabilityChance;

          return {
            time: slot.time,
            available: isAvailable,
            availableCapacity: isAvailable
              ? Math.floor(Math.random() * 8) + 2
              : 0,
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
  const generateTimeSlots = (
    openTime: string,
    closeTime: string,
    intervalMinutes: number = 30
  ) => {
    const slots: { time: string }[] = [];

    try {
      const [openHour, openMinute] = openTime.split(":").map(Number);
      const [closeHour, closeMinute] = closeTime.split(":").map(Number);

      let currentHour = openHour;
      let currentMinute = openMinute;

      let maxIterations = 50;
      let iterations = 0;

      while (
        (currentHour < closeHour ||
          (currentHour === closeHour && currentMinute < closeMinute)) &&
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

      console.log(
        `Generated ${slots.length} time slots from ${openTime} to ${closeTime}`
      );
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
        const { error } = await supabase.from("favorites").insert({
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
    Linking.openURL(
      `whatsapp://send?phone=${restaurant.whatsapp_number}&text=${message}`
    );
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
            onPress: () => setActiveTab("overview"), // Scroll to booking widget
          },
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
    const [openHour, openMinute] = restaurant.opening_time
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = restaurant.closing_time
      .split(":")
      .map(Number);
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
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
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

  const allImages = [
    restaurant.main_image_url,
    ...(restaurant.image_urls || []),
  ];

  // 14. Image Gallery Modal (Preserved)

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
              const index = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {allImages.map((image, index) => (
              <Pressable key={index} onPress={() => openImageGallery(index)}>
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

        {/* Quick Actions Bar */}
        <QuickActionsBar
          restaurant={restaurant}
          isFavorite={isFavorite}
          colorScheme={colorScheme}
          onToggleFavorite={toggleFavorite}
          onShare={handleShare}
          onCall={handleCall}
          onWhatsApp={handleWhatsApp}
          onDirections={openDirections}
        />

        {/* Restaurant Header Info */}
        <RestaurantHeaderInfo
          restaurant={restaurant}
          highlightOfferId={highlightOfferId}
        />

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === "overview" && (
          <>
            {/* Booking Widget */}
            <BookingWidget
              restaurant={restaurant}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              partySize={partySize}
              availableSlots={availableSlots}
              loadingSlots={loadingSlots}
              onDateChange={setSelectedDate}
              onTimeChange={setSelectedTime}
              onPartySizeChange={setPartySize}
              onBooking={handleBooking}
            />

            {/* About Section */}
            <AboutSection
              restaurant={restaurant}
              showFullDescription={showFullDescription}
              onToggleDescription={() =>
                setShowFullDescription(!showFullDescription)
              }
            />

            {/* Features & Amenities */}
            <FeaturesAndAmenities restaurant={restaurant} />

            {/* Hours of Operation */}
            <HoursSection
              restaurant={restaurant}
              isRestaurantOpen={isRestaurantOpen}
            />

            {/* Location Section */}
            <LocationSection
              restaurant={restaurant}
              mapCoordinates={mapCoordinates}
              mapRef={mapRef}
              onDirectionsPress={openDirections}
            />

            {/* Contact Information */}
            <ContactSection
              restaurant={restaurant}
              onCall={handleCall}
              onWhatsApp={handleWhatsApp}
            />
          </>
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && <MenuTab restaurant={restaurant} />}

        {/* ENHANCED: Reviews Tab with Full Integration */}
        {activeTab === "reviews" && (
          <View className="px-4 mb-6">
            {/* Review Summary Section */}
            <View className="mb-6">
              <ReviewSummary reviewSummary={restaurant.review_summary!} />
            </View>

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
                    <Pressable
                      onPress={() => setShowAllReviews(!showAllReviews)}
                    >
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
      {showImageGallery && (
        <ImageGalleryModal
          images={allImages}
          selectedImageIndex={selectedImageIndex}
          onClose={() => setShowImageGallery(false)}
          onImageIndexChange={setSelectedImageIndex}
        />
      )}

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
