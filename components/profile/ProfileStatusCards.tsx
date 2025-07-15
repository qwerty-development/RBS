import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Trophy, Award } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { UserRating } from "@/components/rating/UserRating";

interface LoyaltyTier {
  name: string;
  color: string;
  minPoints: number;
  perks: string[];
}

interface ProfileStatusCardsProps {
  profile: any;
  loyaltyTiers: Record<string, LoyaltyTier>;
  tierProgress: {
    progress: number;
    pointsToNext: number;
    nextTier: string | null;
  };
  ratingStats?: {
    completion_rate: number;
  };
  currentRating: number;
  ratingLoading: boolean;
}

export const ProfileStatusCards: React.FC<ProfileStatusCardsProps> = ({
  profile,
  loyaltyTiers,
  tierProgress,
  ratingStats,
  currentRating,
  ratingLoading,
}) => {
  return (
    <View className="flex-row mx-4 mb-6 gap-3">
      {/* Loyalty Status Card */}
      <View className="flex-1 p-4 bg-card rounded-xl shadow-sm">
        <View className="flex-row items-center gap-2 mb-2">
          <Trophy
            size={20}
            color={loyaltyTiers[profile?.membership_tier || "bronze"].color}
          />
          <Text className="font-bold text-sm">
            {loyaltyTiers[profile?.membership_tier || "bronze"].name}
          </Text>
        </View>
        <Text className="text-lg font-bold text-primary">
          {profile?.loyalty_points || 0}
        </Text>
        <Text className="text-xs text-muted-foreground">Loyalty Points</Text>

        {/* Progress Bar for Loyalty */}
        {tierProgress.nextTier && (
          <>
            <View className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
              <View
                className="h-full bg-primary"
                style={{
                  width: `${Math.max(0, Math.min(100, tierProgress.progress * 100))}%`,
                }}
              />
            </View>
            <Text className="text-xs text-muted-foreground mt-1">
              {tierProgress.pointsToNext} to{" "}
              {loyaltyTiers[tierProgress.nextTier].name}
            </Text>
          </>
        )}
      </View>

      {/* Reliability Score Card */}
      <View className="flex-1 p-4 bg-card rounded-xl shadow-sm">
        <View className="flex-row items-center gap-2 mb-2">
          <Award size={20} color="#FFD700" />
          <Text className="font-bold text-sm">Reliability</Text>
        </View>
        {!ratingLoading && ratingStats ? (
          <>
            <UserRating rating={currentRating} size="sm" showNumber={false} />
            <Text className="text-lg font-bold text-primary mt-1">
              {currentRating.toFixed(1)}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {ratingStats.completion_rate.toFixed(0)}% completion rate
            </Text>
          </>
        ) : (
          <View className="py-2">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-muted-foreground mt-1">
              Loading...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
