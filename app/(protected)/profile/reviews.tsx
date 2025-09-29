import { supabase } from "@/config/supabase";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Card } from "@/components/ui/card";
import { ReviewsScreenSkeleton } from "@/components/skeletons/ReviewsScreenSkeleton";
import { Star, ChevronLeft, ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { BackHeader } from "@/components/ui/back-header";

interface Review {
  id: string;
  booking_id: string;
  user_id: string;
  restaurant_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const fetchReviews = async (id: string) => {
  if (!id) {
    return [];
  }

  try {
    const { data: reviews, error: errorReviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (errorReviews) {
      console.error("❌ Supabase error:", errorReviews);
      throw errorReviews;
    }

    return reviews;
  } catch (error) {
    console.error("❌ Error in fetchReviews:", error);
    throw error;
  }
};

export default function ReviewsPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const params = useLocalSearchParams();
  const userId = params.id as string;
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Log when the component renders and when ID changes
  useEffect(() => {}, [userId, params]);

  useEffect(() => {
    const loadReviews = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await fetchReviews(userId);

        setReviews(data);
      } catch (error) {
        console.error("❌ Error in loadReviews:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReviews();
  }, [userId]);

  const renderStars = (rating: number) => {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <Star
          key={index}
          size={16}
          fill={index < rating ? "#FFD700" : "none"}
          color={index < rating ? "#FFD700" : isDark ? "#666" : "#D3D3D3"}
        />
      ));
  };

  if (isLoading) {
    return <ReviewsScreenSkeleton />;
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#000" : "#f5f5f5" },
      ]}
    >
      <BackHeader title="Your Reviews" />

      <ScrollView style={styles.content}>
        {reviews.length === 0 ? (
          <Text style={[styles.noReviews, { color: isDark ? "#999" : "#666" }]}>
            No reviews yet
          </Text>
        ) : (
          reviews.map((review) => (
            <Card
              key={review.id}
              style={[
                styles.reviewCard,
                { backgroundColor: isDark ? "#1a1a1a" : "#fff" },
              ]}
            >
              <View style={styles.ratingContainer}>
                {renderStars(review.rating)}
              </View>
              {review.comment && (
                <Text
                  style={[styles.comment, { color: isDark ? "#fff" : "#000" }]}
                >
                  {review.comment}
                </Text>
              )}
              <Text style={[styles.date, { color: isDark ? "#999" : "#666" }]}>
                {new Date(review.created_at).toLocaleDateString()}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header styles removed in favor of BackHeader component
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  comment: {
    fontSize: 16,
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
  },
  noReviews: {
    textAlign: "center",
    fontSize: 16,
    marginTop: 32,
  },
});
