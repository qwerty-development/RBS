// hooks/useLoyalty.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { NotificationHelpers } from "@/lib/NotificationHelpers";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
};

// Tier configuration
export const TIER_CONFIG = {
  bronze: {
    name: "Bronze",
    color: "#CD7F32",
    minPoints: 0,
    maxPoints: 499,
    benefits: [
      "Basic rewards access",
      "Birthday discount",
      "Welcome bonus points",
    ],
    pointsMultiplier: 1,
  },
  silver: {
    name: "Silver",
    color: "#C0C0C0",
    minPoints: 500,
    maxPoints: 1499,
    benefits: [
      "All Bronze benefits",
      "Exclusive silver offers",
      "Priority customer support",
      "10% bonus points on reviews",
    ],
    pointsMultiplier: 1.1,
  },
  gold: {
    name: "Gold",
    color: "#FFD700",
    minPoints: 1500,
    maxPoints: 2999,
    benefits: [
      "All Silver benefits",
      "VIP dining experiences",
      "Free delivery on orders",
      "20% bonus points on bookings",
      "Early access to new restaurants",
    ],
    pointsMultiplier: 1.2,
  },
  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    minPoints: 3000,
    maxPoints: Infinity,
    benefits: [
      "All Gold benefits",
      "Personal dining concierge",
      "Exclusive chef events",
      "50% bonus points on all activities",
      "Complimentary upgrades",
      "Annual dining credit",
    ],
    pointsMultiplier: 1.5,
  },
} as const;

export type TierType = keyof typeof TIER_CONFIG;

// Loyalty reward interface
export interface LoyaltyReward extends SpecialOffer {
  pointsCost: number;
  category: "food" | "discount" | "experience" | "tier_exclusive";
  tierRequired: TierType;
  claimed?: boolean;
  used?: boolean;
  isAvailable: boolean;
}

// User redemption interface
export interface UserRedemption {
  id: string;
  reward: LoyaltyReward;
  redeemedAt: string;
  usedAt?: string;
  expiresAt: string;
  isExpired: boolean;
  canUse: boolean;
}

// Points earning activities
export const POINTS_ACTIVITIES = {
  BOOKING_COMPLETED: {
    base: 50,
    description: "Completed dining reservation",
  },
  REVIEW_WRITTEN: {
    base: 25,
    description: "Written restaurant review",
  },
  PHOTO_UPLOADED: {
    base: 10,
    description: "Uploaded dining photo",
  },
  REFERRAL_SUCCESS: {
    base: 200,
    description: "Successful friend referral",
  },
  BIRTHDAY_BONUS: {
    base: 100,
    description: "Birthday bonus points",
  },
  STREAK_BONUS: {
    base: 25,
    description: "Dining streak bonus",
  },
} as const;

// Main loyalty hook
export function useLoyalty() {
  const { profile, refreshProfile } = useAuth();

  // State
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<UserRedemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User loyalty data
  const userPoints = profile?.loyalty_points || 0;
  const userTier = (profile?.membership_tier as TierType) || "bronze";
  const tierConfig = TIER_CONFIG[userTier];

  // Calculate tier progress
  const nextTier = useMemo(() => {
    if (userTier === "platinum") return null;
    return Object.entries(TIER_CONFIG).find(
      ([_, config]) => config.minPoints > userPoints,
    )?.[0] as TierType | null;
  }, [userTier, userPoints]);

  const tierProgress = useMemo(() => {
    if (!nextTier) return 100;
    const currentTierConfig = TIER_CONFIG[userTier];
    const nextTierConfig = TIER_CONFIG[nextTier];
    const progress =
      ((userPoints - currentTierConfig.minPoints) /
        (nextTierConfig.minPoints - currentTierConfig.minPoints)) *
      100;
    return Math.max(0, Math.min(progress, 100));
  }, [userTier, userPoints, nextTier]);

  const pointsToNextTier = useMemo(() => {
    if (!nextTier) return 0;
    return TIER_CONFIG[nextTier].minPoints - userPoints;
  }, [nextTier, userPoints]);

  // Fetch available rewards
  const fetchRewards = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Fetch available special offers as rewards
      const { data: offersData, error: offersError } = await supabase
        .from("special_offers")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
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
        claimedData?.map((c) => [
          c.offer_id,
          { claimed: true, used: !!c.used_at },
        ]) || [],
      );

      // Transform offers into loyalty rewards
      const loyaltyRewards: LoyaltyReward[] = (offersData || []).map(
        (offer) => {
          const claimed = claimedMap.get(offer.id);

          // Calculate point cost based on discount percentage and restaurant tier
          const basePointCost = Math.max(offer.discount_percentage * 25, 100);

          // Determine category based on offer characteristics
          let category: LoyaltyReward["category"] = "discount";
          const title = offer.title.toLowerCase();
          const description = (offer.description || "").toLowerCase();

          if (
            title.includes("dessert") ||
            title.includes("appetizer") ||
            title.includes("meal")
          ) {
            category = "food";
          } else if (
            title.includes("vip") ||
            title.includes("chef") ||
            title.includes("experience")
          ) {
            category = "experience";
          } else if (offer.discount_percentage >= 50) {
            category = "tier_exclusive";
          }

          // Determine tier requirement based on discount value and category
          let tierRequired: TierType = "bronze";
          if (category === "experience" || offer.discount_percentage >= 50) {
            tierRequired = "platinum";
          } else if (offer.discount_percentage >= 40) {
            tierRequired = "gold";
          } else if (offer.discount_percentage >= 25) {
            tierRequired = "silver";
          }

          // Calculate final point cost with category multiplier
          const categoryMultipliers = {
            food: 1,
            discount: 1.2,
            experience: 2.5,
            tier_exclusive: 2,
          };

          const pointsCost = Math.round(
            basePointCost * categoryMultipliers[category],
          );

          return {
            ...offer,
            pointsCost,
            category,
            tierRequired,
            claimed: claimed?.claimed || false,
            used: claimed?.used || false,
            isAvailable: true,
          };
        },
      );

      // Sort rewards by points cost
      loyaltyRewards.sort((a, b) => a.pointsCost - b.pointsCost);

      setRewards(loyaltyRewards);
    } catch (err: any) {
      console.error("Error fetching rewards:", err);
      setError(err.message || "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Fetch user's claimed rewards
  const fetchClaimedRewards = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("user_offers")
        .select(
          `
          *,
          special_offer:special_offers (
            *,
            restaurant:restaurants (*)
          )
        `,
        )
        .eq("user_id", profile.id)
        .order("claimed_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const enrichedRedemptions: UserRedemption[] = (data || []).map(
        (redemption) => {
          const claimedDate = new Date(redemption.claimed_at);
          const validUntil = new Date(redemption.special_offer.valid_until);

          // Rewards expire 30 days after claim or offer expiry, whichever is sooner
          const expiresAt = new Date(
            Math.min(
              claimedDate.getTime() + 30 * 24 * 60 * 60 * 1000,
              validUntil.getTime(),
            ),
          );

          const isExpired = now > expiresAt;
          const canUse = !isExpired && !redemption.used_at;

          // Convert to LoyaltyReward format
          const reward: LoyaltyReward = {
            ...redemption.special_offer,
            pointsCost: 0, // Already redeemed
            category: "discount", // Default category
            tierRequired: "bronze", // Default tier
            claimed: true,
            used: !!redemption.used_at,
            isAvailable: true,
          };

          return {
            ...redemption,
            reward,
            redeemedAt: redemption.claimed_at,
            usedAt: redemption.used_at || undefined,
            expiresAt: expiresAt.toISOString(),
            isExpired,
            canUse,
          };
        },
      );

      setClaimedRewards(enrichedRedemptions);
    } catch (err: any) {
      console.error("Error fetching claimed rewards:", err);
    }
  }, [profile?.id]);

  // Award points to user
  const awardPoints = useCallback(
    async (
      points: number,
      activity: keyof typeof POINTS_ACTIVITIES,
      relatedId?: string,
    ) => {
      if (!profile?.id) return false;

      try {
        // Apply tier multiplier
        const multipliedPoints = Math.round(
          points * tierConfig.pointsMultiplier,
        );

        const { error } = await supabase.rpc("award_loyalty_points", {
          p_user_id: profile.id,
          p_points: multipliedPoints,
        });

        if (error) throw error;

        // Refresh profile to get updated points and tier
        await refreshProfile();

        // Send loyalty points notification
        try {
          await NotificationHelpers.createLoyaltyNotification({
            restaurantId: relatedId || 'platform',
            restaurantName: 'Booklet Platform',
            points: multipliedPoints,
            action: 'points_earned',
            priority: 'default',
          });
        } catch (notificationError) {
          console.warn("Failed to send loyalty points notification:", notificationError);
        }

        return true;
      } catch (err: any) {
        console.error("Error awarding points:", err);
        return false;
      }
    },
    [profile?.id, tierConfig.pointsMultiplier, refreshProfile],
  );

  // Redeem reward
  const redeemReward = useCallback(
    async (reward: LoyaltyReward) => {
      if (!profile?.id) return false;

      try {
        const canAfford = userPoints >= reward.pointsCost;
        const tierAllowed =
          TIER_CONFIG[userTier].minPoints >=
          TIER_CONFIG[reward.tierRequired].minPoints;

        if (!canAfford || !tierAllowed) {
          throw new Error("Cannot redeem this reward");
        }

        // Start transaction - deduct points and claim offer
        const { error: deductError } = await supabase.rpc(
          "award_loyalty_points",
          {
            p_user_id: profile.id,
            p_points: -reward.pointsCost,
          },
        );

        if (deductError) throw deductError;

        // Claim the offer
        const { error: claimError } = await supabase
          .from("user_offers")
          .insert({
            user_id: profile.id,
            offer_id: reward.id,
          });

        if (claimError) {
          // Rollback points if claim fails
          await supabase.rpc("award_loyalty_points", {
            p_user_id: profile.id,
            p_points: reward.pointsCost,
          });
          throw claimError;
        }

        // Update local state
        setRewards((prev) =>
          prev.map((r) => (r.id === reward.id ? { ...r, claimed: true } : r)),
        );

        // Refresh profile and claimed rewards
        await refreshProfile();
        await fetchClaimedRewards();

        // Send reward redemption notification
        try {
          await NotificationHelpers.createLoyaltyNotification({
            restaurantId: reward.restaurant?.id || 'platform',
            restaurantName: reward.restaurant?.name || 'Booklet Platform',
            points: reward.pointsCost,
            action: 'points_redeemed',
            rewardId: reward.id,
            rewardName: reward.title,
            priority: 'default',
          });
        } catch (notificationError) {
          console.warn("Failed to send reward redemption notification:", notificationError);
        }

        return true;
      } catch (err: any) {
        console.error("Error redeeming reward:", err);
        throw err;
      }
    },
    [profile?.id, userPoints, userTier, refreshProfile, fetchClaimedRewards],
  );

  // Use claimed reward
  const useReward = useCallback(
    async (redemptionId: string) => {
      if (!profile?.id) return false;

      try {
        const { error } = await supabase
          .from("user_offers")
          .update({ used_at: new Date().toISOString() })
          .eq("id", redemptionId)
          .eq("user_id", profile.id);

        if (error) throw error;

        // Update local state
        setClaimedRewards((prev) =>
          prev.map((r) =>
            r.id === redemptionId
              ? { ...r, usedAt: new Date().toISOString(), canUse: false }
              : r,
          ),
        );

        return true;
      } catch (err: any) {
        console.error("Error using reward:", err);
        return false;
      }
    },
    [profile?.id],
  );

  // Calculate points for booking
  const calculateBookingPoints = useCallback(
    (
      partySize: number,
      priceRange: number,
      isRepeatCustomer: boolean = false,
    ) => {
      const basePoints = POINTS_ACTIVITIES.BOOKING_COMPLETED.base;
      const sizeMultiplier = Math.min(partySize * 0.2 + 0.8, 2); // Cap at 2x
      const priceMultiplier = priceRange * 0.3 + 0.7; // 0.7x to 1.6x based on price
      const repeatBonus = isRepeatCustomer ? 1.1 : 1;

      const totalPoints = Math.round(
        basePoints * sizeMultiplier * priceMultiplier * repeatBonus,
      );

      return Math.max(totalPoints, 10); // Minimum 10 points
    },
    [],
  );

  // Get tier benefits
  const getTierBenefits = useCallback(
    (tier: TierType = userTier) => {
      return TIER_CONFIG[tier].benefits;
    },
    [userTier],
  );

  // Check if user can access reward
  const canAccessReward = useCallback(
    (reward: LoyaltyReward) => {
      const canAfford = userPoints >= reward.pointsCost;
      const tierAllowed =
        TIER_CONFIG[userTier].minPoints >=
        TIER_CONFIG[reward.tierRequired].minPoints;
      const isAvailable = reward.isAvailable && !reward.claimed;

      return {
        canRedeem: canAfford && tierAllowed && isAvailable,
        canAfford,
        tierAllowed,
        isAvailable,
        reason: !canAfford
          ? "insufficient_points"
          : !tierAllowed
            ? "tier_required"
            : !isAvailable
              ? "unavailable"
              : null,
      };
    },
    [userPoints, userTier],
  );

  // Load data on mount
  useEffect(() => {
    if (profile) {
      fetchRewards();
      fetchClaimedRewards();
    }
  }, [profile, fetchRewards, fetchClaimedRewards]);

  return {
    // Data
    rewards,
    claimedRewards,
    userPoints,
    userTier,
    tierConfig,
    nextTier,
    tierProgress,
    pointsToNextTier,

    // State
    loading,
    error,

    // Actions
    fetchRewards,
    fetchClaimedRewards,
    awardPoints,
    redeemReward,
    useReward,

    // Utilities
    calculateBookingPoints,
    getTierBenefits,
    canAccessReward,

    // Constants
    TIER_CONFIG,
    POINTS_ACTIVITIES,
  };
}
