import React from "react";
import { View } from "react-native";
import { TrendingUp } from "lucide-react-native";

import { H3 } from "@/components/ui/typography";
import { SimpleLineChart } from "./InsightsChartComponents";

interface BookingTrendData {
  month: string;
  bookings: number;
  completed: number;
  cancelled: number;
}

interface InsightsBookingTrendsProps {
  bookingTrends: BookingTrendData[];
  chartHeight: number;
}

export const InsightsBookingTrends: React.FC<InsightsBookingTrendsProps> = ({
  bookingTrends,
  chartHeight,
}) => {
  if (!bookingTrends.length) return null;

  return (
    <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
      <View className="p-5 pb-0">
        <View className="flex-row items-center gap-3 mb-4">
          <TrendingUp size={20} color="#3b82f6" />
          <H3 className="text-foreground">Booking Trends</H3>
        </View>
      </View>
      <View className="px-5 pb-5">
        <SimpleLineChart data={bookingTrends} height={chartHeight} />
      </View>
    </View>
  );
};
