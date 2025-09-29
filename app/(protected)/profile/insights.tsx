// app/(protected)/profile/insights.tsx
import React, { useState } from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, BarChart3 } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2 } from "@/components/ui/typography";
import { BackHeader } from "@/components/ui/back-header";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

import { useInsightsData } from "@/hooks/useInsightsData";
import { InsightsOverviewStats } from "@/components/insights/InsightsOverviewStats";
import { InsightsLoyaltySection } from "@/components/insights/InsightsLoyaltySection";
import { InsightsBookingTrends } from "@/components/insights/InsightsBookingTrends";
import { InsightsCuisinePreferences } from "@/components/insights/InsightsCuisinePreferences";
import { InsightsTimePatterns } from "@/components/insights/InsightsTimePatterns";
import { InsightsSpendingAnalytics } from "@/components/insights/InsightsSpendingAnalytics";
import { InsightsTopRestaurants } from "@/components/insights/InsightsTopRestaurants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;

export default function InsightsScreen() {
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const [selectedPeriod, setSelectedPeriod] = useState<
    "3m" | "6m" | "1y" | "all"
  >("6m");
  const { insights, loading, refreshing, handleRefresh, TIER_THRESHOLDS } =
    useInsightsData(profile?.id, selectedPeriod);

  // Note: Period selector is defined below

  // Period Selector
  const renderPeriodSelector = () => (
    <View className="mx-4 mb-6 bg-muted rounded-xl p-1">
      <View className="flex-row">
        {(["3m", "6m", "1y", "all"] as const).map((period) => (
          <Pressable
            key={period}
            onPress={() => setSelectedPeriod(period)}
            className={`flex-1 py-3 px-2 rounded-lg ${
              selectedPeriod === period ? "bg-primary" : ""
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                selectedPeriod === period
                  ? "text-primary-foreground"
                  : "text-muted-foreground"
              }`}
              numberOfLines={1}
            >
              {period === "3m"
                ? "3M"
                : period === "6m"
                  ? "6M"
                  : period === "1y"
                    ? "1Y"
                    : "All"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  // Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BackHeader title="Dining Insights" />
        <View className="flex-1 items-center justify-center px-4">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Text className="mt-4 text-muted-foreground text-center">
            Loading your dining insights...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty State
  if (!insights || insights.performanceMetrics.totalBookings === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <BackHeader title="Dining Insights" />
        <View className="flex-1 items-center justify-center p-4">
          <BarChart3 size={64} color="#6b7280" />
          <H2 className="mt-4 text-center text-foreground">
            No Insights Available
          </H2>
          <Text className="text-center text-muted-foreground mt-2 max-w-sm">
            Start dining with us to see your personalized insights and patterns.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main Render
  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="Dining Insights" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {renderPeriodSelector()}
        <InsightsOverviewStats
          performanceMetrics={insights.performanceMetrics}
          spendingAnalytics={insights.spendingAnalytics}
          loyaltyInsights={insights.loyaltyInsights}
        />
        <InsightsLoyaltySection
          loyaltyInsights={insights.loyaltyInsights}
          tierThresholds={TIER_THRESHOLDS}
        />
        <InsightsBookingTrends
          bookingTrends={insights.bookingTrends}
          chartHeight={CHART_HEIGHT}
        />
        <InsightsCuisinePreferences
          cuisineData={insights.cuisinePreferences}
          chartHeight={CHART_HEIGHT}
        />
        <InsightsTimePatterns timePatterns={insights.timePatterns} />
        <InsightsSpendingAnalytics
          spendingAnalytics={insights.spendingAnalytics}
        />
        <InsightsTopRestaurants
          restaurantFrequency={insights.restaurantFrequency}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
