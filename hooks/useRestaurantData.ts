import { useState, useCallback, useEffect } from "react";
import { Alert, Share } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface TimeSlot {
  time: string;
  available: boolean;
  availableCapacity: number;
}

interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  location?: any;
  main_image_url: string;
  image_urls?: string[] | null;
  cuisine_type: string;
  tags?: string[] | null;
  opening_time: string;
  closing_time: string;
  booking_policy: "instant" | "request";
  price_range: number;
  average_rating?: number;
  total_reviews?: number;
  phone_number?: string | null;
  whatsapp_number?: string | null;
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
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: {
    full_name: string;
    avatar_url?: string;
  };
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  value_rating?: number;
  recommend_to_friend?: boolean;
  visit_again?: boolean;
  tags?: string[];
  photos?: string[];
}

export const useRestaurantData = (
  id: string | undefined,
  generateTimeSlots: (
    openTime: string,
    closeTime: string,
    intervalMinutes?: number
  ) => { time: string }[]
) => {
  const router = useRouter();
  const { profile } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

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

      // Check if restaurant is favorited
      if (profile?.id) {
        const { data: favoriteData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", profile.id)
          .eq("restaurant_id", id)
          .single();

        setIsFavorite(!!favoriteData);
      }

      // Fetch reviews with user details and expanded data
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
  }, [id, profile?.id, calculateReviewSummary]);

  const fetchAvailableSlots = useCallback(
    async (selectedDate: Date, partySize: number) => {
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
    },
    [restaurant, id, generateTimeSlots]
  );

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
    },
    [id, restaurant, router]
  );

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
            onPress: () => {}, // This would need to be handled by the parent component
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

  // Lifecycle management
  useEffect(() => {
    if (id) {
      fetchRestaurantDetails();
    }
  }, [fetchRestaurantDetails, id]);

  return {
    restaurant,
    reviews,
    isFavorite,
    loading,
    availableSlots,
    loadingSlots,
    fetchAvailableSlots,
    toggleFavorite,
    handleShare,
    handleBooking,
    navigateToCreateReview,
  };
};
