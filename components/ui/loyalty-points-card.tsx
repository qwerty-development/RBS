import React from "react";
import { View, Pressable } from "react-native";
import { Trophy, Star, Crown, Award } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// Tier configuration
const TIER_CONFIG = {
  bronze: { icon: Star, color: "#cd7f32", name: "Bronze" },
  silver: { icon: Award, color: "#c0c0c0", name: "Silver" },
  gold: { icon: Trophy, color: "#ffd700", name: "Gold" },
  platinum: { icon: Crown, color: "#e5e4e2", name: "Platinum" },
} as const;

type TierType = keyof typeof TIER_CONFIG;

interface LoyaltyPointsCardProps {
  pointsEarned?: number;
  userTier: string;
  userPoints?: number;
  earnablePoints?: number;
  tierMultiplier?: number;
  onPress?: () => void;
  variant?: "default" | "compact" | "booking";
  hasOffer?: boolean;
  title?: string;
  className?: string;
}

export function LoyaltyPointsCard({
  pointsEarned,
  userTier,
  userPoints,
  earnablePoints,
  tierMultiplier = 1,
  onPress,
  variant = "default",
  hasOffer = false,
  title,
  className,
}: LoyaltyPointsCardProps) {
  const tierConfig = TIER_CONFIG[userTier as TierType] || TIER_CONFIG.bronze;
  const IconComponent = tierConfig.icon;

  const getGradientClass = () => {
    if (hasOffer) {
      return "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-2 border-amber-200 dark:border-amber-800";
    }
    return "bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20";
  };

  const getTextColors = () => {
    if (hasOffer) {
      return {
        title: "text-amber-800 dark:text-amber-200",
        subtitle: "text-amber-700 dark:text-amber-300",
        points: "text-amber-800 dark:text-amber-200",
        badge:
          "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200",
      };
    }
    return {
      title: "text-primary",
      subtitle: "text-muted-foreground",
      points: "text-primary",
      badge: "bg-primary/20 text-primary",
    };
  };

  const colors = getTextColors();

  if (variant === "compact") {
    return (
      <View
        className={cn("bg-card rounded-lg p-3 border border-border", className)}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <IconComponent size={16} color={tierConfig.color} />
            <Text className="font-bold text-sm ml-2">
              {pointsEarned || earnablePoints || 0} pts
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {tierConfig.name}
          </Text>
        </View>
      </View>
    );
  }

  const CardComponent = onPress ? Pressable : View;

  return (
    <CardComponent
      onPress={onPress}
      className={cn("rounded-xl p-4 mb-4", getGradientClass(), className)}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color={hasOffer ? "#f59e0b" : "#3b82f6"} />
          <Text className={cn("font-bold text-lg ml-2", colors.title)}>
            {title || (hasOffer ? "Double Rewards Earned!" : "Loyalty Points")}
          </Text>
        </View>
        <View className={cn("px-3 py-1 rounded-full", colors.badge)}>
          <View className="flex-row items-center">
            <IconComponent size={14} color={tierConfig.color} />
            <Text className="font-bold text-sm ml-1">
              {tierConfig.name.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        {variant === "booking" ? (
          <>
            <View>
              <Text className={cn("text-sm", colors.subtitle)}>
                You'll earn
              </Text>
              <View className="flex-row items-center">
                <Text className={cn("text-2xl font-bold", colors.points)}>
                  +{earnablePoints || 0}
                </Text>
                <Text className={cn("text-sm ml-1", colors.subtitle)}>
                  points
                </Text>
              </View>
            </View>

            <View className="items-end">
              <Text className={cn("text-sm", colors.subtitle)}>
                Current balance
              </Text>
              <Text className={cn("text-lg font-bold", colors.points)}>
                {userPoints || 0} pts
              </Text>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text className={cn("text-sm", colors.subtitle)}>
                Points earned
              </Text>
              <View className="flex-row items-center">
                <Text className={cn("text-2xl font-bold", colors.points)}>
                  +{pointsEarned || 0}
                </Text>
                <Text className={cn("text-sm ml-1", colors.subtitle)}>
                  points
                </Text>
              </View>
            </View>

            {userPoints !== undefined && (
              <View className="items-end">
                <Text className={cn("text-sm", colors.subtitle)}>
                  New balance
                </Text>
                <Text className={cn("text-lg font-bold", colors.points)}>
                  {userPoints + (pointsEarned || 0)} pts
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {tierMultiplier > 1 && (
        <Text className={cn("text-xs mt-2", colors.subtitle)}>
          {tierMultiplier}x multiplier applied • {tierConfig.name} tier bonus
        </Text>
      )}
    </CardComponent>
  );
}
