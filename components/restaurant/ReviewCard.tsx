import React from "react";
import { View, Pressable } from "react-native";
import { Star, ThumbsUp, MoreVertical } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";
import { Database } from "@/types/supabase";

// Enhanced review type with all new fields
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

interface ReviewCardProps {
  review: Review;
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export const ReviewCard = ({
  review,
  isOwner = false,
  onEdit,
  onDelete,
  showActions = true,
}: ReviewCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
      { label: "Food", value: review.food_rating },
      { label: "Service", value: review.service_rating },
      { label: "Ambiance", value: review.ambiance_rating },
      { label: "Value", value: review.value_rating },
    ].filter((r) => r.value && r.value > 0);

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
              <Text className="text-xs text-muted-foreground">
                {formatDate(review.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {showActions && isOwner && (
          <Pressable className="p-1">
            <MoreVertical size={16} color="#666" />
          </Pressable>
        )}
      </View>

      {/* Review Content */}
      {review.comment && (
        <Text className="text-sm leading-5 mb-3">{review.comment}</Text>
      )}

      {/* Detailed Ratings */}
      {renderDetailedRatings()}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {review.tags.map((tag, index) => (
            <View key={index} className="bg-primary/10 px-2 py-1 rounded-full">
              <Text className="text-xs text-primary font-medium">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Photos */}
      {review.photos && review.photos.length > 0 && (
        <View className="mt-3">
          <View className="flex-row gap-2">
            {review.photos.slice(0, 3).map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                className="w-20 h-20 rounded-lg"
                contentFit="cover"
              />
            ))}
            {review.photos.length > 3 && (
              <View className="w-20 h-20 rounded-lg bg-muted items-center justify-center">
                <Text className="text-xs text-muted-foreground">
                  +{review.photos.length - 3}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Footer with recommendations */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-border">
        <View className="flex-row gap-4">
          {review.recommend_to_friend && (
            <View className="flex-row items-center gap-1">
              <ThumbsUp size={14} color="#10b981" />
              <Text className="text-xs text-green-600">Recommends</Text>
            </View>
          )}
          {review.visit_again && (
            <Text className="text-xs text-muted-foreground">
              Would visit again
            </Text>
          )}
        </View>

        {showActions && (
          <Text className="text-xs text-muted-foreground">Helpful?</Text>
        )}
      </View>
    </View>
  );
};
