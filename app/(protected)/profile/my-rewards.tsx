import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Gift,
  Clock,
  CheckCircle,
  Share2,
  MapPin,
  Calendar,
  Star,
  QrCode,
  ExternalLink,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type UserOffer = Database["public"]["Tables"]["user_offers"]["Row"] & {
  special_offer: Database["public"]["Tables"]["special_offers"]["Row"] & {
    restaurant: Restaurant;
  };
};

interface ClaimedReward extends UserOffer {
  isExpired: boolean;
  daysUntilExpiry: number;
  canUse: boolean;
}

// Reward status component
const RewardStatus: React.FC<{ reward: ClaimedReward }> = ({ reward }) => {
  if (reward.used_at) {
    return (
      <View className="flex-row items-center bg-green-100 px-3 py-1 rounded-full">
        <CheckCircle size={14} color="#16a34a" />
        <Text className="text-green-700 text-sm ml-1">Used</Text>
      </View>
    );
  }

  if (reward.isExpired) {
    return (
      <View className="flex-row items-center bg-red-100 px-3 py-1 rounded-full">
        <Clock size={14} color="#dc2626" />
        <Text className="text-red-700 text-sm ml-1">Expired</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center bg-blue-100 px-3 py-1 rounded-full">
      <Gift size={14} color="#2563eb" />
      <Text className="text-blue-700 text-sm ml-1">
        {reward.daysUntilExpiry === 0 ? "Expires today" : `${reward.daysUntilExpiry}d left`}
      </Text>
    </View>
  );
};

// Claimed reward card component
const ClaimedRewardCard: React.FC<{
  reward: ClaimedReward;
  onUse: (reward: ClaimedReward) => void;
  onShare: (reward: ClaimedReward) => void;
  onViewRestaurant: (restaurantId: string) => void;
}> = ({ reward, onUse, onShare, onViewRestaurant }) => {
  const { colorScheme } = useColorScheme();
  const offer = reward.special_offer;
  const restaurant = offer.restaurant;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View className="p-4 bg-card rounded-xl mb-3 border border-border">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="font-bold text-lg">{offer.title}</Text>
            <RewardStatus reward={reward} />
          </View>
          <Text className="text-sm text-muted-foreground mb-2">
            {offer.description}
          </Text>
          
          {/* Restaurant info */}
          <Pressable
            onPress={() => onViewRestaurant(restaurant.id)}
            className="flex-row items-center gap-2 mb-2"
          >
            <MapPin size={14} color="#666" />
            <Text className="text-sm text-primary underline">{restaurant.name}</Text>
            <ExternalLink size={12} color="#666" />
          </Pressable>

          {/* Discount info */}
          <View className="flex-row items-center gap-2 mb-2">
            <View className="bg-primary/10 px-3 py-1 rounded-full">
              <Text className="text-primary font-bold">{offer.discount_percentage}% OFF</Text>
            </View>
            {offer.minimum_party_size > 1 && (
              <View className="bg-muted px-3 py-1 rounded-full">
                <Text className="text-muted-foreground text-sm">
                  Min. {offer.minimum_party_size} people
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Dates */}
      <View className="border-t border-border pt-3 mb-3">
        <View className="flex-row justify-between text-sm">
          <View>
            <Text className="text-muted-foreground">Claimed</Text>
            <Text>{formatDate(reward.claimed_at)}</Text>
          </View>
          {reward.used_at ? (
            <View>
              <Text className="text-muted-foreground">Used</Text>
              <Text>{formatDate(reward.used_at)}</Text>
            </View>
          ) : (
            <View>
              <Text className="text-muted-foreground">Valid until</Text>
              <Text>{formatDate(offer.valid_until)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Terms and conditions */}
      {offer.terms_conditions && offer.terms_conditions.length > 0 && (
        <View className="mb-3">
          <Text className="text-sm font-medium mb-1">Terms & Conditions</Text>
          {offer.terms_conditions.slice(0, 2).map((term, index) => (
            <Text key={index} className="text-xs text-muted-foreground">
              • {term}
            </Text>
          ))}
          {offer.terms_conditions.length > 2 && (
            <Text className="text-xs text-muted-foreground">
              +{offer.terms_conditions.length - 2} more terms
            </Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View className="flex-row gap-3">
        {reward.canUse && !reward.used_at && (
          <Button
            onPress={() => onUse(reward)}
            className="flex-1"
          >
            <QrCode size={16} color="white" className="mr-2" />
            <Text className="text-white font-medium">Use Reward</Text>
          </Button>
        )}
        
        <Button
          variant="outline"
          onPress={() => onShare(reward)}
          className={reward.canUse && !reward.used_at ? "flex-none" : "flex-1"}
        >
          <Share2 size={16} color={colorScheme === "dark" ? "#fff" : "#000"} />
        </Button>
      </View>
    </View>
  );
};

export default function MyRewardsScreen() {
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // State management
  const [rewards, setRewards] = useState<ClaimedReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "used" | "expired">("all");

  // Fetch user's claimed rewards
  const fetchRewards = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("user_offers")
        .select(`
          *,
          special_offer:special_offers (
            *,
            restaurant:restaurants (*)
          )
        `)
        .eq("user_id", profile.id)
        .order("claimed_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const enrichedRewards: ClaimedReward[] = (data || []).map((reward) => {
        const claimedDate = new Date(reward.claimed_at);
        const validUntil = new Date(reward.special_offer.valid_until);
        const expiryDate = new Date(Math.min(
          claimedDate.getTime() + 30 * 24 * 60 * 60 * 1000, // 30 days from claim
          validUntil.getTime() // or offer expiry, whichever is sooner
        ));

        const isExpired = now > expiryDate;
        const daysUntilExpiry = Math.max(
          0,
          Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        );
        const canUse = !isExpired && !reward.used_at;

        return {
          ...reward,
          isExpired,
          daysUntilExpiry,
          canUse,
        };
      });

      setRewards(enrichedRewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      Alert.alert("Error", "Failed to load your rewards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Handle using a reward
  const handleUseReward = useCallback(async (reward: ClaimedReward) => {
    Alert.alert(
      "Use Reward",
      `Show this screen to the restaurant staff to use your ${reward.special_offer.discount_percentage}% discount at ${reward.special_offer.restaurant.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as Used",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("user_offers")
                .update({ used_at: new Date().toISOString() })
                .eq("id", reward.id);

              if (error) throw error;

              setRewards((prev) =>
                prev.map((r) =>
                  r.id === reward.id
                    ? { ...r, used_at: new Date().toISOString(), canUse: false }
                    : r
                )
              );

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "Reward marked as used!");
            } catch (error: any) {
              console.error("Error using reward:", error);
              Alert.alert("Error", "Failed to mark reward as used");
            }
          },
        },
      ]
    );
  }, []);

  // Handle sharing a reward
  const handleShareReward = useCallback(async (reward: ClaimedReward) => {
    const offer = reward.special_offer;
    const restaurant = offer.restaurant;

    const message = `Check out this ${offer.discount_percentage}% discount I got at ${restaurant.name}! "${offer.title}" - ${offer.description || "Great deal!"}`;

    try {
      await Share.share({
        message,
        title: `${offer.discount_percentage}% off at ${restaurant.name}`,
      });
    } catch (error) {
      console.error("Error sharing reward:", error);
    }
  }, []);

  // Navigate to restaurant
  const handleViewRestaurant = useCallback((restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  }, [router]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRewards();
  }, [fetchRewards]);

  // Filter rewards
  const filteredRewards = rewards.filter((reward) => {
    switch (filter) {
      case "active":
        return reward.canUse;
      case "used":
        return reward.used_at;
      case "expired":
        return reward.isExpired;
      default:
        return true;
    }
  });

  // Initial load
  useEffect(() => {
    if (profile) {
      fetchRewards();
    }
  }, [profile, fetchRewards]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-muted-foreground">Loading your rewards...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable
            onPress={() => router.back()}
            className="p-2 rounded-full bg-muted"
          >
            <ArrowLeft size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
          <H2>My Rewards</H2>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <View className="flex-row gap-2">
            {[
              { key: "all", label: "All", count: rewards.length },
              { key: "active", label: "Active", count: rewards.filter(r => r.canUse).length },
              { key: "used", label: "Used", count: rewards.filter(r => r.used_at).length },
              { key: "expired", label: "Expired", count: rewards.filter(r => r.isExpired).length },
            ].map(({ key, label, count }) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key as typeof filter)}
                className={`px-4 py-2 rounded-full ${
                  filter === key ? "bg-primary" : "bg-muted"
                }`}
              >
                <Text
                  className={`text-sm ${
                    filter === key ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {label} ({count})
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="p-4">
          {filteredRewards.length === 0 ? (
            <View className="py-8 items-center">
              <Gift size={48} color="#666" />
              <H3 className="mt-4 text-center">
                {filter === "all" ? "No Rewards Yet" : `No ${filter} rewards`}
              </H3>
              <Text className="text-center text-muted-foreground mt-2">
                {filter === "all"
                  ? "Redeem loyalty rewards to see them here."
                  : `You don't have any ${filter} rewards at the moment.`}
              </Text>
              {filter === "all" && (
                <Button
                  className="mt-4"
                  onPress={() => router.push("/profile/loyalty")}
                >
                  <Text className="text-white">Browse Rewards</Text>
                </Button>
              )}
            </View>
          ) : (
            filteredRewards.map((reward) => (
              <ClaimedRewardCard
                key={reward.id}
                reward={reward}
                onUse={handleUseReward}
                onShare={handleShareReward}
                onViewRestaurant={handleViewRestaurant}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}