import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

// Type definitions
type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
  review?: Database["public"]["Tables"]["reviews"]["Row"];
};

export interface InsightData {
  bookingTrends: BookingTrendData[];
  cuisinePreferences: CuisineData[];
  timePatterns: TimePatternData;
  spendingAnalytics: SpendingData;
  restaurantFrequency: RestaurantFrequencyData[];
  seasonalTrends: SeasonalData[];
  performanceMetrics: PerformanceData;
  loyaltyInsights: LoyaltyData;
}

export interface BookingTrendData {
  month: string;
  bookings: number;
  completed: number;
  cancelled: number;
}

export interface CuisineData {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TimePatternData {
  preferredDay: string;
  preferredTime: string;
  dayDistribution: DayDistribution[];
  timeDistribution: TimeDistribution[];
}

export interface DayDistribution {
  day: string;
  count: number;
  percentage: number;
}

export interface TimeDistribution {
  timeSlot: string;
  count: number;
  percentage: number;
}

export interface SpendingData {
  averagePerVisit: number;
  totalSpent: number;
  monthlySpending: MonthlySpendingData[];
  spendingByCategory: CategorySpendingData[];
  favoritesPriceRange: number;
}

export interface MonthlySpendingData {
  month: string;
  amount: number;
}

export interface CategorySpendingData {
  category: string;
  amount: number;
  percentage: number;
}

export interface RestaurantFrequencyData {
  id: string;
  name: string;
  visits: number;
  lastVisit: string;
  cuisineType: string;
  averageRating: number;
}

export interface SeasonalData {
  season: string;
  bookings: number;
  topCuisine: string;
  averageSpending: number;
}

export interface PerformanceData {
  completionRate: number;
  averageRating: number;
  reviewRate: number;
  totalBookings: number;
  totalReviews: number;
}

export interface LoyaltyData {
  pointsEarned: number;
  currentTier: string;
  tierProgress: number;
  nextTierPoints: number;
  pointsFromBookings: number;
  pointsFromReviews: number;
}

// Constants
const CUISINE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
  "#6366f1",
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

export const useInsightsData = (
  userId: string | undefined,
  selectedPeriod: "3m" | "6m" | "1y" | "all"
) => {
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data processing functions
  const processBookingTrends = (bookings: Booking[]): BookingTrendData[] => {
    const monthlyData: Record<
      string,
      { bookings: number; completed: number; cancelled: number }
    > = {};

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
      const timeSlot = TIME_SLOTS.find((slot) => {
        if (slot.start <= slot.end) {
          return hour >= slot.start && hour < slot.end;
        } else {
          return hour >= slot.start || hour < slot.end;
        }
      });

      if (timeSlot) {
        timeSlotCount[timeSlot.label] =
          (timeSlotCount[timeSlot.label] || 0) + 1;
      }
    });

    const totalBookings = bookings.length;
    const preferredDay =
      Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";
    const preferredTime =
      Object.entries(timeSlotCount).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "N/A";

    const dayDistribution = Object.entries(dayCount).map(([day, count]) => ({
      day,
      count,
      percentage:
        totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
    }));

    const timeDistribution = Object.entries(timeSlotCount).map(
      ([timeSlot, count]) => ({
        timeSlot,
        count,
        percentage:
          totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
      })
    );

    return {
      preferredDay,
      preferredTime,
      dayDistribution,
      timeDistribution,
    };
  };

  const processSpendingAnalytics = async (
    bookings: Booking[]
  ): Promise<SpendingData> => {
    const completedBookings = bookings.filter((b) => b.status === "completed");

    // Calculate spending based on restaurant price range and party size
    let totalSpent = 0;
    const monthlySpending: Record<string, number> = {};
    const categorySpending: Record<string, number> = {};

    completedBookings.forEach((booking) => {
      const priceRange = booking.restaurant?.price_range || 2;
      const basePrice =
        PRICE_RANGE_VALUES[priceRange as keyof typeof PRICE_RANGE_VALUES];
      const estimatedSpending = basePrice * booking.party_size;

      totalSpent += estimatedSpending;

      // Monthly breakdown
      const month = new Date(booking.booking_time).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      monthlySpending[month] =
        (monthlySpending[month] || 0) + estimatedSpending;

      // Category breakdown
      const category = booking.restaurant?.cuisine_type || "Other";
      categorySpending[category] =
        (categorySpending[category] || 0) + estimatedSpending;
    });

    const averagePerVisit =
      completedBookings.length > 0 ? totalSpent / completedBookings.length : 0;

    // Calculate favorite price range
    const priceRangeCounts: Record<number, number> = {};
    completedBookings.forEach((booking) => {
      const range = booking.restaurant?.price_range || 2;
      priceRangeCounts[range] = (priceRangeCounts[range] || 0) + 1;
    });
    const favoritesPriceRange = Object.entries(priceRangeCounts).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0]
      ? parseInt(
          Object.entries(priceRangeCounts).sort(([, a], [, b]) => b - a)[0][0]
        )
      : 2;

    return {
      averagePerVisit,
      totalSpent,
      favoritesPriceRange,
      monthlySpending: Object.entries(monthlySpending).map(
        ([month, amount]) => ({
          month,
          amount,
        })
      ),
      spendingByCategory: Object.entries(categorySpending).map(
        ([category, amount]) => ({
          category,
          amount,
          percentage:
            totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        })
      ),
    };
  };

  const processRestaurantFrequency = (
    bookings: Booking[]
  ): RestaurantFrequencyData[] => {
    const restaurantData: Record<
      string,
      {
        name: string;
        visits: number;
        lastVisit: string;
        cuisineType: string;
        ratings: number[];
      }
    > = {};

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
      if (
        new Date(booking.booking_time) > new Date(restaurantData[id].lastVisit)
      ) {
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
        averageRating:
          data.ratings.length > 0
            ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
            : 0,
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  };

  const processSeasonalTrends = (bookings: Booking[]): SeasonalData[] => {
    const seasonData: Record<
      string,
      {
        bookings: number;
        cuisines: Record<string, number>;
        spending: number;
      }
    > = {
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
      seasonData[season].cuisines[cuisine] =
        (seasonData[season].cuisines[cuisine] || 0) + 1;

      if (booking.status === "completed") {
        const priceRange = booking.restaurant?.price_range || 2;
        const basePrice =
          PRICE_RANGE_VALUES[priceRange as keyof typeof PRICE_RANGE_VALUES];
        seasonData[season].spending += basePrice * booking.party_size;
      }
    });

    return Object.entries(seasonData).map(([season, data]) => {
      const topCuisine =
        Object.entries(data.cuisines).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        "N/A";
      const averageSpending =
        data.bookings > 0 ? data.spending / data.bookings : 0;

      return {
        season,
        bookings: data.bookings,
        topCuisine,
        averageSpending,
      };
    });
  };

  const calculatePerformanceMetrics = (
    bookings: Booking[]
  ): PerformanceData => {
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(
      (b) => b.status === "completed"
    ).length;
    const completionRate =
      totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    // Calculate average rating from reviews
    const reviewedBookings = bookings.filter((b) => b.review?.rating);
    const averageRating =
      reviewedBookings.length > 0
        ? reviewedBookings.reduce(
            (sum, booking) => sum + (booking.review?.rating || 0),
            0
          ) / reviewedBookings.length
        : 0;

    // Calculate review rate
    const reviewRate =
      completedBookings > 0
        ? (reviewedBookings.length / completedBookings) * 100
        : 0;

    return {
      completionRate,
      averageRating,
      reviewRate,
      totalBookings,
      totalReviews: reviewedBookings.length,
    };
  };

  const calculateLoyaltyInsights = (
    bookings: Booking[],
    profile: any
  ): LoyaltyData => {
    const pointsFromBookings = bookings
      .filter((b) => b.status === "completed")
      .reduce((sum, booking) => sum + (booking.loyalty_points_earned || 0), 0);

    const pointsFromReviews = bookings.filter((b) => b.review).length * 10; // Assume 10 points per review

    const totalPoints = profile?.loyalty_points || 0;
    const currentTier = profile?.membership_tier || "bronze";

    const currentTierMin =
      TIER_THRESHOLDS[currentTier as keyof typeof TIER_THRESHOLDS] || 0;
    const nextTierName =
      currentTier === "platinum"
        ? "platinum"
        : Object.entries(TIER_THRESHOLDS).find(
            ([tier, points]) => points > totalPoints
          )?.[0] || "platinum";
    const nextTierMin =
      TIER_THRESHOLDS[nextTierName as keyof typeof TIER_THRESHOLDS] || 3000;

    const tierProgress =
      nextTierName === "platinum" && currentTier === "platinum"
        ? 100
        : nextTierMin > currentTierMin
          ? ((totalPoints - currentTierMin) / (nextTierMin - currentTierMin)) *
            100
          : 0;

    return {
      pointsEarned: totalPoints,
      currentTier,
      tierProgress: Math.max(0, Math.min(tierProgress, 100)),
      nextTierPoints:
        nextTierName === currentTier
          ? 0
          : Math.max(0, nextTierMin - totalPoints),
      pointsFromBookings,
      pointsFromReviews,
    };
  };

  // Main data fetching function
  const fetchInsightData = useCallback(async () => {
    if (!userId) return;

    try {
      // Calculate date range based on selected period
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

      // Fetch comprehensive booking data with restaurant details
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants(*),
          review:reviews(*)
        `
        )
        .eq("user_id", userId)
        .gte("booking_time", startDate.toISOString())
        .order("booking_time", { ascending: true });

      if (bookingsError) throw bookingsError;

      const bookings = bookingsData || [];

      // Process all insights with error handling
      try {
        const bookingTrends = processBookingTrends(bookings);
        const cuisinePreferences = processCuisinePreferences(bookings);
        const timePatterns = processTimePatterns(bookings);
        const spendingAnalytics = await processSpendingAnalytics(bookings);
        const restaurantFrequency = processRestaurantFrequency(bookings);
        const seasonalTrends = processSeasonalTrends(bookings);
        const performanceMetrics = calculatePerformanceMetrics(bookings);

        // Get user profile for loyalty data
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

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
            timeDistribution: [],
          },
          spendingAnalytics: {
            averagePerVisit: 0,
            totalSpent: 0,
            favoritesPriceRange: 2,
            monthlySpending: [],
            spendingByCategory: [],
          },
          restaurantFrequency: [],
          seasonalTrends: [],
          performanceMetrics: {
            completionRate: 0,
            averageRating: 0,
            reviewRate: 0,
            totalBookings: 0,
            totalReviews: 0,
          },
          loyaltyInsights: {
            pointsEarned: 0,
            currentTier: "bronze",
            tierProgress: 0,
            nextTierPoints: 500,
            pointsFromBookings: 0,
            pointsFromReviews: 0,
          },
        });
      }
    } catch (error) {
      console.error("Error fetching insights:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, selectedPeriod]);

  // Lifecycle management
  useEffect(() => {
    if (userId) {
      fetchInsightData();
    }
  }, [userId, fetchInsightData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInsightData();
  }, [fetchInsightData]);

  return {
    insights,
    loading,
    refreshing,
    handleRefresh,
    TIER_THRESHOLDS,
  };
};
