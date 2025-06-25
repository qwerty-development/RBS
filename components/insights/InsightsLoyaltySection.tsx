import React from "react";
import { View } from "react-native";
import { Award } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { TierProgressBar } from "./InsightsChartComponents";

interface LoyaltyData {
  pointsEarned: number;
  currentTier: string;
  tierProgress: number;
  nextTierPoints: number;
  pointsFromBookings: number;
  pointsFromReviews: number;
}

interface InsightsLoyaltySectionProps {
  loyaltyInsights: LoyaltyData;
  tierThresholds: Record<string, number>;
}

export const InsightsLoyaltySection: React.FC<InsightsLoyaltySectionProps> = ({
  loyaltyInsights,
  tierThresholds,
}) => {
  if (!loyaltyInsights) return null;

  return (
    <View className="mx-4 mb-6 bg-card p-5 rounded-xl border border-border">
      <View className="flex-row items-center gap-3 mb-5">
        <Award size={20} color="#f59e0b" />
        <H3 className="text-foreground">Loyalty Progress</H3>
      </View>

      <TierProgressBar
        loyaltyData={loyaltyInsights}
        tierThresholds={tierThresholds}
      />

      <View className="flex-row mt-5 gap-4">
        <View className="flex-1 bg-primary/5 p-3 rounded-lg">
          <Text className="text-sm text-muted-foreground mb-1">
            From Bookings
          </Text>
          <Text className="font-bold text-lg text-primary">
            {loyaltyInsights.pointsFromBookings || 0} pts
          </Text>
        </View>
        <View className="flex-1 bg-secondary/5 p-3 rounded-lg">
          <Text className="text-sm text-muted-foreground mb-1">
            From Reviews
          </Text>
          <Text className="font-bold text-lg text-secondary">
            {loyaltyInsights.pointsFromReviews || 0} pts
          </Text>
        </View>
      </View>
    </View>
  );
};
