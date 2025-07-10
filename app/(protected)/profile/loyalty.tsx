import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Trophy,
  Gift,
  ChevronRight,
  Star,
  ArrowLeft,
  Crown,
  Award,
  Sparkles,
  Clock,
  CheckCircle,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import LoyaltyScreenSkeleton from "@/components/skeletons/LoyaltyScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useOffers } from "@/hooks/useOffers";

// Enhanced types for the loyalty system
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
};

interface LoyaltyReward extends SpecialOffer {
  pointsCost: number;
  category: "food" | "discount" | "experience" | "tier_exclusive";
  tierRequired: "bronze" | "silver" | "gold" | "platinum";
  claimed?: boolean;
  used?: boolean;
  isAvailable: boolean;
}

interface UserRedemption {
  id: string;
  reward: LoyaltyReward;
  redeemedAt: string;
  usedAt?: string;
  expiresAt: string;
}

// Tier configuration
const TIER_CONFIG = {
  bronze: {
    name: "Bronze",
    color: "#CD7F32",
    icon: Award,
    minPoints: 0,
    maxPoints: 499,
    benefits: ["Basic rewards", "Birthday discount"],
  },
  silver: {
    name: "Silver",
    color: "#C0C0C0",
    icon: Star,
    minPoints: 500,
    maxPoints: 1499,
    benefits: ["All Bronze benefits", "Exclusive offers", "Priority support"],
  },
  gold: {
    name: "Gold",
    color: "#FFD700",
    icon: Crown,
    minPoints: 1500,
    maxPoints: 2999,
    benefits: ["All Silver benefits", "VIP experiences", "Free delivery"],
  },
  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    icon: Sparkles,
    minPoints: 3000,
    maxPoints: Infinity,
    benefits: ["All Gold benefits", "Personal concierge", "Exclusive events"],
  },
} as const;

type TierType = keyof typeof TIER_CONFIG;

// Reward categories with point costs
const REWARD_CATEGORIES = {
  food: {
    name: "Food Rewards",
    basePointCost: 300,
    multiplier: 1,
  },
  discount: {
    name: "Discounts",
    basePointCost: 500,
    multiplier: 1.2,
  },
  experience: {
    name: "Experiences",
    basePointCost: 1500,
    multiplier: 2,
  },
  tier_exclusive: {
    name: "Tier Exclusive",
    basePointCost: 1000,
    multiplier: 1.5,
  },
} as const;

// Tier badge component
const TierBadge: React.FC<{
  tier: TierType;
  points: number;
  size?: "small" | "large";
}> = ({ tier, points, size = "small" }) => {
  const config = TIER_CONFIG[tier];
  const IconComponent = config.icon;
  const isLarge = size === "large";

  const nextTier = tier === "platinum" ? null : 
    Object.entries(TIER_CONFIG).find(([_, c]) => c.minPoints > points)?.[0] as TierType;
  
  const progress = nextTier ? 
    ((points - config.minPoints) / (TIER_CONFIG[nextTier].minPoints - config.minPoints)) * 100 : 100;

  return (
    <View className={`items-center ${isLarge ? "p-4" : "p-2"}`}>
      <View className={`flex-row items-center gap-2 mb-2`}>
        <IconComponent 
          size={isLarge ? 24 : 16} 
          color={config.color} 
        />
        <Text className={`font-bold ${isLarge ? "text-lg" : "text-sm"}`} style={{ color: config.color }}>
          {config.name}
        </Text>
      </View>
      
      {isLarge && (
        <>
          <Text className="text-center text-muted-foreground mb-2">
            {points} points
          </Text>
          
          {nextTier && (
            <View className="w-full">
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm">Progress to {TIER_CONFIG[nextTier].name}</Text>
                <Text className="text-sm">{Math.round(progress)}%</Text>
              </View>
              <View className="w-full h-2 bg-muted rounded-full">
                <View 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </View>
              <Text className="text-xs text-muted-foreground mt-1">
                {TIER_CONFIG[nextTier].minPoints - points} points to {TIER_CONFIG[nextTier].name}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

// Enhanced reward card component
const RewardCard: React.FC<{
  reward: LoyaltyReward;
  userPoints: number;
  userTier: TierType;
  onRedeem: (reward: LoyaltyReward) => void;
  loading?: boolean;
}> = ({ reward, userPoints, userTier, onRedeem, loading }) => {
  const canAfford = userPoints >= reward.pointsCost;
  const tierAllowed = TIER_CONFIG[userTier].minPoints >= TIER_CONFIG[reward.tierRequired].minPoints;
  const isRedeemable = canAfford && tierAllowed && reward.isAvailable && !reward.claimed;
  const { colorScheme } = useColorScheme();

  const categoryConfig = REWARD_CATEGORIES[reward.category];
  const tierConfig = TIER_CONFIG[reward.tierRequired];

  return (
    <Pressable
      onPress={() => isRedeemable && !loading && onRedeem(reward)}
      className={`p-4 rounded-xl mb-3 border ${
        isRedeemable ? "bg-card border-primary/20" : "bg-muted/50 border-border"
      } ${loading ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {/* Header with title and points */}
          <View className="flex-row items-center gap-2 mb-2">
            <Text className={`font-bold text-lg ${isRedeemable ? "" : "text-muted-foreground"}`}>
              {reward.title}
            </Text>
            <View className="flex-row items-center bg-primary/10 px-2 py-1 rounded-full">
              <Star size={14} color="#3b82f6" />
              <Text className="text-primary text-sm ml-1">{reward.pointsCost}</Text>
            </View>
          </View>

          {/* Description */}
          <Text className="text-sm text-muted-foreground mb-2">
            {reward.description}
          </Text>

          {/* Restaurant info */}
          <Text className="text-xs text-muted-foreground mb-2">
            Available at {reward.restaurant.name}
          </Text>

          {/* Tags and status */}
          <View className="flex-row items-center gap-2 flex-wrap">
            {/* Category tag */}
            <View
              className={`px-3 py-1 rounded-full ${
                reward.category === "food"
                  ? "bg-green-100"
                  : reward.category === "discount"
                  ? "bg-blue-100"
                  : reward.category === "experience"
                  ? "bg-purple-100"
                  : "bg-orange-100"
              }`}
            >
              <Text
                className={`text-xs ${
                  reward.category === "food"
                    ? "text-green-700"
                    : reward.category === "discount"
                    ? "text-blue-700"
                    : reward.category === "experience"
                    ? "text-purple-700"
                    : "text-orange-700"
                }`}
              >
                {categoryConfig.name}
              </Text>
            </View>

            {/* Tier requirement */}
            {reward.tierRequired !== "bronze" && (
              <View className="flex-row items-center bg-yellow-100 px-2 py-1 rounded-full">
                <tierConfig.icon size={12} color={tierConfig.color} />
                <Text className="text-xs ml-1" style={{ color: tierConfig.color }}>
                  {tierConfig.name}+
                </Text>
              </View>
            )}

            {/* Status indicators */}
            {reward.claimed && (
              <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
                <CheckCircle size={12} color="#16a34a" />
                <Text className="text-xs text-green-700 ml-1">Claimed</Text>
              </View>
            )}
          </View>

          {/* Error messages */}
          <View className="mt-2">
            {!canAfford && (
              <Text className="text-sm text-destructive">
                Need {reward.pointsCost - userPoints} more points
              </Text>
            )}
            {!tierAllowed && (
              <Text className="text-sm text-orange-600">
                Requires {tierConfig.name} tier or higher
              </Text>
            )}
            {!reward.isAvailable && (
              <Text className="text-sm text-muted-foreground">
                Currently unavailable
              </Text>
            )}
          </View>
        </View>

        <View className="items-center">
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <ChevronRight
              size={20}
              color={isRedeemable ? "#3b82f6" : colorScheme === "dark" ? "#666" : "#999"}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default function LoyaltyScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  // Use useOffers for offer state
  const {
    getClaimedOffers,
    claimOffer,
    loading: offersLoading,
    fetchOffers,
  } = useOffers();

  // State management
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<UserRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // User data
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";

  // Fetch rewards from special offers
  const fetchRewards = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const now = new Date().toISOString();
      
      // Fetch available special offers as rewards
      const { data: offersData, error: offersError } = await supabase
        .from("special_offers")
        .select(`
          *,
          restaurant:restaurants (*)
        `)
        .lte("valid_from", now)
        .gte("valid_until", now);

      if (offersError) throw offersError;

      // Fetch user's claimed offers
      const { data: claimedData, error: claimedError } = await supabase
        .from("user_offers")
        .select("offer_id, used_at")
        .eq("user_id", profile.id);

      if (claimedError) throw claimedError;

      const claimedMap = new Map(
        claimedData?.map((c) => [c.offer_id, { claimed: true, used: !!c.used_at }]) || []
      );

      // Transform offers into loyalty rewards
      const loyaltyRewards: LoyaltyReward[] = (offersData || []).map((offer) => {
        const claimed = claimedMap.get(offer.id);
        
        // Calculate point cost based on discount percentage
        const basePointCost = Math.max(offer.discount_percentage * 20, 100);
        
        // Determine category based on discount and terms
        let category: LoyaltyReward["category"] = "discount";
        if (offer.title.toLowerCase().includes("dessert") || offer.title.toLowerCase().includes("appetizer")) {
          category = "food";
        } else if (offer.title.toLowerCase().includes("vip") || offer.title.toLowerCase().includes("chef")) {
          category = "experience";
        } else if (offer.discount_percentage >= 50) {
          category = "tier_exclusive";
        }

        // Determine tier requirement based on discount value
        let tierRequired: TierType = "bronze";
        if (offer.discount_percentage >= 50) {
          tierRequired = "platinum";
        } else if (offer.discount_percentage >= 30) {
          tierRequired = "gold";
        } else if (offer.discount_percentage >= 20) {
          tierRequired = "silver";
        }

        const categoryConfig = REWARD_CATEGORIES[category];
        const pointsCost = Math.round(basePointCost * categoryConfig.multiplier);

        return {
          ...offer,
          pointsCost,
          category,
          tierRequired,
          claimed: claimed?.claimed || false,
          used: claimed?.used || false,
          isAvailable: true,
        };
      });

      setRewards(loyaltyRewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      Alert.alert("Error", "Failed to load loyalty rewards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Handle reward redemption
  const handleRedeemReward = useCallback(async (reward: LoyaltyReward) => {
    if (!profile?.id) return;
    const canAfford = userPoints >= reward.pointsCost;
    const tierAllowed = TIER_CONFIG[userTier].minPoints >= TIER_CONFIG[reward.tierRequired].minPoints;
    if (!canAfford) {
      Alert.alert("Insufficient Points", `You need ${reward.pointsCost - userPoints} more points to redeem this reward.`);
      return;
    }
    if (!tierAllowed) {
      Alert.alert("Tier Required", `This reward requires ${TIER_CONFIG[reward.tierRequired].name} tier or higher.`);
      return;
    }
    Alert.alert(
      "Redeem Reward",
      `Redeem "${reward.title}" for ${reward.pointsCost} points?\n\nThis will deduct ${reward.pointsCost} points from your account.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Redeem",
          onPress: async () => {
            setRedeemingId(reward.id);
            try {
              // Deduct points
              const { error: deductError } = await supabase.rpc("award_loyalty_points", {
                p_user_id: profile.id,
                p_points: -reward.pointsCost,
              });
              if (deductError) throw deductError;
              // Claim the offer using the hook
              await claimOffer(reward.id);
              // Refresh profile to get updated points
              await refreshProfile();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Reward Redeemed!",
                `"${reward.title}" has been added to your account. Show this at ${reward.restaurant.name} to use your reward.`,
                [
                  {
                    text: "View My Rewards",
                    onPress: () => router.push("/profile/my-rewards"),
                  },
                  { text: "OK" },
                ]
              );
            } catch (error) {
              console.error("Error redeeming reward:", error);
              Alert.alert("Error", error.message || "Failed to redeem reward. Please try again.");
            } finally {
              setRedeemingId(null);
            }
          },
        },
      ]
    );
  }, [profile?.id, userPoints, userTier, refreshProfile, router, claimOffer]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRewards();
    refreshProfile();
  }, [fetchRewards, refreshProfile]);

  // Initial load
  useEffect(() => {
    if (profile) {
      fetchRewards();
    }
  }, [profile, fetchRewards]);

  // Group rewards by category
  const rewardsByCategory = useMemo(() => {
    return rewards.reduce((acc, reward) => {
      if (!acc[reward.category]) {
        acc[reward.category] = [];
      }
      acc[reward.category].push(reward);
      return acc;
    }, {} as Record<string, LoyaltyReward[]>);
  }, [rewards]);

  if (loading && !refreshing) {
    return <LoyaltyScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="p-4 bg-primary/5 border-b border-primary/20">
          <View className="flex-row items-center mb-4">
            <Pressable
              onPress={() => router.back()}
              className="mr-3 p-2 rounded-full bg-background"
            >
              <ArrowLeft size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
            <View className="flex-row items-center gap-3">
              <Trophy size={24} color="#3b82f6" />
              <H2>Loyalty Rewards</H2>
            </View>
          </View>

          {/* Tier status and points */}
          <TierBadge tier={userTier} points={userPoints} size="large" />
        </View>

        {/* Quick stats */}
        <View className="p-4 border-b border-border">
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-primary">{userPoints}</Text>
              <Text className="text-sm text-muted-foreground">Total Points</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {rewards.filter(r => r.claimed).length}
              </Text>
              <Text className="text-sm text-muted-foreground">Claimed</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {rewards.filter(r => !r.claimed && userPoints >= r.pointsCost).length}
              </Text>
              <Text className="text-sm text-muted-foreground">Available</Text>
            </View>
          </View>
        </View>

        {/* Rewards sections */}
        <View className="p-4">
          {Object.entries(rewardsByCategory).length === 0 ? (
            <View className="py-8 items-center">
              <Gift size={48} color="#666" />
              <H3 className="mt-4 text-center">No Rewards Available</H3>
              <Text className="text-center text-muted-foreground mt-2">
                Check back later for new rewards and special offers.
              </Text>
            </View>
          ) : (
            Object.entries(rewardsByCategory).map(([category, categoryRewards]) => (
              <View key={category} className="mb-6">
                <View className="flex-row items-center gap-2 mb-3">
                  <H3 className="capitalize">
                    {REWARD_CATEGORIES[category as keyof typeof REWARD_CATEGORIES].name}
                  </H3>
                  <View className="bg-primary/10 px-2 py-1 rounded-full">
                    <Text className="text-xs text-primary">
                      {categoryRewards.length}
                    </Text>
                  </View>
                </View>
                {categoryRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userPoints={userPoints}
                    userTier={userTier}
                    onRedeem={handleRedeemReward}
                    loading={redeemingId === reward.id}
                  />
                ))}
              </View>
            ))
          )}
        </View>

        {/* Tier benefits */}
        <View className="p-4 border-t border-border">
          <H3 className="mb-3">Your {TIER_CONFIG[userTier].name} Benefits</H3>
          {TIER_CONFIG[userTier].benefits.map((benefit, index) => (
            <View key={index} className="flex-row items-center gap-3 mb-2">
              <CheckCircle size={16} color="#16a34a" />
              <Text className="text-sm">{benefit}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View className="p-4 border-t border-border">
          <View className="flex-row items-start gap-3">
            <Info size={16} color="#666" className="mt-1" />
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">
                Points are earned by dining at participating restaurants and leaving reviews. 
                Redeemed rewards expire 30 days after redemption. Terms and conditions apply.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}