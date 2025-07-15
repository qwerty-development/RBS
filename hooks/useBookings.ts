// hooks/useBookings.ts - Updated with offline support
import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useNetwork } from "@/context/network-provider";
import { offlineStorage } from "@/utils/offlineStorage";
import { offlineSync } from "@/services/offlineSync";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

type TabType = "upcoming" | "past";

export function useBookings() {
  const router = useRouter();
  const { profile } = useAuth();
  const { isOnline, isOffline } = useNetwork();

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
  const [isFromCache, setIsFromCache] = useState(false);

  const hasInitialLoad = useRef(false);

  // Data Fetching Functions with offline support
  const fetchBookings = useCallback(async (forceOnline = false) => {
    if (!profile?.id) return;

    try {
      // If offline and not forcing online, try to load from cache
      if (isOffline && !forceOnline) {
        console.log("📱 Loading bookings from cache (offline)");
        const cachedBookings = await offlineStorage.getCachedBookings();
        
        if (cachedBookings) {
          setBookings(cachedBookings);
          setIsFromCache(true);
          return;
        } else {
          throw new Error("No cached bookings available");
        }
      }

      // Online fetch
      const now = new Date().toISOString();

      // Fetch upcoming bookings (pending, confirmed)
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
        .order("booking_time", { ascending: true });

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
          `booking_time.lt.${now},status.in.("completed","cancelled","no_show")`,
        )
        .order("booking_time", { ascending: false })
        .limit(50);

      if (pastError) throw pastError;

      const bookingsData = {
        upcoming: upcomingData || [],
        past: pastData || [],
      };

      setBookings(bookingsData);
      setIsFromCache(false);

      // Cache the data for offline use
      await offlineStorage.cacheBookings(bookingsData);
      console.log("💾 Bookings cached for offline use");
    } catch (error) {
      console.error("Error fetching bookings:", error);
      
      // If error and offline, try cache as fallback
      if (isOffline) {
        const cachedBookings = await offlineStorage.getCachedBookings();
        if (cachedBookings) {
          setBookings(cachedBookings);
          setIsFromCache(true);
          console.log("📱 Using cached bookings after error");
          return;
        }
      }
      
      Alert.alert(
        "Error",
        isOffline 
          ? "Unable to load bookings. Please check your internet connection."
          : "Failed to load bookings. Please try again.",
      );
    }
  }, [profile?.id, isOffline]);

  // Action Functions with offline queue support
  const cancelBooking = useCallback(
    async (bookingId: string) => {
      if (!bookingId) return;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setProcessingBookingId(bookingId);

        // If offline, add to queue
        if (isOffline) {
          await offlineStorage.addToOfflineQueue({
            type: 'UPDATE_BOOKING',
            payload: {
              id: bookingId,
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            },
          });

          // Update local state
          setBookings(prev => ({
            upcoming: prev.upcoming.filter(b => b.id !== bookingId),
            past: [...prev.past, ...prev.upcoming.filter(b => b.id === bookingId)],
          }));

          Alert.alert(
            "Booking Cancelled",
            "Your cancellation will be processed when you're back online.",
          );
          return;
        }

        // Online cancellation
        const { error } = await supabase
          .from("bookings")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", bookingId);

        if (error) throw error;

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        Alert.alert(
          "Booking Cancelled",
          "Your booking has been successfully cancelled.",
        );

        // Refresh bookings
        await fetchBookings();
      } catch (error) {
        console.error("Error cancelling booking:", error);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        Alert.alert(
          "Cancellation Failed",
          isOffline
            ? "Unable to cancel while offline. Please try again when connected."
            : "Failed to cancel booking. Please try again.",
        );
      } finally {
        setProcessingBookingId(null);
      }
    },
    [fetchBookings, isOffline],
  );

  // Load initial data
  useEffect(() => {
    if (!hasInitialLoad.current && profile?.id) {
      hasInitialLoad.current = true;
      setLoading(true);
      fetchBookings().finally(() => setLoading(false));
    }
  }, [profile?.id, fetchBookings]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && isFromCache) {
      console.log("🔄 Back online, refreshing bookings");
      
      // Sync any offline actions
      offlineSync.syncOfflineActions().then(result => {
        if (result.synced > 0) {
          fetchBookings(true); // Force online refresh
        }
      });
    }
  }, [isOnline, isFromCache, fetchBookings]);

  // Refresh function
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings(!isOffline); // Force online if possible
    setRefreshing(false);
  }, [fetchBookings, isOffline]);

  const navigateToBooking = useCallback(
    (bookingId: string) => {
      router.push(`/booking/${bookingId}`);
    },
    [router],
  );

  return {
    // Data
    activeTab,
    bookings,
    loading,
    refreshing,
    processingBookingId,
    isFromCache,
    
    // Actions
    setActiveTab,
    refresh,
    cancelBooking,
    navigateToBooking,
    
    // Network state
    isOnline,
    isOffline,
  };
}