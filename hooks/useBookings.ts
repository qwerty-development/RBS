import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TabType = "upcoming" | "past";
type SortType = "date_asc" | "date_desc" | "name_asc" | "name_desc";

export function useBookings() {
  const router = useRouter();
  const { profile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [bookings, setBookings] = useState<{
    upcoming: Booking[];
    past: Booking[];
  }>({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string | null>(
    null,
  );
  const [sort, setSort] = useState<SortType>("date_asc");

  // Data Fetching Functions
  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const now = new Date().toISOString();

      // Fetch upcoming bookings
      const { data: upcomingData, error: upcomingError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", profile.id)
        .in("status", ["pending", "confirmed"])
        .gte("booking_time", now)
        .order("booking_time", { ascending: sort === "date_asc" });

      if (upcomingError) throw upcomingError;

      // Fetch past bookings
      const { data: pastData, error: pastError } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", profile.id)
        .or(
          `booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`,
        )
        .order("booking_time", { ascending: sort === "date_asc" })
        .limit(50);

      if (pastError) throw pastError;

      setBookings({
        upcoming: upcomingData || [],
        past: pastData || [],
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      Alert.alert("Error", "Failed to load bookings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, sort]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("bookings-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings]);

  const sortedBookings = useMemo(() => {
    const sortFn = (a: Booking, b: Booking) => {
      switch (sort) {
        case "date_desc":
          return (
            new Date(b.booking_time).getTime() -
            new Date(a.booking_time).getTime()
          );
        case "name_asc":
          return a.restaurant.name.localeCompare(b.restaurant.name);
        case "name_desc":
          return b.restaurant.name.localeCompare(a.restaurant.name);
        default:
          return (
            new Date(a.booking_time).getTime() -
            new Date(b.booking_time).getTime()
          );
      }
    };
    return {
      upcoming: [...bookings.upcoming].sort(sortFn),
      past: [...bookings.past].sort(sortFn),
    };
  }, [bookings, sort]);

  // ... (rest of the hook)

  return {
    // State
    activeTab,
    setActiveTab,
    bookings: sortedBookings,
    loading,
    refreshing,
    processingBookingId,
    sort,
    setSort,

    // ... (actions)
  };
}
