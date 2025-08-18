// app/(protected)/profile/rating-details.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import RatingDetailsScreenSkeleton from "@/components/skeletons/RatingDetailsScreenSkeleton";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react-native";
import { LineChart } from "react-native-chart-kit";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { UserRatingStats } from "@/components/rating/UserRatingStats";
import { UserRating } from "@/components/rating/UserRating";
import { useUserRating } from "@/hooks/useUserRating";
import { useColorScheme } from "@/lib/useColorScheme";

const { width: screenWidth } = Dimensions.get("window");

// Rating history item component
const RatingHistoryItem: React.FC<{
  item: {
    id: string;
    old_rating: number;
    new_rating: number;
    change_reason: string;
    created_at: string;
  };
}> = ({ item }) => {
  const ratingChange = item.new_rating - (item.old_rating || 5.0);
  const isPositive = ratingChange > 0;
  const isNeutral = ratingChange === 0;

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case "booking_completed":
        return <CheckCircle size={16} color="#10b981" />;
      case "booking_cancelled":
        return <XCircle size={16} color="#6b7280" />;
      case "no_show":
        return <AlertTriangle size={16} color="#ef4444" />;
      default:
        return <Clock size={16} color="#6b7280" />;
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case "booking_completed":
        return "Completed booking";
      case "booking_cancelled":
        return "Cancelled booking";
      case "no_show":
        return "No-show penalty";
      case "manual_refresh":
        return "Rating recalculated";
      default:
        return "Rating updated";
    }
  };

  const getTrendIcon = () => {
    if (isNeutral) return <Minus size={16} color="#6b7280" />;
    return isPositive ? (
      <TrendingUp size={16} color="#10b981" />
    ) : (
      <TrendingDown size={16} color="#ef4444" />
    );
  };

  return (
    <View className="flex-row items-center py-3 px-4 bg-card rounded-lg mb-2">
      <View className="mr-3">{getReasonIcon(item.change_reason)}</View>

      <View className="flex-1">
        <Text className="font-medium text-sm">
          {getReasonText(item.change_reason)}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <View className="items-end">
        <View className="flex-row items-center gap-1">
          {getTrendIcon()}
          <Text
            className={`text-sm font-medium ${
              isPositive
                ? "text-green-600"
                : isNeutral
                  ? "text-gray-600"
                  : "text-red-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {ratingChange.toFixed(1)}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {item.new_rating.toFixed(1)} ★
        </Text>
      </View>
    </View>
  );
};

export default function RatingDetailsPage() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);

  const {
    stats,
    history,
    loading,
    error,
    refresh,
    refreshRating,
    currentRating,
  } = useUserRating();

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  const handleManualRefresh = useCallback(async () => {
    Alert.alert(
      "Recalculate Rating",
      "This will recalculate your rating based on your current booking history. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Recalculate",
          onPress: async () => {
            try {
              await refreshRating();
              Alert.alert("Success", "Your rating has been updated!");
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to update rating. Please try again.",
              );
            }
          },
        },
      ],
    );
  }, [refreshRating]);

  // Create chart data for rating history
  const chartData = React.useMemo(() => {
    if (!history.length) return null;

    const sortedHistory = [...history].reverse();
    const labels = sortedHistory.map((item, index) => {
      if (
        index === 0 ||
        index === sortedHistory.length - 1 ||
        index % 3 === 0
      ) {
        return new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
      return "";
    });

    return {
      labels,
      datasets: [
        {
          data: sortedHistory.map((item) => item.new_rating),
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };
  }, [history]);

  const chartConfig = {
    backgroundColor: colorScheme === "dark" ? "#1f2937" : "#ffffff",
    backgroundGradientFrom: colorScheme === "dark" ? "#1f2937" : "#ffffff",
    backgroundGradientTo: colorScheme === "dark" ? "#1f2937" : "#ffffff",
    color: (opacity = 1) =>
      colorScheme === "dark"
        ? `rgba(255, 255, 255, ${opacity})`
        : `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#F2B25F", // Golden Crust
    },
  };

  if (loading && !stats) {
    return <RatingDetailsScreenSkeleton />;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-center text-red-600 mb-4">{error}</Text>
          <Button onPress={handleRefresh}>
            <Text>Try Again</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <H2>Reliability Score</H2>
        <Pressable onPress={handleManualRefresh} className="p-2 -mr-2">
          <RefreshCw size={20} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
      >
        {/* Main Rating Display */}
        <View className="items-center py-6 bg-card mx-4 mt-4 rounded-xl">
          <Text className="text-sm text-muted-foreground mb-2">
            Your Current Rating
          </Text>
          <UserRating
            rating={currentRating}
            size="lg"
            showNumber={true}
            className="mb-2"
          />
          {stats && (
            <Text className="text-lg font-bold text-primary">
              {stats.reliability_score}
            </Text>
          )}
        </View>

        {/* Info Banner */}
        <View className="mx-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <View className="flex-row items-start gap-2">
            <Info size={16} color="#2563eb" className="mt-0.5" />
            <View className="flex-1">
              <Text className="font-medium text-blue-800 mb-1">
                How Your Rating Works
              </Text>
              <Text className="text-blue-700 text-sm">
                Your reliability score is based on your booking completion rate,
                cancellation history, and no-shows. Recent activity is weighted
                more heavily.
              </Text>
            </View>
          </View>
        </View>

        {/* Detailed Stats */}
        {stats && (
          <View className="mt-4">
            <UserRatingStats stats={stats} className="mx-4" />
          </View>
        )}

        {/* Rating Trend Chart */}
        {chartData && history.length > 1 && (
          <View className="mx-4 mt-6">
            <H3 className="mb-4">Rating History</H3>
            <View className="bg-card rounded-xl p-4">
              <LineChart
                data={chartData}
                width={screenWidth - 64}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16,
                }}
                yAxisInterval={1}
                fromZero={false}
                segments={4}
              />
            </View>
          </View>
        )}

        {/* Recent Rating Changes */}
        {history.length > 0 && (
          <View className="mx-4 mt-6 mb-8">
            <H3 className="mb-4">Recent Changes</H3>
            <View>
              {history.slice(0, 10).map((item) => (
                <RatingHistoryItem key={item.id} item={item} />
              ))}
            </View>

            {history.length > 10 && (
              <Pressable
                onPress={() => {
                  /* TODO: Show full history */
                }}
                className="mt-3 p-3 bg-muted rounded-lg items-center"
              >
                <Text className="text-primary font-medium">
                  View All {history.length} Changes
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Empty State */}
        {history.length === 0 && stats && stats.total_bookings === 0 && (
          <View className="mx-4 mt-6 mb-8 items-center py-8">
            <Text className="text-center text-muted-foreground mb-4">
              No booking history yet
            </Text>
            <Text className="text-center text-sm text-muted-foreground mb-4">
              Your rating will update as you complete bookings and build your
              dining history.
            </Text>
            <Button onPress={() => router.push("/search")} className="mt-2">
              <Text>Explore Restaurants</Text>
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
