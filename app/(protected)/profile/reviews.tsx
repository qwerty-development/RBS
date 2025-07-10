import { supabase } from "@/config/supabase";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Card } from "@/components/ui/card";
import { ReviewsScreenSkeleton } from '@/components/skeletons/ReviewsScreenSkeleton';
import { Star, ChevronLeft } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";

interface Review {
    id: string;
    booking_id: string;
    user_id: string;
    restaurant_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  };

const fetchReviews = async (id: string) => {
    console.log("=== Fetch Reviews Function ===");
    console.log("Attempting to fetch reviews with ID:", id);
    console.log("ID type:", typeof id);
    
    if (!id) {
        console.log("❌ No user ID provided");
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
      
        console.log("✅ Successfully fetched reviews:");
        console.log("Number of reviews:", reviews?.length);
        console.log("Reviews data:", JSON.stringify(reviews, null, 2));
        return reviews;
    } catch (error) {
        console.error("❌ Error in fetchReviews:", error);
        throw error;
    }
}

export default function ReviewsPage() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const params = useLocalSearchParams();
    const userId = params.id as string;
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";

    // Log when the component renders and when ID changes
    useEffect(() => {
        console.log("=== Component Render ===");
        console.log("Current ID from params:", userId);
        console.log("ID type:", typeof userId);
        console.log("All params:", params);
    }, [userId, params]);

    useEffect(() => {
        const loadReviews = async () => {
            console.log("=== Load Reviews Effect ===");
            console.log("ID available:", !!userId);
            
            if (!userId) {
                console.log("❌ No ID available yet");
                setIsLoading(false);
                return;
            }

            try {
                console.log("🔄 Starting to fetch reviews...");
                setIsLoading(true);
                const data = await fetchReviews(userId);
                console.log("✅ Setting reviews state with data");
                setReviews(data);
            } catch (error) {
                console.error("❌ Error in loadReviews:", error);
            } finally {
                setIsLoading(false);
                console.log("🏁 Finished loading reviews");
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
        <SafeAreaView style={[styles.container, { backgroundColor: isDark ? "#000" : "#f5f5f5" }]}>
            <View style={[styles.header, { backgroundColor: isDark ? "#1a1a1a" : "#fff" }]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={isDark ? "#fff" : "#000"} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#000" }]}>Your Reviews</Text>
            </View>
            
            <ScrollView style={styles.content}>
                {reviews.length === 0 ? (
                    <Text style={[styles.noReviews, { color: isDark ? "#999" : "#666" }]}>No reviews yet</Text>
                ) : (
                    reviews.map((review) => (
                        <Card key={review.id} style={[styles.reviewCard, { backgroundColor: isDark ? "#1a1a1a" : "#fff" }]}>
                            <View style={styles.ratingContainer}>
                                {renderStars(review.rating)}
                            </View>
                            {review.comment && (
                                <Text style={[styles.comment, { color: isDark ? "#fff" : "#000" }]}>{review.comment}</Text>
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
    },
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



