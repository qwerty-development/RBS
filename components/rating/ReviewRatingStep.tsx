import React from "react";
import { View } from "react-native";
import { ThumbsUp, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { UserRating } from "./UserRating";

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

      <UserRating
        rating={rating}
        onRatingChange={onRatingChange}
        size={48}
        showLabel
      />

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
