// hooks/useUserRating.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import type { Database } from "@/types/supabase";
import {
  BookingEligibilityResult,
  UserRatingTierResult,
} from "@/types/database-functions";

// Types
interface UserRatingStats {
  current_rating: number;
  rating_count: number;
  excellent_count: number;
  good_count: number;
  average_count: number;
  poor_count: number;
  terrible_count: number;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_show_count: number;
  late_cancellation_count: number;
}

interface UserRatingHistory {
  id: string;
  user_id: string;
  rating_before: number;
  rating_after: number;
  booking_id?: string;
  change_reason: string;
  created_at: string;
}

export function useUserRating(userId?: string) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<UserRatingStats | null>(null);
  const [history, setHistory] = useState<UserRatingHistory[]>([]);
  const [eligibility, setEligibility] =
    useState<BookingEligibilityResult | null>(null);
  const [tier, setTier] = useState<UserRatingTierResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || profile?.id;

  // Check booking eligibility for a specific restaurant
  const checkBookingEligibility = useCallback(
    async (restaurantId: string): Promise<BookingEligibilityResult | null> => {
      if (!targetUserId) return null;

      try {
        const { data, error } = await supabase.rpc(
          "check_booking_eligibility",
          {
            user_id_param: targetUserId,
            restaurant_id_param: restaurantId,
            party_size_param: 1,
          },
        );

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
      } catch (err: any) {
        console.error("Error checking booking eligibility:", err);
        return null;
      }
    },
    [targetUserId],
  );

  // Get user rating tier
  const getUserRatingTier =
    useCallback(async (): Promise<UserRatingTierResult | null> => {
      if (!targetUserId || !stats?.current_rating) return null;

      try {
        const { data, error } = await supabase.rpc("get_user_rating_tier", {
          user_rating_param: stats.current_rating,
        });

        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
      } catch (err: any) {
        console.error("Error getting user rating tier:", err);
        return null;
      }
    }, [targetUserId, stats?.current_rating]);

  const fetchRatingStats = useCallback(async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      setError(null);

      // Call the database function to get rating stats
      const { data, error: statsError } = await supabase.rpc(
        "get_user_rating_stats",
        { p_user_id: targetUserId },
      );

      if (statsError) throw statsError;

      if (data && data.length > 0) {
        setStats(data[0]);
      }

      // Get user rating tier
      const tierData = await getUserRatingTier();
      setTier(tierData);

      // Fetch rating history if viewing own profile
      if (!userId && profile?.id === targetUserId) {
        const { data: historyData, error: historyError } = await supabase
          .from("user_rating_history")
          .select("*")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (historyError) {
          console.warn("Could not fetch rating history:", historyError);
        } else {
          setHistory(historyData || []);
        }
      }
    } catch (err: any) {
      console.error("Error fetching user rating:", err);
      setError(err.message || "Failed to fetch rating");
    } finally {
      setLoading(false);
    }
  }, [targetUserId, userId, profile?.id, getUserRatingTier]);

  const refreshRating = useCallback(async () => {
    if (!targetUserId) return;

    try {
      // Trigger rating recalculation
      const { error } = await supabase.rpc("update_user_rating", {
        p_user_id: targetUserId,
        p_change_reason: "manual_refresh",
      });

      if (error) throw error;

      // Refresh the data
      await fetchRatingStats();
    } catch (err: any) {
      console.error("Error refreshing rating:", err);
    }
  }, [targetUserId, fetchRatingStats]);

  useEffect(() => {
    if (targetUserId) {
      fetchRatingStats();
    }
  }, [targetUserId, fetchRatingStats]);

  return {
    // Data
    stats,
    history,
    eligibility,
    tier,

    // State
    loading,
    error,

    // Actions
    refresh: fetchRatingStats,
    refreshRating,
    checkBookingEligibility,
    getUserRatingTier,

    // Computed values
    currentRating: stats?.current_rating || 5.0,
    isExcellent: tier?.tier === "unrestricted", // For backward compatibility
    isGood: tier?.tier === "unrestricted", // For backward compatibility
    isRestricted: tier?.tier === "request_only",
    isBlocked: tier?.tier === "blocked",
    canBookInstant: tier ? tier.tier === "unrestricted" : true,
    hasRestrictions: tier
      ? ["request_only", "blocked"].indexOf(tier.tier) !== -1
      : false,
  };
}
