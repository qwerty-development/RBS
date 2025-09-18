// hooks/useRestaurant.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert, Share, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { AvailabilityService, TimeSlot } from "@/lib/AvailabilityService";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

// Core Types
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[] | null;
  ambiance_tags?: string[] | null;
  parking_available?: boolean | null;
  outdoor_seating?: boolean | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  location?: any;
  cuisine_type?: string | null;
  address?: string | null;
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
  } | null;
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
};

interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

// Helper interface for consolidated return
interface UseRestaurantReturn {
  // Data
  restaurant: Restaurant | null;
  reviews: Review[];
  isFavorite: boolean;
  loading: boolean;
  availableSlots: TimeSlot[];
  loadingSlots: boolean;

  // Actions
  toggleFavorite: () => Promise<void>;
  handleShare: () => Promise<void>;
  handleBooking: (
    selectedDate: Date,
    selectedTime: string,
    partySize: number,
  ) => void;
  navigateToCreateReview: () => void;
  refresh: () => Promise<void>;

  // Helper functions
  extractLocationCoordinates: (location: any) => LocationCoordinate | null;
  isRestaurantOpen: (restaurant: Restaurant) => boolean;
  getDistanceText: (distance: number) => string;
  handleCall: (restaurant: Restaurant) => void;
  handleWhatsApp: (restaurant: Restaurant) => void;
  openDirections: (restaurant: Restaurant) => void;
  generateTimeSlots: (
    openTime: string,
    closeTime: string,
    intervalMinutes?: number,
  ) => { time: string }[];
  fetchAvailableSlots: (date: Date, partySize: number) => Promise<void>;
}

export function useRestaurant(
  restaurantId: string | undefined,
): UseRestaurantReturn {
  const router = useRouter();
  const { profile, databaseReady } = useAuth();

  // Core state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Use the enhanced availability hook for restaurant hours
  const { checkAvailability, loading: availabilityLoading } =
    useRestaurantAvailability(restaurantId || "");

  useEffect(() => {
    return () => {
      // Clean up on unmount
      setLastAvailabilityParams(null);
      setAvailableSlots([]);
      setRestaurant(null);
      setReviews([]);
      setLoading(true);
    };
  }, []);

  // Initialize availability service
  const availabilityService = useMemo(
    () => AvailabilityService.getInstance(),
    [],
  );

  // Helper Functions (merged from useRestaurantHelpers)
  const extractLocationCoordinates = useCallback(
    (location: any): LocationCoordinate | null => {
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
    },
    [],
  );

  // FIXED: Use new restaurant hours system
  const isRestaurantOpen = useCallback(
    (restaurant: Restaurant): boolean => {
      if (!restaurant?.id) return false;

      const today = new Date();
      const availability = checkAvailability(today);
      return availability.isOpen;
    },
    [checkAvailability],
  );

  const getDistanceText = useCallback((distance: number): string => {
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
    return `${distance.toFixed(1)}km`;
  }, []);

  const handleCall = useCallback((restaurant: Restaurant) => {
    if (!restaurant?.phone_number) return;
    Linking.openURL(`tel:${restaurant.phone_number}`);
  }, []);

  const handleWhatsApp = useCallback((restaurant: Restaurant) => {
    if (!restaurant?.whatsapp_number) return;
    const message = encodeURIComponent(
      `Hi! I'd like to inquire about making a reservation at ${restaurant.name}.`,
    );
    Linking.openURL(
      `whatsapp://send?phone=${restaurant.whatsapp_number}&text=${message}`,
    );
  }, []);

  const openDirections = useCallback(
    (restaurant: Restaurant) => {
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
    },
    [extractLocationCoordinates],
  );

  const generateTimeSlots = useCallback(
    (openTime: string, closeTime: string, intervalMinutes: number = 30) => {
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
          `Generated ${slots.length} time slots from ${openTime} to ${closeTime}`,
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
    },
    [],
  );

  // Calculate review summary from reviews data
  const calculateReviewSummary = useCallback((reviewsData: Review[]) => {
    if (!reviewsData || reviewsData.length === 0) {
      return null;
    }

    const totalReviews = reviewsData.length;
    const totalRating = reviewsData.reduce(
      (sum, review) => sum + (review.rating || 0),
      0,
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

    // Calculate detailed ratings using overall rating as fallback
    // TODO: Add detailed rating fields to database schema
    const detailedRatings = {
      food_avg: averageRating,
      service_avg: averageRating,
      ambiance_avg: averageRating,
      value_avg: averageRating,
    };

    // Calculate recommendation percentage (assume 80% recommend for now)
    // TODO: Add recommend_to_friend field to database schema
    const recommendationPercentage = Math.round(
      averageRating >= 4 ? 80 : averageRating >= 3 ? 60 : 40,
    );

    return {
      total_reviews: totalReviews,
      average_rating: averageRating,
      rating_distribution: ratingDistribution,
      detailed_ratings: detailedRatings,
      recommendation_percentage: recommendationPercentage,
    };
  }, []);

  // Store last used values for real-time refresh
  const [lastAvailabilityParams, setLastAvailabilityParams] = useState<{
    date: Date;
    partySize: number;
  } | null>(null);

  // NEW: Fetch available time slots using the new availability service
  const fetchAvailableSlots = useCallback(
    async (date: Date, partySize: number) => {
      if (!restaurantId || !restaurant) return;

      setLoadingSlots(true);
      // Store params for real-time refresh
      setLastAvailabilityParams({ date, partySize });

      try {
        const slots = await availabilityService.getAvailableSlots(
          restaurantId,
          date,
          partySize,
          profile?.id,
        );

        setAvailableSlots(slots);
      } catch (error) {
        console.error("Error fetching available slots:", error);
        Alert.alert("Error", "Failed to load available time slots");
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [restaurantId, restaurant, availabilityService, profile?.id],
  );

  // Main data fetching with retry logic for cold start scenarios
  const fetchRestaurantDetails = useCallback(
    async (retryCount = 0) => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      // If database isn't ready yet and this is the first attempt, wait a bit and retry
      if (!databaseReady && retryCount === 0) {
        console.log("Database not ready yet, scheduling retry in 2 seconds...");
        setTimeout(() => {
          fetchRestaurantDetails(1);
        }, 2000);
        return;
      }

      try {
        console.log(
          `Fetching restaurant details for ID: ${restaurantId} (attempt ${retryCount + 1})`,
        );

        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", restaurantId)
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

        // Check if restaurant is favorited
        if (profile?.id) {
          const { data: favoriteData } = await supabase
            .from("favorites")
            .select("id")
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId)
            .single();

          setIsFavorite(!!favoriteData);
        }

        // Fetch reviews with user details
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("reviews")
          .select(
            `
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `,
          )
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(20);

        // Filter out reviews from blocked users client-side if user is authenticated
        let filteredReviews = reviewsData || [];
        if (profile?.id && reviewsData) {
          // Get blocked user IDs
          const { data: blockedData } = await supabase
            .from("blocked_users")
            .select("blocked_id")
            .eq("blocker_id", profile.id);

          if (blockedData?.length) {
            const blockedUserIds = new Set(
              blockedData.map((b) => b.blocked_id),
            );
            filteredReviews = reviewsData.filter(
              (review) => !blockedUserIds.has(review.user_id),
            );
          }
        }

        if (reviewsError) {
          console.warn("Reviews fetch error:", reviewsError);
        } else {
          console.log(
            "Reviews fetched:",
            filteredReviews.length,
            "filtered from",
            reviewsData?.length || 0,
          );
          setReviews(filteredReviews);

          // Calculate review summary from filtered reviews data
          const calculatedSummary = calculateReviewSummary(filteredReviews);
          if (calculatedSummary) {
            const updatedRestaurant = {
              ...restaurantData,
              review_summary: calculatedSummary,
              average_rating: calculatedSummary.average_rating,
              total_reviews: calculatedSummary.total_reviews,
            };
            setRestaurant(updatedRestaurant);
          } else {
            // No reviews returned: preserve any existing aggregates on the restaurant row
            const preservedAverage =
              (restaurantData as any).average_rating ?? 0;
            const preservedTotal = (restaurantData as any).total_reviews ?? 0;

            const updatedRestaurant = {
              ...restaurantData,
              review_summary: null,
              average_rating: preservedAverage,
              total_reviews: preservedTotal,
            };
            setRestaurant(updatedRestaurant);
          }
        }

        // Success - set loading to false
        setLoading(false);
      } catch (error) {
        console.error(
          `Error fetching restaurant details (attempt ${retryCount + 1}):`,
          error,
        );

        // Retry logic for cold start scenarios (up to 3 attempts)
        if (retryCount < 2) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s exponential backoff
          console.log(`⏱️  Retrying restaurant fetch in ${delay}ms...`);

          setTimeout(() => {
            fetchRestaurantDetails(retryCount + 1);
          }, delay);
          return; // Don't set loading to false yet
        }

        // Final failure after all retries
        Alert.alert("Error", "Failed to load restaurant details");
        setLoading(false);
      }
    },
    [restaurantId, profile?.id, calculateReviewSummary, databaseReady],
  );

  // Action handlers
  const toggleFavorite = useCallback(async () => {
    if (!profile?.id || !restaurant || !restaurantId) return;

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profile.id)
          .eq("restaurant_id", restaurantId);

        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: profile.id,
          restaurant_id: restaurantId,
        });

        if (error) throw error;
        setIsFavorite(true);
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Error", "Failed to update favorite status");
    }
  }, [profile?.id, restaurant, isFavorite, restaurantId]);

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

  const handleBooking = useCallback(
    (selectedDate: Date, selectedTime: string, partySize: number) => {
      if (!selectedTime) {
        Alert.alert("Select Time", "Please select a time for your reservation");
        return;
      }

      if (!restaurantId || !restaurant) {
        Alert.alert("Error", "Restaurant information is not available");
        return;
      }

      // Find the selected slot to get table information
      const selectedSlot = availableSlots.find(
        (slot) => slot.time === selectedTime,
      );

      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: restaurantId,
          restaurantName: restaurant.name,
          date: selectedDate.toISOString(),
          time: selectedTime,
          partySize: partySize.toString(),
          // NEW: Pass table information if available
          tableIds: selectedSlot?.tables
            ? JSON.stringify(selectedSlot.tables.map((t) => t.id))
            : undefined,
          requiresCombination: selectedSlot?.requiresCombination
            ? "true"
            : "false",
        },
      });
    },
    [restaurantId, restaurant, router, availableSlots],
  );

  const navigateToCreateReview = useCallback(() => {
    if (!restaurantId || !restaurant) return;

    router.push({
      pathname: "/review/create",
      params: {
        restaurantId: restaurantId,
        restaurantName: restaurant.name,
      },
    });
  }, [restaurantId, restaurant, router]);

  // Initialize data fetch
  useEffect(() => {
    fetchRestaurantDetails();
  }, [fetchRestaurantDetails]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`restaurant:${restaurantId}:availability`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          // Refresh available slots when a booking is made/cancelled
          if (lastAvailabilityParams) {
            fetchAvailableSlots(
              lastAvailabilityParams.date,
              lastAvailabilityParams.partySize,
            );
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [restaurantId, lastAvailabilityParams, fetchAvailableSlots]);

  return {
    // Data
    restaurant,
    reviews,
    isFavorite,
    loading,
    availableSlots,
    loadingSlots,

    // Actions
    toggleFavorite,
    handleShare,
    handleBooking,
    navigateToCreateReview,
    refresh: fetchRestaurantDetails,

    // Helper functions
    extractLocationCoordinates,
    isRestaurantOpen,
    getDistanceText,
    handleCall,
    handleWhatsApp,
    openDirections,
    generateTimeSlots,
    fetchAvailableSlots,
  };
}
