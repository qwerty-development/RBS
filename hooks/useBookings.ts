import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useAuth } from "@/context/supabase-provider";

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

export function useBookings() {
  const { profile } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const now = new Date().toISOString();
      
      // Fetch upcoming bookings
      const { data: upcoming, error: upcomingError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants(*)
        `)
        .eq("user_id", profile.id)
        .in("status", ["pending", "confirmed"])
        .gte("booking_time", now)
        .order("booking_time", { ascending: true });
      
      if (upcomingError) throw upcomingError;
      
      // Fetch past bookings
      const { data: past, error: pastError } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants(*)
        `)
        .eq("user_id", profile.id)
        .or(`booking_time.lt.${now},status.in.(completed,cancelled_by_user,declined_by_restaurant,no_show)`)
        .order("booking_time", { ascending: false })
        .limit(50);
      
      if (pastError) throw pastError;
      
      setUpcomingBookings(upcoming || []);
      setPastBookings(past || []);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setError("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ 
          status: "cancelled_by_user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);
      
      if (error) throw error;
      
      // Refresh bookings
      await fetchBookings();
      
      return { success: true };
    } catch (err) {
      console.error("Error cancelling booking:", err);
      return { success: false, error: "Failed to cancel booking" };
    }
  }, [fetchBookings]);

  useEffect(() => {
    if (profile) {
      fetchBookings();
    }
  }, [profile, fetchBookings]);

  return {
    upcomingBookings,
    pastBookings,
    loading,
    error,
    refresh: fetchBookings,
    cancelBooking,
  };
}