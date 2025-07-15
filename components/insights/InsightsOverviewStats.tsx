import React from "react";
import { View } from "react-native";
import { Activity, Star, DollarSign, Award } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";

interface PerformanceMetrics {
  totalBookings: number;
  averageRating: number;
  completionRate: number;
  reviewRate: number;
  totalReviews: number;
}

interface SpendingData {
  averagePerVisit: number;
  totalSpent: number;
  favoritesPriceRange: number;
}

interface LoyaltyData {
  pointsEarned: number;
  currentTier: string;
  tierProgress: number;
  nextTierPoints: number;
}

interface InsightsOverviewStatsProps {
  performanceMetrics: PerformanceMetrics;
  spendingAnalytics: SpendingData;
  loyaltyInsights: LoyaltyData;
}

export const InsightsOverviewStats: React.FC<InsightsOverviewStatsProps> = ({
  performanceMetrics,
  spendingAnalytics,
  loyaltyInsights,
}) => {
  return (
    <View className="mx-4 mb-6">
      <H2 className="mb-4 text-foreground">Overview</H2>
      <View className="flex-row flex-wrap gap-3">
        <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
          <View className="flex-row items-center gap-3 mb-2">
            <Activity size={20} color="#3b82f6" />
            <Text className="font-bold text-2xl text-foreground">
              {performanceMetrics.totalBookings}
            </Text>
          </View>
          <Muted className="text-sm">Total Bookings</Muted>
        </View>

        <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
          <View className="flex-row items-center gap-3 mb-2">
            <Star size={20} color="#f59e0b" />
            <Text className="font-bold text-2xl text-foreground">
              {performanceMetrics.averageRating > 0
                ? performanceMetrics.averageRating.toFixed(1)
                : "N/A"}
            </Text>
          </View>
          <Muted className="text-sm">Avg Rating Given</Muted>
        </View>
      </View>
    </View>
  );
};
