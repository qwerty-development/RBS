// app/(protected)/restaurant/[id]/reviews.tsx
import React from "react";
import {
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useRestaurantReviews } from "@/hooks/useRestaurantReviews";
import {
  ReviewsHeader,
  ReviewsActiveFilters,
  ReviewsEmptyState,
  ReviewsWriteButton,
  ReviewsFilterModal,
  ReviewCard,
  ReviewSummary,
} from "@/components/restaurant";

export default function RestaurantReviewsScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const params = useLocalSearchParams<{ id: string }>();
  const restaurantId = params?.id;

  const {
    restaurant,
    reviews,
    loading,
    refreshing,
    showFilters,
    selectedSort,
    selectedRating,
    hasFilters,
    FILTER_OPTIONS,
    RATING_FILTER_OPTIONS,
    handleLikeReview,
    handleReportReview,
    handleWriteReview,
    handleSortChange,
    handleRatingChange,
    handleFilterToggle,
    handleFilterClose,
    handleRefresh,
  } = useRestaurantReviews(restaurantId!);

  if (loading && !restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <ReviewsHeader
        restaurantName={restaurant.name}
        onBack={() => router.back()}
        onFilter={handleFilterToggle}
      />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          {/* Review Summary */}
          {restaurant.review_summary && (
            <ReviewSummary reviewSummary={restaurant.review_summary} />
          )}

          {/* Active Filters */}
          <ReviewsActiveFilters
            selectedSort={selectedSort}
            selectedRating={selectedRating}
            filterOptions={FILTER_OPTIONS}
            ratingFilterOptions={RATING_FILTER_OPTIONS}
          />

          {/* Reviews List */}
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onLike={() => handleLikeReview(review.id)}
                onReport={() => handleReportReview(review.id)}
              />
            ))
          ) : (
            <ReviewsEmptyState hasFilters={hasFilters} />
          )}
        </View>
      </ScrollView>

      {/* Write Review Button */}
      <ReviewsWriteButton onPress={handleWriteReview} />

      {/* Filter Modal */}
      <ReviewsFilterModal
        visible={showFilters}
        onClose={handleFilterClose}
        selectedSort={selectedSort}
        onSortChange={handleSortChange}
        selectedRating={selectedRating}
        onRatingChange={handleRatingChange}
        filterOptions={FILTER_OPTIONS}
        ratingFilterOptions={RATING_FILTER_OPTIONS}
      />
    </SafeAreaView>
  );
}
