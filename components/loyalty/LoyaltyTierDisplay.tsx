import React from "react";
import { View } from "react-native";
import { Trophy, Award, Star, Crown, Sparkles } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { TierType, TIER_CONFIG } from "@/lib/bookingUtils";

const TIER_ICONS = {
  bronze: Award,
  silver: Star,
  gold: Crown,
  platinum: Sparkles,
} as const;

interface LoyaltyTierDisplayProps {
  userTier: TierType;
  userPoints: number;
  earnablePoints: number;
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export const LoyaltyTierDisplay: React.FC<LoyaltyTierDisplayProps> = ({
  userTier,
  userPoints,
  earnablePoints,
  variant = "default",
  className = "",
}) => {
  const tierConfig = TIER_CONFIG[userTier] || TIER_CONFIG.bronze;
  const IconComponent = TIER_ICONS[userTier] || Award;

  if (variant === "compact") {
    return (
      <View
        className={`bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 ${className}`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Trophy size={16} color="#f59e0b" />
            <Text className="font-medium text-amber-800 dark:text-amber-200">
              +{earnablePoints} points
            </Text>
          </View>
          <View className="flex-row items-center bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded-full">
            <IconComponent size={12} color={tierConfig.color} />
            <Text className="font-bold text-xs ml-1 text-amber-800 dark:text-amber-200">
              {tierConfig.name.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (variant === "detailed") {
    return (
      <View
        className={`bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 ${className}`}
      >
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-3">
            <View className="bg-amber-200 dark:bg-amber-800 rounded-full p-2">
              <Trophy size={20} color="#f59e0b" />
            </View>
            <View>
              <Text className="font-bold text-lg text-amber-800 dark:text-amber-200">
                Loyalty Rewards
              </Text>
              <Text className="text-sm text-amber-700 dark:text-amber-300">
                Earn points with every booking
              </Text>
            </View>
          </View>
          <View className="flex-row items-center bg-amber-200 dark:bg-amber-800 px-3 py-2 rounded-full">
            <IconComponent size={16} color={tierConfig.color} />
            <Text className="font-bold text-sm ml-1 text-amber-800 dark:text-amber-200">
              {tierConfig.name.toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              You'll earn
            </Text>
            <View className="flex-row items-center">
              <Text className="text-3xl font-bold text-amber-800 dark:text-amber-200">
                +{earnablePoints}
              </Text>
              <Text className="text-sm text-amber-700 dark:text-amber-300 ml-1">
                points
              </Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              Current balance
            </Text>
            <Text className="text-xl font-bold text-amber-800 dark:text-amber-200">
              {userPoints.toLocaleString()} pts
            </Text>
          </View>
        </View>

        <View className="bg-amber-100 dark:bg-amber-800/30 rounded-lg p-3">
          <Text className="text-xs text-amber-700 dark:text-amber-300">
            💡 {tierConfig.name} members earn {tierConfig.pointsMultiplier}x
            points on all bookings
          </Text>
          <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Points are automatically awarded after your successful dining
            experience
          </Text>
        </View>
      </View>
    );
  }

  // Default variant
  return (
    <View
      className={`bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 ${className}`}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Trophy size={20} color="#f59e0b" />
          <Text className="font-bold text-lg text-amber-800 dark:text-amber-200">
            Loyalty Rewards
          </Text>
        </View>
        <View className="flex-row items-center bg-amber-200 dark:bg-amber-800 px-3 py-1 rounded-full">
          <IconComponent size={14} color={tierConfig.color} />
          <Text className="font-bold text-sm ml-1 text-amber-800 dark:text-amber-200">
            {tierConfig.name.toUpperCase()}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-amber-700 dark:text-amber-300">
            You'll earn
          </Text>
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-amber-800 dark:text-amber-200">
              +{earnablePoints}
            </Text>
            <Text className="text-sm text-amber-700 dark:text-amber-300 ml-1">
              points
            </Text>
          </View>
        </View>

        <View className="items-end">
          <Text className="text-sm text-amber-700 dark:text-amber-300">
            Current balance
          </Text>
          <Text className="text-lg font-bold text-amber-800 dark:text-amber-200">
            {userPoints} pts
          </Text>
        </View>
      </View>

      <Text className="text-xs text-amber-700 dark:text-amber-300 mt-2">
        Points are automatically awarded after your successful dining experience
      </Text>
    </View>
  );
};
