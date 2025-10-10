import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  review_summary?: {
    average_rating: number;
    total_reviews: number;
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

type ReviewReply = Database["public"]["Tables"]["review_replies"]["Row"] & {
  replied_by_profile: {
    full_name: string;
    avatar_url?: string | null;
  };
  restaurant: {
    name: string;
    main_image_url?: string | null;
  };
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
  food_rating?: number | null;
  service_rating?: number | null;
  ambiance_rating?: number | null;
  value_rating?: number | null;
  recommend_to_friend?: boolean | null;
  visit_again?: boolean | null;
  tags?: string[] | null;
  photos?: string[] | null;
  replies?: ReviewReply[];
};

// Filter options
const FILTER_OPTIONS = [
  { id: "all", label: "All Reviews" },
  { id: "recent", label: "Most Recent" },
  { id: "highest", label: "Highest Rated" },
  { id: "lowest", label: "Lowest Rated" },
  { id: "photos", label: "With Photos" },
  { id: "verified", label: "Verified Diners" },
];

const RATING_FILTER_OPTIONS = [
  { id: "all", label: "All Ratings" },
  { id: "5", label: "5 Stars" },
  { id: "4", label: "4 Stars" },
  { id: "3", label: "3 Stars" },
  { id: "2", label: "2 Stars" },
  { id: "1", label: "1 Star" },
];

export const useRestaurantReviewsWithReplies = (restaurantId: string) => {
  const { profile } = useAuth();
  const router = useRouter();

  // State
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSort, setSelectedSort] = useState("recent");
  const [selectedRating, setSelectedRating] = useState("all");

  // Fetch reviews with replies
  const fetchData = useCallback(
    async (isRefreshing = false) => {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        // Fetch restaurant
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", restaurantId)
          .eq("status", "active")
          .single();

        if (restaurantError) throw restaurantError;
        setRestaurant(restaurantData);

        // Build reviews query with replies
        let reviewsQuery = supabase
          .from("reviews")
          .select(
            `
          *,
          user:profiles!inner (
            full_name,
            avatar_url
          ),
          replies:review_replies (
            *,
            replied_by_profile:profiles!replied_by (
              full_name,
              avatar_url
            ),
            restaurant:restaurants!restaurant_id (
              name,
              main_image_url
            )
          )
        `,
          )
          .eq("restaurant_id", restaurantId);

        // Apply rating filter
        if (selectedRating !== "all") {
          reviewsQuery = reviewsQuery.eq("rating", parseInt(selectedRating));
        }

        // Apply sorting
        switch (selectedSort) {
          case "recent":
            reviewsQuery = reviewsQuery.order("created_at", {
              ascending: false,
            });
            break;
          case "highest":
            reviewsQuery = reviewsQuery.order("rating", {
              ascending: false,
            });
            break;
          case "lowest":
            reviewsQuery = reviewsQuery.order("rating", {
              ascending: true,
            });
            break;
          case "photos":
            reviewsQuery = reviewsQuery.not("photos", "is", null);
            reviewsQuery = reviewsQuery.order("created_at", {
              ascending: false,
            });
            break;
          case "verified":
            // This would need additional logic to verify diners
            reviewsQuery = reviewsQuery.order("created_at", {
              ascending: false,
            });
            break;
          default:
            reviewsQuery = reviewsQuery.order("created_at", {
              ascending: false,
            });
        }

        const { data: reviewsData, error: reviewsError } =
          await reviewsQuery.limit(50);

        if (reviewsError) throw reviewsError;
        setReviews(reviewsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        Alert.alert("Error", "Failed to load reviews");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [restaurantId, selectedSort, selectedRating],
  );

  // Event handlers
  const handleLikeReview = useCallback(async (reviewId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Implementation for liking reviews
    } catch (error) {
      console.error("Error liking review:", error);
    }
  }, []);

  const handleWriteReview = useCallback(async () => {
    if (!profile?.id) {
      Alert.alert("Sign In Required", "Please sign in to write a review");
      return;
    }

    try {
      // Find user's completed bookings for this restaurant
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, booking_time, party_size, status")
        .eq("user_id", profile.id)
        .eq("restaurant_id", restaurantId)
        .eq("status", "completed")
        .order("booking_time", { ascending: false });

      if (error) {
        console.error("Error fetching bookings:", error);
        Alert.alert("Error", "Failed to check your booking history");
        return;
      }

      if (!bookings || bookings.length === 0) {
        Alert.alert(
          "No Completed Visits",
          "You can only review restaurants you have visited. Please complete a booking first.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Book Table",
              onPress: () => {
                router.push({
                  pathname: "/booking/availability",
                  params: {
                    restaurantId: restaurantId,
                    restaurantName: restaurant?.name || "",
                  },
                });
              },
            },
          ],
        );
        return;
      }

      // Check if any of these bookings already have reviews
      const { data: existingReviews, error: reviewError } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("user_id", profile.id)
        .in(
          "booking_id",
          bookings.map((b) => b.id),
        );

      if (reviewError) {
        console.error("Error checking existing reviews:", reviewError);
        Alert.alert("Error", "Failed to check existing reviews");
        return;
      }

      const reviewedBookingIds =
        existingReviews?.map((r) => r.booking_id) || [];
      const unReviewedBookings = bookings.filter(
        (b) => !reviewedBookingIds.includes(b.id),
      );

      if (unReviewedBookings.length === 0) {
        Alert.alert(
          "All Visits Reviewed",
          "You have already reviewed all your completed visits to this restaurant.",
        );
        return;
      }

      // Navigate to review screen with the most recent unreviewedBooking
      const latestBooking = unReviewedBookings[0];
      router.push({
        pathname: "/review/create",
        params: {
          restaurantId: restaurantId,
          bookingId: latestBooking.id,
          restaurantName: restaurant?.name || "",
        },
      });
    } catch (error) {
      console.error("Error in handleWriteReview:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  }, [profile?.id, restaurant?.name, restaurantId, router]);

  // Computed values
  const filteredReviews = useMemo(() => {
    return reviews; // Already filtered in the query
  }, [reviews]);

  const reviewStats = useMemo(() => {
    if (!reviews.length) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: [0, 0, 0, 0, 0],
        photoCount: 0,
        verifiedCount: 0,
      };
    }

    const total = reviews.length;
    const average =
      reviews.reduce((sum, review) => sum + review.rating, 0) / total;

    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach((review) => {
      distribution[review.rating - 1]++;
    });

    const photoCount = reviews.filter(
      (r) => r.photos && r.photos.length > 0,
    ).length;
    const verifiedCount = total; // All reviews are verified in this app

    return {
      averageRating: Number(average.toFixed(1)),
      totalReviews: total,
      ratingDistribution: distribution,
      photoCount,
      verifiedCount,
    };
  }, [reviews]);

  // Effects
  useEffect(() => {
    if (restaurantId) {
      fetchData();
    }
  }, [fetchData, restaurantId]);

  const onRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return {
    // Data
    restaurant,
    reviews: filteredReviews,
    reviewStats,

    // State
    loading,
    refreshing,
    selectedSort,
    selectedRating,

    // Actions
    setSelectedSort,
    setSelectedRating,
    onRefresh,
    handleLikeReview,
    handleWriteReview,

    // Constants
    filterOptions: FILTER_OPTIONS,
    ratingFilterOptions: RATING_FILTER_OPTIONS,
  };
};
