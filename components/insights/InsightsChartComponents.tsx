import React from "react";
import { View, Dimensions } from "react-native";
import { Text } from "@/components/ui/text";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_MARGIN = 16;
const CHART_PADDING = 20;

// Progress Bar Component
export const ProgressBar: React.FC<{
  value: number;
  maxValue: number;
  color: string;
  height?: number;
}> = ({ value, maxValue, color, height = 8 }) => {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <View className="bg-muted rounded-full overflow-hidden" style={{ height }}>
      <View
        className="rounded-full"
        style={{
          width: `${percentage}%`,
          height: "100%",
          backgroundColor: color,
        }}
      />
    </View>
  );
};

// Line Chart Component
export const SimpleLineChart: React.FC<{
  data: Array<{ month: string; bookings: number; completed: number }>;
  height: number;
}> = ({ data, height }) => {
  if (!data.length) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-muted-foreground">No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.bookings, d.completed))
  );
  const chartWidth = SCREEN_WIDTH - CARD_MARGIN * 2 - CHART_PADDING * 2;
  const chartHeight = height - 80; // Reserve space for labels and legend
  const pointSpacing =
    data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;

  return (
    <View style={{ height }} className="w-full">
      {/* Chart Header */}
      <View className="flex-row justify-between mb-4 px-2">
        <Text className="text-xs text-muted-foreground">0</Text>
        <Text className="text-xs text-muted-foreground">{maxValue}</Text>
      </View>

      {/* Chart Container */}
      <View
        className="flex-1 relative justify-end"
        style={{ height: chartHeight }}
      >
        {data.map((item, index) => {
          const bookingHeight =
            maxValue > 0
              ? Math.max((item.bookings / maxValue) * chartHeight * 0.8, 4)
              : 4;
          const completedHeight =
            maxValue > 0
              ? Math.max((item.completed / maxValue) * chartHeight * 0.8, 4)
              : 4;

          return (
            <View
              key={`${item.month}-${index}`}
              className="absolute bottom-8 items-center"
              style={{
                left: Math.max(
                  0,
                  Math.min(index * pointSpacing, chartWidth - 20)
                ),
              }}
            >
              <View className="flex-row gap-1 items-end">
                <View
                  className="w-3 rounded-t"
                  style={{
                    height: bookingHeight,
                    backgroundColor: "#3b82f6",
                  }}
                />
                <View
                  className="w-3 rounded-t"
                  style={{
                    height: completedHeight,
                    backgroundColor: "#10b981",
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View className="flex-row justify-between px-2 mt-2">
        {data.map((item, index) => (
          <Text
            key={`label-${item.month}-${index}`}
            className="text-xs text-muted-foreground"
            style={{
              width: 40,
              textAlign: "center",
            }}
          >
            {item.month.slice(0, 3)}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View className="flex-row justify-center gap-6 mt-4">
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded bg-[#3b82f6]" />
          <Text className="text-xs text-muted-foreground">Total</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded bg-[#10b981]" />
          <Text className="text-xs text-muted-foreground">Completed</Text>
        </View>
      </View>
    </View>
  );
};

// Pie Chart Component (Horizontal Bar Representation)
export const SimplePieChart: React.FC<{
  data: Array<{
    name: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  size: number;
}> = ({ data, size }) => {
  if (!data.length) {
    return (
      <View style={{ height: size }} className="items-center justify-center">
        <Text className="text-muted-foreground">No cuisine data</Text>
      </View>
    );
  }

  return (
    <View className="w-full">
      {/* Visual representation with horizontal bars */}
      <View className="space-y-4">
        {data.slice(0, 6).map((item, index) => (
          <View key={`${item.name}-${index}`} className="w-full">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-3 flex-1">
                <View
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <Text
                  className="text-sm font-medium flex-shrink-1"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground ml-2">
                {item.percentage}%
              </Text>
            </View>
            <ProgressBar
              value={item.count}
              maxValue={Math.max(...data.map((d) => d.count))}
              color={item.color}
              height={8}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

// Tier Progress Bar Component
export const TierProgressBar: React.FC<{
  loyaltyData: {
    pointsEarned: number;
    currentTier: string;
    tierProgress: number;
    nextTierPoints: number;
  };
  tierThresholds: Record<string, number>;
}> = ({ loyaltyData, tierThresholds }) => {
  if (!loyaltyData) return null;

  const currentPoints = loyaltyData.pointsEarned || 0;
  const currentTier = loyaltyData.currentTier || "bronze";
  const currentTierMin = tierThresholds[currentTier] || 0;
  const nextTierMin = loyaltyData.nextTierPoints + currentPoints;
  const progress =
    nextTierMin > currentTierMin
      ? Math.min(
          ((currentPoints - currentTierMin) / (nextTierMin - currentTierMin)) *
            100,
          100
        )
      : 100;

  return (
    <View className="space-y-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-medium capitalize">{currentTier}</Text>
        <Text className="text-sm text-muted-foreground">
          {currentPoints} / {nextTierMin} pts
        </Text>
      </View>
      <ProgressBar
        value={Math.max(0, progress)}
        maxValue={100}
        color="#f59e0b"
        height={10}
      />
      <Text className="text-xs text-muted-foreground">
        {loyaltyData.nextTierPoints || 0} points to next tier
      </Text>
    </View>
  );
};
