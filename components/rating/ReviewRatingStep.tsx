import React from "react";
import { View, Pressable } from "react-native";
import { ThumbsUp, Sparkles, Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

// Interactive rating component for touch selection
const InteractiveRating: React.FC<{
  rating: number;
  onRatingChange: (rating: number) => void;
  size: number;
}> = ({ rating, onRatingChange, size }) => {
  return (
    <View className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => {
            onRatingChange(star);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          className="p-1"
        >
          <Star
            size={size}
            color="#FFD700"
            fill={star <= rating ? "#FFD700" : "transparent"}
          />
        </Pressable>
      ))}
    </View>
  );
};

// Get rating label
const getRatingLabel = (rating: number): string => {
  switch (rating) {
    case 1:
      return "Poor";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Very Good";
    case 5:
      return "Excellent";
    default:
      return "";
  }
};

interface ReviewRatingStepProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  recommendToFriend: boolean;
  onRecommendChange: (recommend: boolean) => void;
  visitAgain: boolean;
  onVisitAgainChange: (visitAgain: boolean) => void;
}

export const ReviewRatingStep: React.FC<ReviewRatingStepProps> = ({
  rating,
  onRatingChange,
  recommendToFriend,
  onRecommendChange,
  visitAgain,
  onVisitAgainChange,
}) => {
  return (
    <View className="items-center py-8">
      <H3 className="mb-6 text-center">Rate Your Overall Experience</H3>

      <InteractiveRating
        rating={rating}
        onRatingChange={onRatingChange}
        size={48}
      />

      {rating > 0 && (
        <View className="mt-2">
          <Text className="text-center text-lg font-semibold text-primary">
            {getRatingLabel(rating)}
          </Text>
        </View>
      )}

      {rating > 0 && (
        <View className="mt-8 w-full gap-3">
          <Button
            variant={recommendToFriend ? "default" : "outline"}
            onPress={() => {
              onRecommendChange(!recommendToFriend);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="w-full"
          >
            <ThumbsUp size={20} />
            <Text>I'd recommend this to friends</Text>
          </Button>

          <Button
            variant={visitAgain ? "default" : "outline"}
            onPress={() => {
              onVisitAgainChange(!visitAgain);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="w-full"
          >
            <Sparkles size={20} />
            <Text>I'll definitely visit again</Text>
          </Button>
        </View>
      )}
    </View>
  );
};
