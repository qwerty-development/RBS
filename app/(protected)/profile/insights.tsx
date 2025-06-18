// app/(protected)/profile/insights.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Users,
  Star,
  Utensils,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Award,
  Zap,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. TYPE DEFINITIONS
type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
  review?: Database["public"]["Tables"]["reviews"]["Row"];
};

interface InsightData {
  bookingTrends: BookingTrendData[];
  cuisinePreferences: CuisineData[];
  timePatterns: TimePatternData;
  spendingAnalytics: SpendingData;
  restaurantFrequency: RestaurantFrequencyData[];
  seasonalTrends: SeasonalData[];
  performanceMetrics: PerformanceData;
  loyaltyInsights: LoyaltyData;
}

interface BookingTrendData {
  month: string;
  bookings: number;
  completed: number;
  cancelled: number;
}

interface CuisineData {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface TimePatternData {
  preferredDay: string;
  preferredTime: string;
  dayDistribution: DayDistribution[];
  timeDistribution: TimeDistribution[];
}

interface DayDistribution {
  day: string;
  count: number;
  percentage: number;
}

interface TimeDistribution {
  timeSlot: string;
  count: number;
  percentage: number;
}

interface SpendingData {
  averagePerVisit: number;
  totalSpent: number;
  monthlySpending: MonthlySpendingData[];
  spendingByCategory: CategorySpendingData[];
  favoritesPriceRange: number;
}

interface MonthlySpendingData {
  month: string;
  amount: number;
}

interface CategorySpendingData {
  category: string;
  amount: number;
  percentage: number;
}

interface RestaurantFrequencyData {
  id: string;
  name: string;
  visits: number;
  lastVisit: string;
  cuisineType: string;
  averageRating: number;
}

interface SeasonalData {
  season: string;
  bookings: number;
  topCuisine: string;
  averageSpending: number;
}

interface PerformanceData {
  completionRate: number;
  averageRating: number;
  reviewRate: number;
  totalBookings: number;
  totalReviews: number;
}

interface LoyaltyData {
  pointsEarned: number;
  currentTier: string;
  tierProgress: number;
  nextTierPoints: number;
  pointsFromBookings: number;
  pointsFromReviews: number;
}

// 2. CONSTANTS
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;
const SMALL_CHART_HEIGHT = 150;
const CARD_MARGIN = 16;
const CHART_PADDING = 20;

const CUISINE_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1"
];

const TIME_SLOTS = [
  { start: 6, end: 11, label: "Morning" },
  { start: 11, end: 15, label: "Lunch" },
  { start: 15, end: 18, label: "Afternoon" },
  { start: 18, end: 22, label: "Dinner" },
  { start: 22, end: 6, label: "Late Night" },
];

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 3000,
};

const PRICE_RANGE_VALUES = {
  1: 25, // $ - Budget friendly
  2: 50, // $$ - Moderate
  3: 85, // $$$ - Upscale
  4: 150, // $$$$ - Fine dining
};

// 3. CUSTOM CHART COMPONENTS
const ProgressBar: React.FC<{
  value: number;
  maxValue: number;
  color: string;
  height?: number;
}> = ({ value, maxValue, color, height = 8 }) => {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  
  return (
    <View 
      className="bg-muted rounded-full overflow-hidden" 
      style={{ height }}
    >
      <View
        className="rounded-full"
        style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </View>
  );
};

const SimpleLineChart: React.FC<{
  data: Array<{ month: string; bookings: number; completed: number }>;
  height: number;
}> = ({ data, height }) => {
  if (!data.length) {
    return (
      <View 
        style={{ height }} 
        className="items-center justify-center"
      >
        <Text className="text-muted-foreground">No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => Math.max(d.bookings, d.completed)));
  const chartWidth = SCREEN_WIDTH - (CARD_MARGIN * 2) - (CHART_PADDING * 2);
  const chartHeight = height - 80; // Reserve space for labels and legend
  const pointSpacing = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;

  return (
    <View style={{ height }} className="w-full">
      {/* Chart Header */}
      <View className="flex-row justify-between mb-4 px-2">
        <Text className="text-xs text-muted-foreground">0</Text>
        <Text className="text-xs text-muted-foreground">{maxValue}</Text>
      </View>
      
      {/* Chart Container */}
      <View className="flex-1 relative justify-end" style={{ height: chartHeight }}>
        {data.map((item, index) => {
          const bookingHeight = maxValue > 0 ? Math.max((item.bookings / maxValue) * chartHeight * 0.8, 4) : 4;
          const completedHeight = maxValue > 0 ? Math.max((item.completed / maxValue) * chartHeight * 0.8, 4) : 4;
          
          return (
            <View 
              key={`${item.month}-${index}`}
              className="absolute bottom-8 items-center" 
              style={{ 
                left: Math.max(0, Math.min(index * pointSpacing, chartWidth - 20))
              }}
            >
              <View className="flex-row gap-1 items-end">
                <View
                  className="w-3 rounded-t"
                  style={{
                    height: bookingHeight,
                    backgroundColor: "#3b82f6",
                  }}
                />
                <View
                  className="w-3 rounded-t"
                  style={{
                    height: completedHeight,
                    backgroundColor: "#10b981",
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
      
      {/* X-axis labels */}
      <View className="flex-row justify-between px-2 mt-2">
        {data.map((item, index) => (
          <Text 
            key={`label-${item.month}-${index}`} 
            className="text-xs text-muted-foreground"
            style={{ 
              width: 40, 
              textAlign: 'center'
            }}
          >
            {item.month.slice(0, 3)}
          </Text>
        ))}
      </View>
      
      {/* Legend */}
      <View className="flex-row justify-center gap-6 mt-4">
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded bg-[#3b82f6]" />
          <Text className="text-xs text-muted-foreground">Total</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="w-3 h-3 rounded bg-[#10b981]" />
          <Text className="text-xs text-muted-foreground">Completed</Text>
        </View>
      </View>
    </View>
  );
};

const SimplePieChart: React.FC<{
  data: CuisineData[];
  size: number;
}> = ({ data, size }) => {
  if (!data.length) {
    return (
      <View 
        style={{ height: size }} 
        className="items-center justify-center"
      >
        <Text className="text-muted-foreground">No cuisine data</Text>
      </View>
    );
  }

  return (
    <View className="w-full">
      {/* Visual representation with horizontal bars */}
      <View className="space-y-4">
        {data.slice(0, 6).map((item, index) => (
          <View key={`${item.name}-${index}`} className="w-full">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-3 flex-1">
                <View
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <Text className="text-sm font-medium flex-shrink-1" numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground ml-2">
                {item.percentage}%
              </Text>
            </View>
            <ProgressBar
              value={item.count}
              maxValue={Math.max(...data.map(d => d.count))}
              color={item.color}
              height={8}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const TierProgressBar: React.FC<{ loyaltyData: LoyaltyData }> = ({ loyaltyData }) => {
  if (!loyaltyData) return null;
  
  const currentPoints = loyaltyData.pointsEarned || 0;
  const currentTier = loyaltyData.currentTier || 'bronze';
  const currentTierMin = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS] || 0;
  const nextTierMin = loyaltyData.nextTierPoints + currentPoints;
  const progress = nextTierMin > currentTierMin ? 
    Math.min(((currentPoints - currentTierMin) / (nextTierMin - currentTierMin)) * 100, 100) : 100;
  
  return (
    <View className="space-y-3">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-medium capitalize">{currentTier}</Text>
        <Text className="text-sm text-muted-foreground">
          {currentPoints} / {nextTierMin} pts
        </Text>
      </View>
      <ProgressBar
        value={Math.max(0, progress)}
        maxValue={100}
        color="#f59e0b"
        height={10}
      />
      <Text className="text-xs text-muted-foreground">
        {loyaltyData.nextTierPoints || 0} points to next tier
      </Text>
    </View>
  );
};

export default function InsightsScreen() {
  // 4. STATE MANAGEMENT
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"3m" | "6m" | "1y" | "all">("6m");

  // 5. DATA FETCHING AND PROCESSING
  const fetchInsightData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // 5.1 Calculate date range based on selected period
      const now = new Date();
      let startDate: Date;
      
      switch (selectedPeriod) {
        case "3m":
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case "6m":
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        case "1y":
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          break;
        default:
          startDate = new Date(2020, 0, 1); // Far back date for "all"
      }

      // 5.2 Fetch comprehensive booking data with restaurant details
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants(*),
          review:reviews(*)
        `)
        .eq("user_id", profile.id)
        .gte("booking_time", startDate.toISOString())
        .order("booking_time", { ascending: true });

      if (bookingsError) throw bookingsError;

      const bookings = bookingsData || [];

      // 5.3 Process all insights with error handling
      try {
        const bookingTrends = processBookingTrends(bookings);
        const cuisinePreferences = processCuisinePreferences(bookings);
        const timePatterns = processTimePatterns(bookings);
        const spendingAnalytics = await processSpendingAnalytics(bookings);
        const restaurantFrequency = processRestaurantFrequency(bookings);
        const seasonalTrends = processSeasonalTrends(bookings);
        const performanceMetrics = calculatePerformanceMetrics(bookings);
        const loyaltyInsights = calculateLoyaltyInsights(bookings, profile);

        setInsights({
          bookingTrends,
          cuisinePreferences,
          timePatterns,
          spendingAnalytics,
          restaurantFrequency,
          seasonalTrends,
          performanceMetrics,
          loyaltyInsights,
        });
      } catch (processingError) {
        console.error("Error processing insight data:", processingError);
        // Set empty insights to avoid crashes
        setInsights({
          bookingTrends: [],
          cuisinePreferences: [],
          timePatterns: {
            preferredDay: "N/A",
            preferredTime: "N/A",
            dayDistribution: [],
            timeDistribution: []
          },
          spendingAnalytics: {
            averagePerVisit: 0,
            totalSpent: 0,
            favoritesPriceRange: 2,
            monthlySpending: [],
            spendingByCategory: []
          },
          restaurantFrequency: [],
          seasonalTrends: [],
          performanceMetrics: {
            completionRate: 0,
            averageRating: 0,
            reviewRate: 0,
            totalBookings: 0,
            totalReviews: 0
          },
          loyaltyInsights: {
            pointsEarned: profile?.loyalty_points || 0,
            currentTier: profile?.membership_tier || 'bronze',
            tierProgress: 0,
            nextTierPoints: 500,
            pointsFromBookings: 0,
            pointsFromReviews: 0
          }
        });
      }

    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, selectedPeriod]);

  // 6. DATA PROCESSING FUNCTIONS
  const processBookingTrends = (bookings: Booking[]): BookingTrendData[] => {
    const monthlyData: Record<string, { bookings: number; completed: number; cancelled: number }> = {};
    
    bookings.forEach((booking) => {
      const month = new Date(booking.booking_time).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      
      if (!monthlyData[month]) {
        monthlyData[month] = { bookings: 0, completed: 0, cancelled: 0 };
      }
      
      monthlyData[month].bookings++;
      if (booking.status === "completed") monthlyData[month].completed++;
      if (booking.status.includes("cancelled")) monthlyData[month].cancelled++;
    });
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));
  };

  const processCuisinePreferences = (bookings: Booking[]): CuisineData[] => {
    const cuisineCounts: Record<string, number> = {};
    const total = bookings.length;
    
    bookings.forEach((booking) => {
      const cuisine = booking.restaurant?.cuisine_type || "Other";
      cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;
    });
    
    return Object.entries(cuisineCounts)
      .map(([name, count], index) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: CUISINE_COLORS[index % CUISINE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const processTimePatterns = (bookings: Booking[]): TimePatternData => {
    const dayCount: Record<string, number> = {};
    const timeSlotCount: Record<string, number> = {};
    
    bookings.forEach((booking) => {
      const date = new Date(booking.booking_time);
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const hour = date.getHours();
      
      dayCount[dayName] = (dayCount[dayName] || 0) + 1;
      
      // Categorize by time slot
      const timeSlot = TIME_SLOTS.find(slot => {
        if (slot.start <= slot.end) {
          return hour >= slot.start && hour < slot.end;
        } else {
          return hour >= slot.start || hour < slot.end;
        }
      });
      
      if (timeSlot) {
        timeSlotCount[timeSlot.label] = (timeSlotCount[timeSlot.label] || 0) + 1;
      }
    });
    
    const totalBookings = bookings.length;
    const preferredDay = Object.entries(dayCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A";
    const preferredTime = Object.entries(timeSlotCount).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A";
    
    const dayDistribution = Object.entries(dayCount).map(([day, count]) => ({
      day,
      count,
      percentage: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
    }));
    
    const timeDistribution = Object.entries(timeSlotCount).map(([timeSlot, count]) => ({
      timeSlot,
      count,
      percentage: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
    }));
    
    return {
      preferredDay,
      preferredTime,
      dayDistribution,
      timeDistribution,
    };
  };

  const processSpendingAnalytics = async (bookings: Booking[]): Promise<SpendingData> => {
    const completedBookings = bookings.filter(b => b.status === "completed");
    
    // Calculate spending based on restaurant price range and party size
    let totalSpent = 0;
    const monthlySpending: Record<string, number> = {};
    const categorySpending: Record<string, number> = {};
    
    completedBookings.forEach((booking) => {
      const priceRange = booking.restaurant?.price_range || 2;
      const basePrice = PRICE_RANGE_VALUES[priceRange as keyof typeof PRICE_RANGE_VALUES];
      const estimatedSpending = basePrice * booking.party_size;
      
      totalSpent += estimatedSpending;
      
      // Monthly breakdown
      const month = new Date(booking.booking_time).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      monthlySpending[month] = (monthlySpending[month] || 0) + estimatedSpending;
      
      // Category breakdown
      const category = booking.restaurant?.cuisine_type || "Other";
      categorySpending[category] = (categorySpending[category] || 0) + estimatedSpending;
    });
    
    const averagePerVisit = completedBookings.length > 0 ? totalSpent / completedBookings.length : 0;
    
    // Calculate favorite price range
    const priceRangeCounts: Record<number, number> = {};
    completedBookings.forEach((booking) => {
      const range = booking.restaurant?.price_range || 2;
      priceRangeCounts[range] = (priceRangeCounts[range] || 0) + 1;
    });
    const favoritesPriceRange = Object.entries(priceRangeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] ? 
      parseInt(Object.entries(priceRangeCounts).sort(([,a], [,b]) => b - a)[0][0]) : 2;
    
    return {
      averagePerVisit,
      totalSpent,
      favoritesPriceRange,
      monthlySpending: Object.entries(monthlySpending).map(([month, amount]) => ({
        month,
        amount,
      })),
      spendingByCategory: Object.entries(categorySpending).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      })),
    };
  };

  const processRestaurantFrequency = (bookings: Booking[]): RestaurantFrequencyData[] => {
    const restaurantData: Record<string, {
      name: string;
      visits: number;
      lastVisit: string;
      cuisineType: string;
      ratings: number[];
    }> = {};
    
    bookings.forEach((booking) => {
      const id = booking.restaurant_id;
      if (!restaurantData[id]) {
        restaurantData[id] = {
          name: booking.restaurant?.name || "Unknown",
          visits: 0,
          lastVisit: booking.booking_time,
          cuisineType: booking.restaurant?.cuisine_type || "Other",
          ratings: [],
        };
      }
      
      restaurantData[id].visits++;
      if (new Date(booking.booking_time) > new Date(restaurantData[id].lastVisit)) {
        restaurantData[id].lastVisit = booking.booking_time;
      }
      
      if (booking.review?.rating) {
        restaurantData[id].ratings.push(booking.review.rating);
      }
    });
    
    return Object.entries(restaurantData)
      .map(([id, data]) => ({
        id,
        name: data.name,
        visits: data.visits,
        lastVisit: data.lastVisit,
        cuisineType: data.cuisineType,
        averageRating: data.ratings.length > 0 ? 
          data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : 0,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  };

  const processSeasonalTrends = (bookings: Booking[]): SeasonalData[] => {
    const seasonData: Record<string, { 
      bookings: number; 
      cuisines: Record<string, number>;
      spending: number;
    }> = {
      Spring: { bookings: 0, cuisines: {}, spending: 0 },
      Summer: { bookings: 0, cuisines: {}, spending: 0 },
      Fall: { bookings: 0, cuisines: {}, spending: 0 },
      Winter: { bookings: 0, cuisines: {}, spending: 0 },
    };
    
    bookings.forEach((booking) => {
      const month = new Date(booking.booking_time).getMonth();
      let season: string;
      
      if (month >= 2 && month <= 4) season = "Spring";
      else if (month >= 5 && month <= 7) season = "Summer";
      else if (month >= 8 && month <= 10) season = "Fall";
      else season = "Winter";
      
      seasonData[season].bookings++;
      
      const cuisine = booking.restaurant?.cuisine_type || "Other";
      seasonData[season].cuisines[cuisine] = (seasonData[season].cuisines[cuisine] || 0) + 1;
      
      if (booking.status === "completed") {
        const priceRange = booking.restaurant?.price_range || 2;
        const basePrice = PRICE_RANGE_VALUES[priceRange as keyof typeof PRICE_RANGE_VALUES];
        seasonData[season].spending += basePrice * booking.party_size;
      }
    });
    
    return Object.entries(seasonData).map(([season, data]) => {
      const topCuisine = Object.entries(data.cuisines).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A";
      const averageSpending = data.bookings > 0 ? data.spending / data.bookings : 0;
      
      return {
        season,
        bookings: data.bookings,
        topCuisine,
        averageSpending,
      };
    });
  };

  const calculatePerformanceMetrics = (bookings: Booking[]): PerformanceData => {
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === "completed").length;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    
    // Calculate average rating from reviews
    const reviewedBookings = bookings.filter(b => b.review?.rating);
    const averageRating = reviewedBookings.length > 0 ? 
      reviewedBookings.reduce((sum, booking) => sum + (booking.review?.rating || 0), 0) / reviewedBookings.length : 0;
    
    // Calculate review rate
    const reviewRate = completedBookings > 0 ? (reviewedBookings.length / completedBookings) * 100 : 0;
    
    return {
      completionRate,
      averageRating,
      reviewRate,
      totalBookings,
      totalReviews: reviewedBookings.length,
    };
  };

  const calculateLoyaltyInsights = (bookings: Booking[], profile: any): LoyaltyData => {
    const pointsFromBookings = bookings
      .filter(b => b.status === "completed")
      .reduce((sum, booking) => sum + (booking.loyalty_points_earned || 0), 0);
    
    const pointsFromReviews = bookings.filter(b => b.review).length * 10; // Assume 10 points per review
    
    const totalPoints = profile?.loyalty_points || 0;
    const currentTier = profile?.membership_tier || 'bronze';
    
    const currentTierMin = TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS] || 0;
    const nextTierName = currentTier === 'platinum' ? 'platinum' : 
      Object.entries(TIER_THRESHOLDS).find(([tier, points]) => points > totalPoints)?.[0] || 'platinum';
    const nextTierMin = TIER_THRESHOLDS[nextTierName as keyof typeof TIER_THRESHOLDS] || 3000;
    
    const tierProgress = nextTierName === 'platinum' && currentTier === 'platinum' ? 100 :
      nextTierMin > currentTierMin ? ((totalPoints - currentTierMin) / (nextTierMin - currentTierMin)) * 100 : 0;
    
    return {
      pointsEarned: totalPoints,
      currentTier,
      tierProgress: Math.max(0, Math.min(tierProgress, 100)),
      nextTierPoints: nextTierName === currentTier ? 0 : Math.max(0, nextTierMin - totalPoints),
      pointsFromBookings,
      pointsFromReviews,
    };
  };

  // 7. LIFECYCLE MANAGEMENT
  useEffect(() => {
    if (profile) {
      fetchInsightData();
    }
  }, [profile, fetchInsightData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInsightData();
  }, [fetchInsightData]);

  // 8. MEMOIZED CHART DATA
  const chartData = useMemo(() => {
    if (!insights) return null;
    
    return {
      bookingTrends: insights.bookingTrends,
      cuisineData: insights.cuisinePreferences,
      dayPattern: insights.timePatterns.dayDistribution,
      timePattern: insights.timePatterns.timeDistribution,
      spendingTrends: insights.spendingAnalytics.monthlySpending,
    };
  }, [insights]);

  // 9. RENDER FUNCTIONS
  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 py-3 bg-background border-b border-border">
      <Pressable 
        onPress={() => router.back()} 
        className="p-2 -ml-2 rounded-lg"
        style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
      >
        <ArrowLeft size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
      </Pressable>
      <H1 className="flex-1 text-center">Dining Insights</H1>
      <View style={{ width: 44 }} />
    </View>
  );

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
                selectedPeriod === period ? "text-primary-foreground" : "text-muted-foreground"
              }`}
              numberOfLines={1}
            >
              {period === "3m" ? "3M" : period === "6m" ? "6M" : 
               period === "1y" ? "1Y" : "All"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderOverviewStats = () => {
    if (!insights) return null;
    
    return (
      <View className="mx-4 mb-6">
        <H2 className="mb-4 text-foreground">Overview</H2>
        <View className="flex-row flex-wrap gap-3">
          <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-2">
              <Activity size={20} color="#3b82f6" />
              <Text className="font-bold text-2xl text-foreground">
                {insights.performanceMetrics.totalBookings}
              </Text>
            </View>
            <Muted className="text-sm">Total Bookings</Muted>
          </View>
          
          <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-2">
              <Star size={20} color="#f59e0b" />
              <Text className="font-bold text-2xl text-foreground">
                {insights.performanceMetrics.averageRating > 0 ? insights.performanceMetrics.averageRating.toFixed(1) : "N/A"}
              </Text>
            </View>
            <Muted className="text-sm">Avg Rating Given</Muted>
          </View>
          
          <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-2">
              <DollarSign size={20} color="#10b981" />
              <Text className="font-bold text-2xl text-foreground">
                ${insights.spendingAnalytics.averagePerVisit.toFixed(0)}
              </Text>
            </View>
            <Muted className="text-sm">Avg Per Visit</Muted>
          </View>
          
          <View className="flex-1 min-w-[47%] bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-2">
              <Award size={20} color="#8b5cf6" />
              <Text className="font-bold text-xl capitalize text-foreground">
                {insights.loyaltyInsights?.currentTier || 'Bronze'}
              </Text>
            </View>
            <Muted className="text-sm">Loyalty Tier</Muted>
          </View>
        </View>
      </View>
    );
  };

  const renderLoyaltyInsights = () => {
    if (!insights?.loyaltyInsights) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card p-5 rounded-xl border border-border">
        <View className="flex-row items-center gap-3 mb-5">
          <Award size={20} color="#f59e0b" />
          <H3 className="text-foreground">Loyalty Progress</H3>
        </View>
        
        <TierProgressBar loyaltyData={insights.loyaltyInsights} />
        
        <View className="flex-row mt-5 gap-4">
          <View className="flex-1 bg-primary/5 p-3 rounded-lg">
            <Text className="text-sm text-muted-foreground mb-1">From Bookings</Text>
            <Text className="font-bold text-lg text-primary">
              {insights.loyaltyInsights.pointsFromBookings || 0} pts
            </Text>
          </View>
          <View className="flex-1 bg-secondary/5 p-3 rounded-lg">
            <Text className="text-sm text-muted-foreground mb-1">From Reviews</Text>
            <Text className="font-bold text-lg text-secondary">
              {insights.loyaltyInsights.pointsFromReviews || 0} pts
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderBookingTrends = () => {
    if (!chartData?.bookingTrends.length) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
        <View className="p-5 pb-0">
          <View className="flex-row items-center gap-3 mb-4">
            <TrendingUp size={20} color="#3b82f6" />
            <H3 className="text-foreground">Booking Trends</H3>
          </View>
        </View>
        <View className="px-5 pb-5">
          <SimpleLineChart data={chartData.bookingTrends} height={CHART_HEIGHT} />
        </View>
      </View>
    );
  };

  const renderCuisinePreferences = () => {
    if (!chartData?.cuisineData.length) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
        <View className="p-5 pb-0">
          <View className="flex-row items-center gap-3 mb-4">
            <PieChart size={20} color="#ef4444" />
            <H3 className="text-foreground">Cuisine Preferences</H3>
          </View>
        </View>
        <View className="px-5 pb-5">
          <SimplePieChart data={chartData.cuisineData} size={CHART_HEIGHT} />
        </View>
      </View>
    );
  };

  const renderTimePatterns = () => {
    if (!insights) return null;
    
    return (
      <View className="mx-4 mb-6">
        <H2 className="mb-4 text-foreground">Dining Patterns</H2>
        <View className="flex-row gap-3">
          {/* Day Preferences */}
          <View className="flex-1 bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-3">
              <Calendar size={18} color="#3b82f6" />
              <H3 className="text-base text-foreground">Favorite Day</H3>
            </View>
            <Text className="font-bold text-xl mb-3 text-foreground">
              {insights.timePatterns.preferredDay}
            </Text>
            <View className="space-y-2">
              {insights.timePatterns.dayDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map((day, index) => (
                  <View key={`${day.day}-${index}`} className="flex-row justify-between items-center">
                    <Text className="text-sm text-muted-foreground">
                      {day.day.slice(0, 3)}
                    </Text>
                    <Text className="text-sm font-medium text-foreground">{day.percentage}%</Text>
                  </View>
                ))}
            </View>
          </View>
          
          {/* Time Preferences */}
          <View className="flex-1 bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-3 mb-3">
              <Clock size={18} color="#f59e0b" />
              <H3 className="text-base text-foreground">Favorite Time</H3>
            </View>
            <Text className="font-bold text-xl mb-3 text-foreground">
              {insights.timePatterns.preferredTime}
            </Text>
            <View className="space-y-2">
              {insights.timePatterns.timeDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map((time, index) => (
                  <View key={`${time.timeSlot}-${index}`} className="flex-row justify-between items-center">
                    <Text className="text-sm text-muted-foreground">
                      {time.timeSlot}
                    </Text>
                    <Text className="text-sm font-medium text-foreground">{time.percentage}%</Text>
                  </View>
                ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTopRestaurants = () => {
    if (!insights?.restaurantFrequency.length) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
        <View className="p-5">
          <View className="flex-row items-center gap-3 mb-4">
            <MapPin size={20} color="#10b981" />
            <H3 className="text-foreground">Favorite Restaurants</H3>
          </View>
          <View className="space-y-4">
            {insights.restaurantFrequency.slice(0, 5).map((restaurant, index) => (
              <View key={`${restaurant.id}-${index}`} className="w-full">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 pr-3">
                    <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center flex-shrink-0">
                      <Text className="text-primary font-bold text-sm">
                        #{index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="font-medium text-foreground" numberOfLines={1}>
                        {restaurant.name}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Muted className="text-sm flex-shrink-1" numberOfLines={1}>
                          {restaurant.cuisineType}
                        </Muted>
                        {restaurant.averageRating > 0 && (
                          <View className="flex-row items-center gap-1 flex-shrink-0">
                            <Star size={12} color="#f59e0b" fill="#f59e0b" />
                            <Text className="text-xs text-muted-foreground">
                              {restaurant.averageRating.toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View className="items-end flex-shrink-0">
                    <Text className="font-bold text-foreground">{restaurant.visits} visits</Text>
                    <Muted className="text-xs">
                      {new Date(restaurant.lastVisit).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Muted>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderSpendingAnalytics = () => {
    if (!insights) return null;
    
    const priceRangeLabels = {
      1: "Budget ($)",
      2: "Moderate ($)", 
      3: "Upscale ($$)",
      4: "Fine Dining ($$)"
    };
    
    return (
      <View className="mx-4 mb-6 bg-card rounded-xl border border-border overflow-hidden">
        <View className="p-5">
          <View className="flex-row items-center gap-3 mb-4">
            <DollarSign size={20} color="#10b981" />
            <H3 className="text-foreground">Spending Analytics</H3>
          </View>
          
          <View className="flex-row gap-4 mb-5">
            <View className="flex-1 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
              <Text className="text-sm text-muted-foreground mb-1">Total Spent</Text>
              <Text className="font-bold text-xl text-foreground">
                ${insights.spendingAnalytics.totalSpent.toFixed(0)}
              </Text>
            </View>
            <View className="flex-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <Text className="text-sm text-muted-foreground mb-1">Preferred Range</Text>
              <Text className="font-bold text-base text-foreground" numberOfLines={1}>
                {priceRangeLabels[insights.spendingAnalytics.favoritesPriceRange as keyof typeof priceRangeLabels]}
              </Text>
            </View>
          </View>
          
          {insights.spendingAnalytics.spendingByCategory.length > 0 && (
            <View>
              <Text className="text-sm font-medium mb-3 text-foreground">Spending by Cuisine</Text>
              <View className="space-y-2">
                {insights.spendingAnalytics.spendingByCategory.slice(0, 3).map((category, index) => (
                  <View key={`${category.category}-${index}`} className="flex-row justify-between items-center">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {category.category}
                    </Text>
                    <Text className="text-sm font-medium text-muted-foreground">
                      ${category.amount.toFixed(0)} ({category.percentage}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  // 10. MAIN RENDER
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center px-4">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground text-center">Loading your dining insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!insights || insights.performanceMetrics.totalBookings === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center p-4">
          <BarChart3 size={64} color="#6b7280" />
          <H2 className="mt-4 text-center text-foreground">No Insights Available</H2>
          <Text className="text-center text-muted-foreground mt-2 max-w-sm">
            Start dining with us to see your personalized insights and patterns.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {renderHeader()}
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
        {renderOverviewStats()}
        {renderLoyaltyInsights()}
        {renderBookingTrends()}
        {renderCuisinePreferences()}
        {renderTimePatterns()}
        {renderSpendingAnalytics()}
        {renderTopRestaurants()}
      </ScrollView>
    </SafeAreaView>
  );
}