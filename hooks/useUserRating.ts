// hooks/useUserRating.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface UserRatingStats {
  current_rating: number;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_show_bookings: number;
  completion_rate: number;
  reliability_score: string;
  rating_trend: string;
}

interface UserRatingHistory {
  id: string;
  old_rating: number;
  new_rating: number;
  booking_id?: string;
  change_reason: string;
  created_at: string;
}

export function useUserRating(userId?: string) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<UserRatingStats | null>(null);
  const [history, setHistory] = useState<UserRatingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || profile?.id;

  const fetchRatingStats = useCallback(async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      setError(null);

      // Call the database function to get rating stats
      const { data, error: statsError } = await supabase.rpc(
        "get_user_rating_stats",
        { p_user_id: targetUserId }
      );

      if (statsError) throw statsError;

      if (data && data.length > 0) {
        setStats(data[0]);
      }

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
  }, [targetUserId, userId, profile?.id]);

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
    stats,
    history,
    loading,
    error,
    refresh: fetchRatingStats,
    refreshRating,
    currentRating: stats?.current_rating || 5.0,
  };
}