import React from "react";
import { ScrollView, View } from "react-native";

import { Muted } from "@/components/ui/typography";
import { UserRating } from "./UserRating";

interface DetailedRatings {
  food: number;
  service: number;
  ambiance: number;
  value: number;
}

interface DetailedRatingsStepProps {
  ratings: DetailedRatings;
  onRatingsChange: (ratings: DetailedRatings) => void;
  onIndividualRatingChange?: (
    category: keyof DetailedRatings,
    rating: number
  ) => void;
}

export const DetailedRatingsStep: React.FC<DetailedRatingsStepProps> = ({
  ratings,
  onRatingsChange,
  onIndividualRatingChange,
}) => {
  const handleRatingChange = (
    category: keyof DetailedRatings,
    rating: number
  ) => {
    const newRatings = { ...ratings, [category]: rating };
    onRatingsChange(newRatings);
    onIndividualRatingChange?.(category, rating);
  };

  const ratingCategories = [
    {
      key: "food" as keyof DetailedRatings,
      label: "Food Quality",
      description: "Taste, presentation, authenticity",
    },
    {
      key: "service" as keyof DetailedRatings,
      label: "Service",
      description: "Staff friendliness, speed, attentiveness",
    },
    {
      key: "ambiance" as keyof DetailedRatings,
      label: "Ambiance",
      description: "Atmosphere, decor, noise level",
    },
    {
      key: "value" as keyof DetailedRatings,
      label: "Value for Money",
      description: "Portion size, pricing, overall value",
    },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="py-4">
      <View className="gap-6">
        {ratingCategories.map(({ key, label, description }) => (
          <View key={key}>
            <UserRating
              rating={ratings[key]}
              onRatingChange={(rating) => handleRatingChange(key, rating)}
              label={label}
              showLabel={false}
            />
            <Muted className="text-sm mt-1">{description}</Muted>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
