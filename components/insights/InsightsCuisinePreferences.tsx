import React from "react";
import { View } from "react-native";
import { PieChart } from "lucide-react-native";

import { H3 } from "@/components/ui/typography";
import { SimplePieChart } from "./InsightsChartComponents";

interface CuisineData {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface InsightsCuisinePreferencesProps {
  cuisineData: CuisineData[];
  chartHeight: number;
}

export const InsightsCuisinePreferences: React.FC<
  InsightsCuisinePreferencesProps
> = ({ cuisineData, chartHeight }) => {
  if (!cuisineData.length) return null;

  return (
    <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
      <View className="p-5 pb-0">
        <View className="flex-row items-center gap-3 mb-4">
          <PieChart size={20} color="#ef4444" />
          <H3 className="text-foreground">Cuisine Preferences</H3>
        </View>
      </View>
      <View className="px-5 pb-5">
        <SimplePieChart data={cuisineData} size={chartHeight} />
      </View>
    </View>
  );
};
