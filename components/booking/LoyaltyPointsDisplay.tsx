// components/booking/LoyaltyPointsDisplay.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Trophy, Info, AlertCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  useRestaurantLoyalty,
  PotentialLoyaltyPoints,
} from "@/hooks/useRestaurantLoyalty";
import { useAuth } from "@/context/supabase-provider";

interface LoyaltyPointsDisplayProps {
  restaurantId: string;
  bookingTime: Date;
  partySize: number;
  onPointsCalculated?: (points: PotentialLoyaltyPoints | null) => void;
}

export const LoyaltyPointsDisplay: React.FC<LoyaltyPointsDisplayProps> = ({
  restaurantId,
  bookingTime,
  partySize,
  onPointsCalculated,
}) => {
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const {
    hasLoyaltyProgram,
    balance,
    checkPotentialPoints,
    loading: balanceLoading,
  } = useRestaurantLoyalty(restaurantId);
  const [potentialPoints, setPotentialPoints] =
    useState<PotentialLoyaltyPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculatePoints = async () => {
      // If restaurant doesn't have loyalty program, don't show anything
      if (!hasLoyaltyProgram || !profile?.id || balanceLoading) {
        setLoading(false);
        setPotentialPoints(null);
        onPointsCalculated?.(null);
        return;
      }

      setLoading(true);
      try {
        const points = await checkPotentialPoints(
          bookingTime,
          partySize,
          profile.id,
        );
        setPotentialPoints(points);
        onPointsCalculated?.(points);
      } catch (error) {
        console.error("Error calculating potential points:", error);
        setPotentialPoints(null);
        onPointsCalculated?.(null);
      } finally {
        setLoading(false);
      }
    };

    calculatePoints();
  }, [
    restaurantId,
    bookingTime,
    partySize,
    profile?.id,
    hasLoyaltyProgram,
    checkPotentialPoints,
    onPointsCalculated,
    balanceLoading,
  ]);

  if (loading) {
    return (
      <View className="bg-card rounded-xl p-4 border border-border">
        <View className="flex-row items-center justify-center">
          <ActivityIndicator size="small" />
          <Text className="ml-2 text-muted-foreground">
            Checking loyalty points...
          </Text>
        </View>
      </View>
    );
  }

  if (!potentialPoints) {
    return null;
  }

  const getBgColor = () => {
    if (!potentialPoints.available)
      return "bg-orange-100 dark:bg-orange-900/30";
    return "bg-green-100 dark:bg-green-900/30";
  };

  const getIconColor = () => {
    if (!potentialPoints.available) return "#f97316";
    return "#16a34a";
  };

  return (
    <View
      className={`rounded-xl p-4 border ${potentialPoints.available ? "border-green-200 dark:border-green-800" : "border-orange-200 dark:border-orange-800"} ${getBgColor()}`}
    >
      <View className="flex-row items-start">
        <Trophy size={24} color={getIconColor()} className="mr-3 mt-0.5" />
        <View className="flex-1">
          <Text className="font-semibold text-base mb-1">
            {potentialPoints.available
              ? `Earn ${potentialPoints.pointsToAward} Loyalty Points!`
              : "Loyalty Points Not Available"}
          </Text>
          <Text className="text-sm text-muted-foreground mb-2">
            {potentialPoints.available
              ? `From "${potentialPoints.ruleName}"`
              : potentialPoints.reason ||
                "This time slot is not eligible for points"}
          </Text>

          {balance && (
            <View className="flex-row items-center mt-2">
              <Info size={16} color="#666" />
              <Text className="text-xs text-muted-foreground ml-1">
                Restaurant has {balance.current_balance} points available
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Component to show loyalty rules for a restaurant
export const RestaurantLoyaltyRules: React.FC<{ restaurantId: string }> = ({
  restaurantId,
}) => {
  const {
    rules,
    balance,
    hasLoyaltyProgram,
    formatTimeRange,
    formatDays,
    loading,
  } = useRestaurantLoyalty(restaurantId);
  const { colorScheme } = useColorScheme();

  // Don't show anything if restaurant doesn't have loyalty program
  if (!hasLoyaltyProgram || loading) {
    return null;
  }

  if (!balance || balance.current_balance === 0) {
    return null;
  }

  if (rules.length === 0) {
    return null;
  }

  return (
    <View className="p-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg ml-2">
            Earn Loyalty Points
          </Text>
        </View>
        <View className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
          <Text className="text-xs font-medium text-blue-700 dark:text-blue-300">
            {balance.current_balance} available
          </Text>
        </View>
      </View>

      <View className="space-y-3">
        {rules.map((rule) => (
          <View
            key={rule.id}
            className="bg-card rounded-lg p-3 border border-border"
          >
            <View className="flex-row justify-between items-start mb-2">
              <Text className="font-medium flex-1">{rule.rule_name}</Text>
              <View className="bg-primary/10 px-2 py-1 rounded-full">
                <Text className="text-xs font-semibold text-primary">
                  +{rule.points_to_award} pts
                </Text>
              </View>
            </View>

            <View className="space-y-1">
              <View className="flex-row items-center">
                <Text className="text-xs text-muted-foreground">
                  Days: {formatDays(rule.applicable_days)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <Text className="text-xs text-muted-foreground">
                  Time:{" "}
                  {formatTimeRange(
                    rule.start_time_minutes,
                    rule.end_time_minutes,
                  )}
                </Text>
              </View>

              {rule.minimum_party_size > 1 && (
                <View className="flex-row items-center">
                  <Text className="text-xs text-muted-foreground">
                    Min party size: {rule.minimum_party_size} people
                  </Text>
                </View>
              )}

              {rule.max_uses_per_user && (
                <View className="flex-row items-center">
                  <Text className="text-xs text-muted-foreground">
                    Limit: {rule.max_uses_per_user} use
                    {rule.max_uses_per_user > 1 ? "s" : ""} per person
                  </Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      <View className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
        <View className="flex-row items-start">
          <Info size={16} color="#3b82f6" className="mt-0.5" />
          <Text className="text-xs text-blue-800 dark:text-blue-200 ml-2 flex-1">
            Points are awarded automatically when your booking is confirmed.
            Limited availability - {balance.current_balance} points remaining!
          </Text>
        </View>
      </View>
    </View>
  );
};
