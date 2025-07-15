import React from "react";
import { View } from "react-native";
import { DollarSign } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface CategorySpendingData {
  category: string;
  amount: number;
  percentage: number;
}

interface SpendingData {
  averagePerVisit: number;
  totalSpent: number;
  monthlySpending: { month: string; amount: number }[];
  spendingByCategory: CategorySpendingData[];
  favoritesPriceRange: number;
}

interface InsightsSpendingAnalyticsProps {
  spendingAnalytics: SpendingData;
}

export const InsightsSpendingAnalytics: React.FC<
  InsightsSpendingAnalyticsProps
> = ({ spendingAnalytics }) => {
  if (!spendingAnalytics) return null;

  const priceRangeLabels = {
    1: "Budget ($)",
    2: "Moderate ($)",
    3: "Upscale ($$)",
    4: "Fine Dining ($$)",
  };

  return (
    <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
      <View className="p-5">
        <View className="flex-row items-center gap-3 mb-4">
          <DollarSign size={20} color="#10b981" />
          <H3 className="text-foreground">Spending Analytics</H3>
        </View>

        <View className="flex-row gap-4 mb-5">
          <View className="flex-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <Text className="text-sm text-muted-foreground mb-1">
              Preferred Range
            </Text>
            <Text
              className="font-bold text-base text-foreground"
              numberOfLines={1}
            >
              {
                priceRangeLabels[
                  spendingAnalytics.favoritesPriceRange as keyof typeof priceRangeLabels
                ]
              }
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
