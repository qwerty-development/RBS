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
import {
  LineChart,
  BarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from "recharts";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// 1. TYPE DEFINITIONS
interface InsightData {
  bookingTrends: BookingTrendData[];
  cuisinePreferences: CuisineData[];
  timePatterns: TimePatternData;
  spendingAnalytics: SpendingData;
  restaurantFrequency: RestaurantFrequencyData[];
  seasonalTrends: SeasonalData[];
  performanceMetrics: PerformanceData;
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
}

interface SeasonalData {
  season: string;
  bookings: number;
  topCuisine: string;
}

interface PerformanceData {
  completionRate: number;
  averageRating: number;
  reviewRate: number;
  loyalty: {
    pointsEarned: number;
    tierProgress: number;
    nextTierPoints: number;
  };
}

// 2. CONSTANTS
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;
const SMALL_CHART_HEIGHT = 150;

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

export default function InsightsScreen() {
  // 3. STATE MANAGEMENT
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"3m" | "6m" | "1y" | "all">("6m");

  // 4. DATA FETCHING AND PROCESSING
  const fetchInsightData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // 4.1 Calculate date range based on selected period
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

      // 4.2 Fetch comprehensive booking data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants(
            name,
            cuisine_type,
            price_range
          ),
          review:reviews(rating)
        `)
        .eq("user_id", profile.id)
        .gte("booking_time", startDate.toISOString())
        .order("booking_time", { ascending: true });

      if (bookingsError) throw bookingsError;

      // 4.3 Process booking trends
      const bookingTrends = processBookingTrends(bookingsData || []);
      
      // 4.4 Process cuisine preferences
      const cuisinePreferences = processCuisinePreferences(bookingsData || []);
      
      // 4.5 Process time patterns
      const timePatterns = processTimePatterns(bookingsData || []);
      
      // 4.6 Process spending analytics
      const spendingAnalytics = await processSpendingAnalytics(bookingsData || []);
      
      // 4.7 Process restaurant frequency
      const restaurantFrequency = processRestaurantFrequency(bookingsData || []);
      
      // 4.8 Process seasonal trends
      const seasonalTrends = processSeasonalTrends(bookingsData || []);
      
      // 4.9 Calculate performance metrics
      const performanceMetrics = await calculatePerformanceMetrics(bookingsData || []);

      setInsights({
        bookingTrends,
        cuisinePreferences,
        timePatterns,
        spendingAnalytics,
        restaurantFrequency,
        seasonalTrends,
        performanceMetrics,
      });

    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, selectedPeriod]);

  // 5. DATA PROCESSING FUNCTIONS
  const processBookingTrends = (bookings: any[]): BookingTrendData[] => {
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

  const processCuisinePreferences = (bookings: any[]): CuisineData[] => {
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
      .slice(0, 8); // Top 8 cuisines
  };

  const processTimePatterns = (bookings: any[]): TimePatternData => {
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

  const processSpendingAnalytics = async (bookings: any[]): Promise<SpendingData> => {
    // Mock implementation - in real app, fetch from bills/payments table
    const completedBookings = bookings.filter(b => b.status === "completed");
    const totalSpent = completedBookings.length * 85; // Mock average
    const averagePerVisit = completedBookings.length > 0 ? totalSpent / completedBookings.length : 0;
    
    const monthlySpending = processMonthlySpending(completedBookings);
    const spendingByCategory = processCategorySpending(completedBookings);
    
    return {
      averagePerVisit,
      totalSpent,
      monthlySpending,
      spendingByCategory,
    };
  };

  const processMonthlySpending = (bookings: any[]): MonthlySpendingData[] => {
    const monthlyData: Record<string, number> = {};
    
    bookings.forEach((booking) => {
      const month = new Date(booking.booking_time).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      // Mock spending calculation
      monthlyData[month] = (monthlyData[month] || 0) + 85;
    });
    
    return Object.entries(monthlyData).map(([month, amount]) => ({
      month,
      amount,
    }));
  };

  const processCategorySpending = (bookings: any[]): CategorySpendingData[] => {
    const categoryData: Record<string, number> = {};
    let total = 0;
    
    bookings.forEach((booking) => {
      const category = booking.restaurant?.cuisine_type || "Other";
      const amount = 85; // Mock amount
      categoryData[category] = (categoryData[category] || 0) + amount;
      total += amount;
    });
    
    return Object.entries(categoryData).map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }));
  };

  const processRestaurantFrequency = (bookings: any[]): RestaurantFrequencyData[] => {
    const restaurantData: Record<string, {
      name: string;
      visits: number;
      lastVisit: string;
      cuisineType: string;
    }> = {};
    
    bookings.forEach((booking) => {
      const id = booking.restaurant_id;
      if (!restaurantData[id]) {
        restaurantData[id] = {
          name: booking.restaurant?.name || "Unknown",
          visits: 0,
          lastVisit: booking.booking_time,
          cuisineType: booking.restaurant?.cuisine_type || "Other",
        };
      }
      
      restaurantData[id].visits++;
      if (new Date(booking.booking_time) > new Date(restaurantData[id].lastVisit)) {
        restaurantData[id].lastVisit = booking.booking_time;
      }
    });
    
    return Object.entries(restaurantData)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  };

  const processSeasonalTrends = (bookings: any[]): SeasonalData[] => {
    const seasonData: Record<string, { bookings: number; cuisines: Record<string, number> }> = {
      Spring: { bookings: 0, cuisines: {} },
      Summer: { bookings: 0, cuisines: {} },
      Fall: { bookings: 0, cuisines: {} },
      Winter: { bookings: 0, cuisines: {} },
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
    });
    
    return Object.entries(seasonData).map(([season, data]) => {
      const topCuisine = Object.entries(data.cuisines).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A";
      return {
        season,
        bookings: data.bookings,
        topCuisine,
      };
    });
  };

  const calculatePerformanceMetrics = async (bookings: any[]): Promise<PerformanceData> => {
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === "completed").length;
    const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    
    // Calculate average rating from reviews
    const ratingsSum = bookings.reduce((sum, booking) => {
      return sum + (booking.review?.rating || 0);
    }, 0);
    const averageRating = bookings.length > 0 ? ratingsSum / bookings.length : 0;
    
    // Calculate review rate
    const reviewedBookings = bookings.filter(b => b.review).length;
    const reviewRate = completedBookings > 0 ? (reviewedBookings / completedBookings) * 100 : 0;
    
    return {
      completionRate,
      averageRating,
      reviewRate,
      loyalty: {
        pointsEarned: profile?.loyalty_points || 0,
        tierProgress: 65, // Mock calculation
        nextTierPoints: 500 - (profile?.loyalty_points || 0),
      },
    };
  };

  // 6. LIFECYCLE MANAGEMENT
  useEffect(() => {
    if (profile) {
      fetchInsightData();
    }
  }, [profile, fetchInsightData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInsightData();
  }, [fetchInsightData]);

  // 7. MEMOIZED CHART DATA
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

  // 8. RENDER FUNCTIONS
  const renderHeader = () => (
    <View className="flex-row items-center justify-between p-4">
      <Pressable onPress={() => router.back()} className="p-2 -ml-2">
        <ArrowLeft size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
      </Pressable>
      <H1>Dining Insights</H1>
      <View className="w-8" />
    </View>
  );

  const renderPeriodSelector = () => (
    <View className="flex-row mx-4 mb-6 bg-muted rounded-lg p-1">
      {(["3m", "6m", "1y", "all"] as const).map((period) => (
        <Pressable
          key={period}
          onPress={() => setSelectedPeriod(period)}
          className={`flex-1 py-2 px-3 rounded-md ${
            selectedPeriod === period ? "bg-primary" : ""
          }`}
        >
          <Text
            className={`text-center text-sm font-medium ${
              selectedPeriod === period ? "text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {period === "3m" ? "3 Months" : period === "6m" ? "6 Months" : 
             period === "1y" ? "1 Year" : "All Time"}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderOverviewStats = () => {
    if (!insights) return null;
    
    return (
      <View className="mx-4 mb-6">
        <H2 className="mb-4">Overview</H2>
        <View className="flex-row flex-wrap gap-3">
          <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Activity size={20} color="#3b82f6" />
              <Text className="font-bold text-2xl">
                {insights.performanceMetrics.completionRate.toFixed(0)}%
              </Text>
            </View>
            <Muted className="text-sm">Completion Rate</Muted>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Star size={20} color="#f59e0b" />
              <Text className="font-bold text-2xl">
                {insights.performanceMetrics.averageRating.toFixed(1)}
              </Text>
            </View>
            <Muted className="text-sm">Avg Rating Given</Muted>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <DollarSign size={20} color="#10b981" />
              <Text className="font-bold text-2xl">
                ${insights.spendingAnalytics.averagePerVisit.toFixed(0)}
              </Text>
            </View>
            <Muted className="text-sm">Avg Per Visit</Muted>
          </View>
          
          <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Clock size={20} color="#8b5cf6" />
              <Text className="font-bold text-xl">
                {insights.timePatterns.preferredTime}
              </Text>
            </View>
            <Muted className="text-sm">Preferred Time</Muted>
          </View>
        </View>
      </View>
    );
  };

  const renderBookingTrends = () => {
    if (!chartData?.bookingTrends.length) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <View className="flex-row items-center gap-2 mb-4">
          <TrendingUp size={20} color="#3b82f6" />
          <H3>Booking Trends</H3>
        </View>
        <View style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData.bookingTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: colorScheme === "dark" ? "#1f2937" : "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                name="Total Bookings"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </View>
      </View>
    );
  };

  const renderCuisinePreferences = () => {
    if (!chartData?.cuisineData.length) return null;
    
    return (
      <View className="mx-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <View className="flex-row items-center gap-2 mb-4">
          <PieChart size={20} color="#ef4444" />
          <H3>Cuisine Preferences</H3>
        </View>
        <View style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: colorScheme === "dark" ? "#1f2937" : "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <RechartsPieChart
                data={chartData.cuisineData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
              >
                {chartData.cuisineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </RechartsPieChart>
              <Legend />
            </RechartsPieChart>
          </ResponsiveContainer>
        </View>
      </View>
    );
  };

  const renderTimePatterns = () => {
    if (!insights) return null;
    
    return (
      <View className="mx-4 mb-6">
        <H2 className="mb-4">Dining Patterns</H2>
        <View className="flex-row gap-3">
          {/* Day Preferences */}
          <View className="flex-1 bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-2 mb-3">
              <Calendar size={18} color="#3b82f6" />
              <H3 className="text-base">Favorite Day</H3>
            </View>
            <Text className="font-bold text-xl mb-2">
              {insights.timePatterns.preferredDay}
            </Text>
            <View className="space-y-1">
              {insights.timePatterns.dayDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map((day) => (
                  <View key={day.day} className="flex-row justify-between items-center">
                    <Text className="text-sm text-muted-foreground">
                      {day.day.slice(0, 3)}
                    </Text>
                    <Text className="text-sm font-medium">{day.percentage}%</Text>
                  </View>
                ))}
            </View>
          </View>
          
          {/* Time Preferences */}
          <View className="flex-1 bg-card p-4 rounded-xl border border-border">
            <View className="flex-row items-center gap-2 mb-3">
              <Clock size={18} color="#f59e0b" />
              <H3 className="text-base">Favorite Time</H3>
            </View>
            <Text className="font-bold text-xl mb-2">
              {insights.timePatterns.preferredTime}
            </Text>
            <View className="space-y-1">
              {insights.timePatterns.timeDistribution
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map((time) => (
                  <View key={time.timeSlot} className="flex-row justify-between items-center">
                    <Text className="text-sm text-muted-foreground">
                      {time.timeSlot}
                    </Text>
                    <Text className="text-sm font-medium">{time.percentage}%</Text>
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
      <View className="mx-4 mb-6 bg-card p-4 rounded-xl border border-border">
        <View className="flex-row items-center gap-2 mb-4">
          <MapPin size={20} color="#10b981" />
          <H3>Favorite Restaurants</H3>
        </View>
        <View className="space-y-3">
          {insights.restaurantFrequency.slice(0, 5).map((restaurant, index) => (
            <View key={restaurant.id} className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold text-sm">
                    #{index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{restaurant.name}</Text>
                  <Muted className="text-sm">{restaurant.cuisineType}</Muted>
                </View>
              </View>
              <View className="items-end">
                <Text className="font-bold">{restaurant.visits} visits</Text>
                <Muted className="text-xs">
                  Last: {new Date(restaurant.lastVisit).toLocaleDateString()}
                </Muted>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // 9. MAIN RENDER
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground">Loading your dining insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!insights) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        {renderHeader()}
        <View className="flex-1 items-center justify-center p-4">
          <BarChart3 size={64} color="#6b7280" />
          <H2 className="mt-4 text-center">No Insights Available</H2>
          <Text className="text-center text-muted-foreground mt-2">
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
      >
        {renderPeriodSelector()}
        {renderOverviewStats()}
        {renderBookingTrends()}
        {renderCuisinePreferences()}
        {renderTimePatterns()}
        {renderTopRestaurants()}
        
        {/* Footer spacer */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}