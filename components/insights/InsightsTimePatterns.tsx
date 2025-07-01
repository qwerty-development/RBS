import React from "react";
import { View } from "react-native";
import { Calendar, Clock } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";

interface DayDistribution {
  day: string;
  count: number;
  percentage: number;
}

interface TimeDistribution {
  timeSlot: string;
  count: number;
  percentage: number;
}

interface TimePatternData {
  preferredDay: string;
  preferredTime: string;
  dayDistribution: DayDistribution[];
  timeDistribution: TimeDistribution[];
}

interface InsightsTimePatternsProps {
  timePatterns: TimePatternData;
}

export const InsightsTimePatterns: React.FC<InsightsTimePatternsProps> = ({
  timePatterns,
}) => {
  if (!timePatterns) return null;

  return (
    <View className="mx-4 mb-6">
      <H2 className="mb-4 text-foreground">Dining Patterns</H2>
      <View className="flex-row gap-3">
        {/* Day Preferences */}
        <View className="flex-1 bg-card p-4 rounded-xl border border-border">
          <View className="flex-row items-center gap-3 mb-3">
            <Calendar size={18} color="#3b82f6" />
            <H3 className="text-base text-foreground">Favorite Day</H3>
          </View>
          <Text className="font-bold text-xl mb-3 text-foreground">
            {timePatterns.preferredDay}
          </Text>
          <View className="space-y-2">
            {timePatterns.dayDistribution
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((day, index) => (
                <View
                  key={`${day.day}-${index}`}
                  className="flex-row justify-between items-center"
                >
                  <Text className="text-sm text-muted-foreground">
                    {day.day.slice(0, 3)}
                  </Text>
                  <Text className="text-sm font-medium text-foreground">
                    {day.percentage}%
                  </Text>
                </View>
              ))}
          </View>
        </View>

        {/* Time Preferences */}
        <View className="flex-1 bg-card p-4 rounded-xl border border-border">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={18} color="#f59e0b" />
            <H3 className="text-base text-foreground">Favorite Time</H3>
          </View>
          <Text className="font-bold text-xl mb-3 text-foreground">
            {timePatterns.preferredTime}
          </Text>
          <View className="space-y-2">
            {timePatterns.timeDistribution
              .sort((a, b) => b.count - a.count)
              .slice(0, 3)
              .map((time, index) => (
                <View
                  key={`${time.timeSlot}-${index}`}
                  className="flex-row justify-between items-center"
                >
                  <Text className="text-sm text-muted-foreground">
                    {time.timeSlot}
                  </Text>
                  <Text className="text-sm font-medium text-foreground">
                    {time.percentage}%
                  </Text>
                </View>
              ))}
          </View>
        </View>
      </View>
    </View>
  );
};
