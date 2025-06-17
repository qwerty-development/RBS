import React from "react";
import { View, ScrollView, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Trophy, Gift, ChevronRight, Star, ArrowLeft } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

// Types for our rewards system
interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  imageUrl?: string;
  category: "food" | "discount" | "experience";
  isAvailable: boolean;
}

// Dummy data for rewards
const DUMMY_REWARDS: Reward[] = [
  {
    id: "1",
    title: "Free Appetizer",
    description: "Enjoy a complimentary appetizer at any participating restaurant",
    pointsCost: 500,
    category: "food",
    isAvailable: true,
  },
  {
    id: "2",
    title: "20% Off Your Next Meal",
    description: "Get 20% off your total bill at any participating restaurant",
    pointsCost: 1000,
    category: "discount",
    isAvailable: true,
  },
  {
    id: "3",
    title: "VIP Chef's Table Experience",
    description: "Exclusive chef's table experience with a special tasting menu",
    pointsCost: 2500,
    category: "experience",
    isAvailable: true,
  },
  {
    id: "4",
    title: "Free Dessert",
    description: "Complimentary dessert of your choice",
    pointsCost: 300,
    category: "food",
    isAvailable: true,
  },
  {
    id: "5",
    title: "50% Off Wine Bottle",
    description: "Half price on any bottle of wine",
    pointsCost: 800,
    category: "discount",
    isAvailable: true,
  },
];

// Reward Card Component
const RewardCard: React.FC<{
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
}> = ({ reward, userPoints, onRedeem }) => {
  const canAfford = userPoints >= reward.pointsCost;
  const { colorScheme } = useColorScheme();

  return (
    <Pressable
      onPress={() => canAfford && onRedeem(reward)}
      className={`p-4 rounded-xl mb-3 ${
        canAfford ? "bg-card" : "bg-muted/50"
      }`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="font-bold text-lg">{reward.title}</Text>
            <View className="flex-row items-center bg-primary/10 px-2 py-1 rounded-full">
              <Star size={14} color="#3b82f6" />
              <Text className="text-primary text-sm ml-1">{reward.pointsCost}</Text>
            </View>
          </View>
          <Muted className="text-sm mb-2">{reward.description}</Muted>
          <View className="flex-row items-center gap-2">
            <View
              className={`px-3 py-1 rounded-full ${
                reward.category === "food"
                  ? "bg-green-100"
                  : reward.category === "discount"
                  ? "bg-blue-100"
                  : "bg-purple-100"
              }`}
            >
              <Text
                className={`text-sm ${
                  reward.category === "food"
                    ? "text-green-700"
                    : reward.category === "discount"
                    ? "text-blue-700"
                    : "text-purple-700"
                }`}
              >
                {reward.category.charAt(0).toUpperCase() + reward.category.slice(1)}
              </Text>
            </View>
            {!canAfford && (
              <Text className="text-sm text-destructive">
                Need {reward.pointsCost - userPoints} more points
              </Text>
            )}
          </View>
        </View>
        <ChevronRight
          size={20}
          color={colorScheme === "dark" ? "#666" : "#999"}
        />
      </View>
    </Pressable>
  );
};

export default function LoyaltyScreen() {
  const { points } = useLocalSearchParams();
  const userPoints = Number(points);
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const handleRedeemReward = (reward: Reward) => {
    Alert.alert(
      "Redeem Reward",
      `Are you sure you want to redeem ${reward.title} for ${reward.pointsCost} points?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Redeem",
          onPress: () => {
            // TODO: Implement reward redemption logic when database is available
            Alert.alert(
              "Success",
              `You have successfully redeemed ${reward.title}!`
            );
          },
        },
      ]
    );
  };

  // Group rewards by category
  const rewardsByCategory = DUMMY_REWARDS.reduce((acc, reward) => {
    if (!acc[reward.category]) {
      acc[reward.category] = [];
    }
    acc[reward.category].push(reward);
    return acc;
  }, {} as Record<string, Reward[]>);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1">
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
          <View className="flex-row items-center gap-2">
            <Gift size={16} color="#666" />
            <Text className="text-lg font-bold">{userPoints}</Text>
            <Muted>points available</Muted>
          </View>
        </View>

        {/* Rewards Sections */}
        <View className="p-4">
          {Object.entries(rewardsByCategory).map(([category, rewards]) => (
            <View key={category} className="mb-6">
              <H3 className="mb-3 capitalize">{category} Rewards</H3>
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  userPoints={userPoints}
                  onRedeem={handleRedeemReward}
                />
              ))}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View className="p-4 border-t border-border">
          <Text className="text-center text-muted-foreground">
            Points are earned by dining at participating restaurants and completing special offers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
