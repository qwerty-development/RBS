import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";
import {
  getBlockedUserIds,
  addBlockedUsersFilter,
} from "@/utils/blockingUtils";

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

export const useRestaurantReviews = (restaurantId: string) => {
  const { profile } = useAuth();
  const router = useRouter();

  // State management
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSort, setSelectedSort] = useState("recent");
  const [selectedRating, setSelectedRating] = useState("all");

  // Fetch data
  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
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
          .single();

        if (restaurantError) throw restaurantError;
        setRestaurant(restaurantData);

        // Build reviews query - fetch reviews without user details first
        let reviewsQuery = supabase
          .from("reviews")
          .select("*")
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

        // Filter out blocked users on client side
        let filteredReviews = reviewsData || [];
        if (profile?.id) {
          const blockedUserIds = await getBlockedUserIds(profile.id);
          filteredReviews = filteredReviews.filter(
            (review) => !blockedUserIds.includes(review.user_id),
          );
        }

        // Fetch user profile info using RPC function
        let reviewsWithUserInfo = filteredReviews;
        if (filteredReviews.length > 0) {
          const userIds = filteredReviews.map((review) => review.user_id);
          const { data: userProfilesData, error: profilesError } =
            await supabase.rpc("get_public_profile_info", {
              user_ids: userIds,
            });

          if (!profilesError && userProfilesData) {
            // Create a map for quick lookup
            const profilesMap = new Map(
              userProfilesData.map(
                (profile: {
                  user_id: string;
                  full_name: string;
                  avatar_url: string | null;
                }) => [profile.user_id, profile],
              ),
            );

            // Add user info to reviews
            reviewsWithUserInfo = filteredReviews.map((review) => ({
              ...review,
              user: profilesMap.get(review.user_id) || {
                full_name: "Anonymous",
                avatar_url: null,
              },
            }));
          } else {
            console.warn("Error fetching user profiles:", profilesError);
            // Fallback: add anonymous user info
            reviewsWithUserInfo = filteredReviews.map((review) => ({
              ...review,
              user: {
                full_name: "Anonymous",
                avatar_url: null,
              },
            }));
          }
        }

        setReviews(reviewsWithUserInfo);
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

  const handleDeleteReview = useCallback(
    async (reviewId: string) => {
      if (!profile?.id) {
        Alert.alert("Sign In Required", "Please sign in to delete a review");
        return;
      }

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const { error } = await supabase
          .from("reviews")
          .delete()
          .eq("id", reviewId)
          .eq("user_id", profile.id);

        if (error) {
          console.error("Error deleting review:", error);
          Alert.alert(
            "Unable to delete",
            "We couldn't delete your review right now. Please try again.",
          );
          return;
        }

        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      } catch (err) {
        console.error("Error in handleDeleteReview:", err);
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    },
    [profile?.id],
  );

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

      const reviewedBookingIds = new Set(
        existingReviews?.map((r) => r.booking_id) || [],
      );
      const unreviewed = bookings.filter((b) => !reviewedBookingIds.has(b.id));

      if (unreviewed.length === 0) {
        Alert.alert(
          "Already Reviewed",
          "You have already reviewed all your visits to this restaurant.",
          [{ text: "OK" }],
        );
        return;
      }

      if (unreviewed.length === 1) {
        // Single booking - go straight to review
        router.push({
          pathname: "/review/create",
          params: {
            bookingId: unreviewed[0].id,
            restaurantId: restaurantId,
            restaurantName: restaurant?.name || "",
          },
        });
      } else {
        // Multiple bookings - let user choose
        const options = unreviewed.map((booking) => ({
          text: `${new Date(booking.booking_time).toLocaleDateString()} - Party of ${booking.party_size}`,
          onPress: () => {
            router.push({
              pathname: "/review/create",
              params: {
                bookingId: booking.id,
                restaurantId: restaurantId,
                restaurantName: restaurant?.name || "",
              },
            });
          },
        }));

        Alert.alert(
          "Choose Visit to Review",
          "Which visit would you like to review?",
          [
            { text: "Cancel", style: "cancel" },
            ...options.slice(0, 3), // Limit to 3 most recent
          ],
        );
      }
    } catch (error) {
      console.error("Error in handleWriteReview:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  }, [profile, router, restaurantId, restaurant]);

  // Filter handlers
  const handleSortChange = useCallback((sort: string) => {
    setSelectedSort(sort);
  }, []);

  const handleRatingChange = useCallback((rating: string) => {
    setSelectedRating(rating);
  }, []);

  const handleFilterToggle = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  const handleFilterClose = useCallback(() => {
    setShowFilters(false);
  }, []);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Effects
  useEffect(() => {
    if (restaurantId) {
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [selectedSort, selectedRating]);

  // Real-time subscription for reviews
  useEffect(() => {
    if (!restaurantId) return;

    const unsubscribe = realtimeSubscriptionService.subscribeToRestaurant({
      restaurantId,
      onReviewChange: (payload) => {
        // For any review change, refetch the data to maintain consistency
        // This ensures we have the complete Review type with user data
        fetchData(true);
      },
    });

    return unsubscribe;
  }, [restaurantId, fetchData]);

  // Filtered and sorted reviews
  const displayReviews = useMemo(() => {
    let filtered = [...reviews];

    // Apply additional filters based on selection
    if (selectedSort === "photos") {
      filtered = filtered.filter(
        (review) => review.photos && review.photos.length > 0,
      );
    }

    return filtered;
  }, [reviews, selectedSort]);

  // Computed values
  const hasFilters = selectedSort !== "recent" || selectedRating !== "all";

  return {
    // Data
    restaurant,
    reviews: displayReviews,

    // Loading states
    loading,
    refreshing,

    // Filter state
    showFilters,
    selectedSort,
    selectedRating,
    hasFilters,

    // Constants
    FILTER_OPTIONS,
    RATING_FILTER_OPTIONS,

    // Handlers
    handleLikeReview,
    handleWriteReview,
    handleDeleteReview,
    handleSortChange,
    handleRatingChange,
    handleFilterToggle,
    handleFilterClose,
    handleRefresh,
  };
};
