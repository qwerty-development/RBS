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

import MyRewardsScreenSkeleton from "@/components/skeletons/MyRewardsScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useOffers } from "@/hooks/useOffers";
import { BackHeader } from "@/components/ui/back-header";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type UserOffer = Database["public"]["Tables"]["user_offers"]["Row"] & {
  special_offer: Database["public"]["Tables"]["special_offers"]["Row"] & {
    restaurant: Restaurant;
  };
};

interface EnrichedOffer extends UserOffer {
  isExpired: boolean;
  daysUntilExpiry: number;
  canUse: boolean;
}

// Reward status component
const RewardStatus: React.FC<{ reward: EnrichedOffer }> = ({ reward }) => {
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
        {reward.daysUntilExpiry === 0
          ? "Expires today"
          : `${reward.daysUntilExpiry}d left`}
      </Text>
    </View>
  );
};

// Claimed reward card component
const ClaimedRewardCard: React.FC<{
  reward: EnrichedOffer;
  onUse: (reward: EnrichedOffer) => void;
  onShare: (reward: EnrichedOffer) => void;
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
            <Text className="text-sm text-primary underline">
              {restaurant.name}
            </Text>
            <ExternalLink size={12} color="#666" />
          </Pressable>

          {/* Discount info */}
          <View className="flex-row items-center gap-2 mb-2">
            <View className="bg-primary/10 px-3 py-1 rounded-full">
              <Text className="text-primary font-bold">
                {offer.discount_percentage}% OFF
              </Text>
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
          <Button onPress={() => onUse(reward)} className="flex-1">
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
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  // Use useOffers for all reward logic
  const {
    getClaimedOffers,
    getActiveOffers,
    getUsedOffers,
    getExpiredOffers,
    useOffer,
    loading,
    error,
    fetchOffers,
  } = useOffers();
  const [filter, setFilter] = useState<"all" | "active" | "used" | "expired">(
    "all",
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Filtering
  const all = getClaimedOffers();
  const active = getActiveOffers();
  const used = getUsedOffers();
  const expired = getExpiredOffers();
  let filteredRewards = all;
  if (filter === "active") filteredRewards = active;
  else if (filter === "used") filteredRewards = used;
  else if (filter === "expired") filteredRewards = expired;
  // Handler for marking as used
  const handleUseReward = async (reward: EnrichedOffer) => {
    Alert.alert(
      "Use Reward",
      `Show this screen to the restaurant staff to use your ${reward.discount_percentage}% discount at ${reward.restaurant.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark as Used",
          onPress: async () => {
            setProcessingId(reward.id);
            try {
              await useOffer(reward.id);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("Success", "Reward marked as used!");
            } catch (error: any) {
              console.error("Error using reward:", error);
              Alert.alert("Error", "Failed to mark reward as used");
            }
            setProcessingId(null);
          },
        },
      ],
    );
  };
  // Handler for sharing
  const handleShareReward = async (reward: EnrichedOffer) => {
    const offer = reward;
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
  };
  // Handler for viewing restaurant
  const handleViewRestaurant = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };
  // Refresh handler
  const handleRefresh = () => {
    fetchOffers();
  };
  if (loading) {
    return <MyRewardsScreenSkeleton />;
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
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <H2>My Rewards</H2>
        </View>
        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
        >
          <View className="flex-row gap-2">
            {[
              { key: "all", label: "All", count: all.length },
              { key: "active", label: "Active", count: active.length },
              { key: "used", label: "Used", count: used.length },
              { key: "expired", label: "Expired", count: expired.length },
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
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
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
