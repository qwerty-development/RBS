// app/(protected)/restaurant/[id]/reviews.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Star,
  TrendingUp,
  Filter,
  MessageSquare,
  ThumbsUp,
  Calendar,
  User,
  Camera,
  MoreHorizontal,
  Flag,
  Heart,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
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

// Review Summary Component
const ReviewSummaryCard: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => {
  const summary = restaurant.review_summary;
  
  if (!summary) return null;

  const ratingDistribution = summary.rating_distribution || {};
  const totalReviews = summary.total_reviews || 0;
  
  return (
    <View className="bg-card border border-border rounded-xl p-6 mb-4">
      {/* Overall Rating */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="items-center">
          <Text className="text-4xl font-bold mb-2">{summary.average_rating.toFixed(1)}</Text>
          <View className="flex-row mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                color="#f59e0b"
                fill={star <= summary.average_rating ? "#f59e0b" : "none"}
              />
            ))}
          </View>
          <Text className="text-sm text-muted-foreground">
            {totalReviews.toLocaleString()} reviews
          </Text>
        </View>

        <View className="flex-1 ml-6">
          <Text className="font-semibold mb-3">Rating Breakdown</Text>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = ratingDistribution[rating.toString()] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            
            return (
              <View key={rating} className="flex-row items-center gap-2 mb-1">
                <Text className="text-sm w-2">{rating}</Text>
                <Star size={12} color="#f59e0b" fill="#f59e0b" />
                <View className="flex-1 bg-muted rounded-full h-2">
                  <View 
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </View>
                <Text className="text-xs text-muted-foreground w-8">
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Detailed Ratings */}
      <View className="border-t border-border pt-4">
        <Text className="font-semibold mb-3">Detailed Ratings</Text>
        <View className="grid grid-cols-2 gap-4">
          {Object.entries(summary.detailed_ratings).map(([key, value]) => {
            const label = key.replace('_avg', '').replace(/^./, str => str.toUpperCase());
            return (
              <View key={key} className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{label}</Text>
                <View className="flex-row items-center gap-1">
                  <Text className="font-medium">{value.toFixed(1)}</Text>
                  <Star size={12} color="#f59e0b" fill="#f59e0b" />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Recommendation */}
      <View className="border-t border-border pt-4 mt-4">
        <View className="flex-row items-center gap-2">
          <ThumbsUp size={16} color="#10b981" />
          <Text className="text-sm">
            <Text className="font-semibold">{summary.recommendation_percentage}%</Text>
            <Text className="text-muted-foreground"> of diners recommend this restaurant</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

// Individual Review Card Component
const ReviewCard: React.FC<{
  review: Review;
  onLike: () => void;
  onReport: () => void;
  currentUserId?: string;
}> = ({ review, onLike, onReport, currentUserId }) => {
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const isOwnReview = currentUserId === review.user_id;

  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-4">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
            {review.user.avatar_url ? (
              <Image
                source={{ uri: review.user.avatar_url }}
                className="w-10 h-10 rounded-full"
                contentFit="cover"
              />
            ) : (
              <Text className="font-medium text-primary">
                {review.user.full_name.charAt(0)}
              </Text>
            )}
          </View>
          <View>
            <Text className="font-medium">{review.user.full_name}</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    color="#f59e0b"
                    fill={star <= review.overall_rating ? "#f59e0b" : "none"}
                  />
                ))}
              </View>
              <Text className="text-xs text-muted-foreground">
                {formatDate(review.created_at)}
              </Text>
            </View>
          </View>
        </View>

        <Pressable onPress={onReport} className="p-1">
          <MoreHorizontal size={16} color="#666" />
        </Pressable>
      </View>

      {/* Review Content */}
      <Text className="text-muted-foreground leading-6 mb-3">
        {review.comment}
      </Text>

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {review.tags.map((tag, index) => (
            <View key={index} className="bg-muted/50 px-2 py-1 rounded-full">
              <Text className="text-xs text-muted-foreground">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <View className="flex-row gap-2 mb-3">
          {review.photos.slice(0, 3).map((photo, index) => (
            <Image
              key={index}
              source={{ uri: photo }}
              className="w-16 h-16 rounded-lg"
              contentFit="cover"
            />
          ))}
          {review.photos.length > 3 && (
            <View className="w-16 h-16 rounded-lg bg-muted/50 items-center justify-center">
              <Text className="text-xs text-muted-foreground">
                +{review.photos.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Detailed Ratings */}
      {(review.food_rating || review.service_rating || review.ambiance_rating || review.value_rating) && (
        <View className="border-t border-border pt-3 mb-3">
          <View className="flex-row flex-wrap gap-4">
            {review.food_rating && (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted-foreground">Food:</Text>
                <Text className="text-xs font-medium">{review.food_rating}</Text>
                <Star size={10} color="#f59e0b" fill="#f59e0b" />
              </View>
            )}
            {review.service_rating && (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted-foreground">Service:</Text>
                <Text className="text-xs font-medium">{review.service_rating}</Text>
                <Star size={10} color="#f59e0b" fill="#f59e0b" />
              </View>
            )}
            {review.ambiance_rating && (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted-foreground">Ambiance:</Text>
                <Text className="text-xs font-medium">{review.ambiance_rating}</Text>
                <Star size={10} color="#f59e0b" fill="#f59e0b" />
              </View>
            )}
            {review.value_rating && (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-muted-foreground">Value:</Text>
                <Text className="text-xs font-medium">{review.value_rating}</Text>
                <Star size={10} color="#f59e0b" fill="#f59e0b" />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center justify-between border-t border-border pt-3">
        <View className="flex-row items-center gap-4">
          {review.recommend_to_friend && (
            <View className="flex-row items-center gap-1">
              <ThumbsUp size={14} color="#10b981" />
              <Text className="text-xs text-green-600">Recommends</Text>
            </View>
          )}
          {review.visit_again && (
            <View className="flex-row items-center gap-1">
              <Heart size={14} color="#ef4444" />
              <Text className="text-xs text-red-600">Would visit again</Text>
            </View>
          )}
        </View>

        <Pressable onPress={onLike} className="flex-row items-center gap-1 p-2">
          <ThumbsUp size={14} color="#666" />
          <Text className="text-xs text-muted-foreground">Helpful</Text>
        </Pressable>
      </View>
    </View>
  );
};

// Filter Sheet Component
const FilterSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  selectedSort: string;
  onSortChange: (sort: string) => void;
  selectedRating: string;
  onRatingChange: (rating: string) => void;
}> = ({ visible, onClose, selectedSort, onSortChange, selectedRating, onRatingChange }) => {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/50 z-50">
      <Pressable onPress={onClose} className="flex-1" />
      <View className="bg-background rounded-t-3xl p-6">
        <View className="flex-row items-center justify-between mb-6">
          <H3>Filter Reviews</H3>
          <Pressable onPress={onClose}>
            <Text className="text-primary font-medium">Done</Text>
          </Pressable>
        </View>

        {/* Sort Options */}
        <View className="mb-6">
          <Text className="font-medium mb-3">Sort By</Text>
          <View className="gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onSortChange(option.id)}
                className={`p-3 rounded-lg border ${
                  selectedSort === option.id
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    selectedSort === option.id ? "text-primary font-medium" : ""
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Rating Filter */}
        <View>
          <Text className="font-medium mb-3">Filter by Rating</Text>
          <View className="gap-2">
            {RATING_FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onRatingChange(option.id)}
                className={`p-3 rounded-lg border ${
                  selectedRating === option.id
                    ? "bg-primary/10 border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={
                    selectedRating === option.id ? "text-primary font-medium" : ""
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default function RestaurantReviewsScreen() {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();
  
  const params = useLocalSearchParams<{ id: string }>();
  const restaurantId = params?.id;

  // State management
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSort, setSelectedSort] = useState("recent");
  const [selectedRating, setSelectedRating] = useState("all");

  // Fetch data
  const fetchData = useCallback(async (isRefresh = false) => {
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

      // Build reviews query
      let reviewsQuery = supabase
        .from("reviews")
        .select(`
          *,
          user:profiles!inner (
            full_name,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId);

      // Apply rating filter
      if (selectedRating !== "all") {
        reviewsQuery = reviewsQuery.eq("overall_rating", parseInt(selectedRating));
      }

      // Apply sorting
      switch (selectedSort) {
        case "recent":
          reviewsQuery = reviewsQuery.order("created_at", { ascending: false });
          break;
        case "highest":
          reviewsQuery = reviewsQuery.order("overall_rating", { ascending: false });
          break;
        case "lowest":
          reviewsQuery = reviewsQuery.order("overall_rating", { ascending: true });
          break;
        case "photos":
          reviewsQuery = reviewsQuery.not("photos", "is", null);
          break;
        case "verified":
          // This would need additional logic to verify diners
          reviewsQuery = reviewsQuery.order("created_at", { ascending: false });
          break;
        default:
          reviewsQuery = reviewsQuery.order("created_at", { ascending: false });
      }

      const { data: reviewsData, error: reviewsError } = await reviewsQuery.limit(50);

      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load reviews");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, selectedSort, selectedRating]);

  // Event handlers
  const handleLikeReview = useCallback(async (reviewId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Implementation for liking reviews
    } catch (error) {
      console.error("Error liking review:", error);
    }
  }, []);

  const handleReportReview = useCallback((reviewId: string) => {
    Alert.alert(
      "Report Review",
      "Why are you reporting this review?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Inappropriate content", onPress: () => {} },
        { text: "Spam", onPress: () => {} },
        { text: "Fake review", onPress: () => {} },
      ]
    );
  }, []);

  const handleWriteReview = useCallback(() => {
    if (!profile?.id) {
      Alert.alert("Sign In Required", "Please sign in to write a review");
      return;
    }

    router.push({
      pathname: "/review/create",
      params: {
        restaurantId: restaurantId!,
        restaurantName: restaurant?.name || "",
      },
    });
  }, [profile, router, restaurantId, restaurant]);

  // Effects
  useEffect(() => {
    if (restaurantId) {
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [selectedSort, selectedRating]);

  // Filtered and sorted reviews
  const displayReviews = useMemo(() => {
    let filtered = [...reviews];

    // Apply additional filters based on selection
    if (selectedSort === "photos") {
      filtered = filtered.filter(review => review.photos && review.photos.length > 0);
    }

    return filtered;
  }, [reviews, selectedSort]);

  if (loading && !restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground">Loading reviews...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text className="text-center font-semibold">Reviews</Text>
          <Muted className="text-center text-sm">{restaurant.name}</Muted>
        </View>
        <Pressable onPress={() => setShowFilters(true)} className="p-2">
          <Filter size={20} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          {/* Review Summary */}
          <ReviewSummaryCard restaurant={restaurant} />

          {/* Active Filters */}
          {(selectedSort !== "recent" || selectedRating !== "all") && (
            <View className="flex-row items-center gap-2 mb-4">
              <Text className="text-sm text-muted-foreground">Filters:</Text>
              {selectedSort !== "recent" && (
                <View className="bg-primary/10 px-2 py-1 rounded-full">
                  <Text className="text-primary text-xs font-medium">
                    {FILTER_OPTIONS.find(o => o.id === selectedSort)?.label}
                  </Text>
                </View>
              )}
              {selectedRating !== "all" && (
                <View className="bg-primary/10 px-2 py-1 rounded-full">
                  <Text className="text-primary text-xs font-medium">
                    {RATING_FILTER_OPTIONS.find(o => o.id === selectedRating)?.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Reviews List */}
          {displayReviews.length > 0 ? (
            displayReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onLike={() => handleLikeReview(review.id)}
                onReport={() => handleReportReview(review.id)}
                currentUserId={profile?.id}
              />
            ))
          ) : (
            <View className="py-12 items-center">
              <MessageSquare size={48} color="#666" />
              <H3 className="mt-4 text-center">No Reviews Found</H3>
              <Text className="text-center text-muted-foreground mt-2 px-8">
                {selectedSort !== "recent" || selectedRating !== "all"
                  ? "Try adjusting your filters to see more reviews."
                  : "Be the first to review this restaurant!"
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Write Review FAB */}
      <View className="absolute bottom-6 right-4">
        <Pressable
          onPress={handleWriteReview}
          className="w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
        >
          <MessageSquare size={24} color="white" />
        </Pressable>
      </View>

      {/* Filter Sheet */}
      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        selectedRating={selectedRating}
        onRatingChange={setSelectedRating}
      />
    </SafeAreaView>
  );
}