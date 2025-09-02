import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import {
  SharedTableAvailability,
  SharedTableBooking,
} from "@/types/restaurant";

interface UseSharedTableAvailabilityOptions {
  restaurantId: string;
  date: Date;
  timeRange?: string;
  enableRealtime?: boolean;
}

interface SharedTableState {
  sharedTables: SharedTableAvailability[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
}

export function useSharedTableAvailability({
  restaurantId,
  date,
  timeRange,
  enableRealtime = true,
}: UseSharedTableAvailabilityOptions) {
  const { profile } = useAuth();
  const [state, setState] = useState<SharedTableState>({
    sharedTables: [],
    loading: false,
    error: null,
    lastUpdate: 0,
  });

  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Fetch shared table availability
  const fetchAvailability = useCallback(async (): Promise<
    SharedTableAvailability[]
  > => {
    if (!restaurantId) return [];

    const dateStr = date.toISOString().split("T")[0];

    // Get all shared tables for this restaurant
    const { data: sharedTables, error: tablesError } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("table_type", "shared")
      .eq("is_active", true);

    if (tablesError) throw tablesError;
    if (!sharedTables?.length) return [];

    const sharedTableAvailability: SharedTableAvailability[] = [];

    // For each shared table, calculate availability
    for (const table of sharedTables) {
      try {
        // Use the function we created in the migration
        const { data: availableSeats, error: availabilityError } =
          await supabase.rpc("get_shared_table_available_seats", {
            table_id_param: table.id,
            booking_time_param: new Date().toISOString(),
            turn_time_minutes_param: 120,
          });

        if (availabilityError) {
          console.error(
            "Error calculating availability for table:",
            table.id,
            availabilityError,
          );
          continue;
        }

        // Get current bookings for this table to show social info
        const { data: currentBookings, error: bookingsError } = await supabase
          .from("bookings")
          .select(
            `
              id,
              user_id,
              party_size,
              booking_time,
              status,
              is_shared_booking,
              profiles!bookings_user_id_fkey (
                full_name,
                privacy_settings
              ),
              booking_tables!inner (
                seats_occupied,
                table_id
              )
            `,
          )
          .eq("booking_tables.table_id", table.id)
          .eq("is_shared_booking", true)
          .in("status", ["pending", "confirmed", "arrived", "seated"])
          .gte("booking_time", dateStr);

        if (bookingsError) {
          console.error(
            "Error fetching bookings for table:",
            table.id,
            bookingsError,
          );
        }

        const currentBookingsList: SharedTableBooking[] = (
          currentBookings || []
        ).map((booking: any) => ({
          booking_id: booking.id,
          user_id: booking.user_id,
          user_name:
            booking.profiles?.privacy_settings?.profile_visibility === "public"
              ? booking.profiles.full_name
              : "Guest",
          party_size: booking.party_size,
          seats_occupied:
            booking.booking_tables[0]?.seats_occupied || booking.party_size,
          booking_time: booking.booking_time,
          status: booking.status,
          is_social:
            booking.profiles?.privacy_settings?.activity_sharing || false,
        }));

        const occupiedSeats = currentBookingsList.reduce(
          (sum, booking) => sum + booking.seats_occupied,
          0,
        );

        sharedTableAvailability.push({
          table_id: table.id,
          table: table,
          total_seats: table.capacity,
          available_seats: Math.max(0, availableSeats || 0),
          occupied_seats: occupiedSeats,
          current_bookings: currentBookingsList,
        });
      } catch (error) {
        console.error("Error processing table:", table.id, error);
      }
    }

    return sharedTableAvailability;
  }, [restaurantId, date.toISOString().split("T")[0]]);

  // Load availability data
  const loadAvailability = useCallback(async () => {
    if (!isMountedRef.current || !restaurantId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetchAvailability();

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          sharedTables: result || [],
          loading: false,
          lastUpdate: Date.now(),
        }));
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || "Failed to load shared table availability",
        }));
      }
    }
  }, [fetchAvailability, restaurantId]);

  // Book a shared table seat
  const bookSharedTableSeat = useCallback(
    async (
      tableId: string,
      partySize: number,
      bookingTime: Date,
      specialRequests?: string,
      isSocialBooking: boolean = false,
    ) => {
      if (!profile?.id || !restaurantId) {
        throw new Error("Authentication required");
      }

      // Check if enough seats are available
      const tableAvailability = state.sharedTables.find(
        (t) => t.table_id === tableId,
      );
      if (!tableAvailability || tableAvailability.available_seats < partySize) {
        throw new Error("Not enough seats available");
      }

      try {
        // Create the booking
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert({
            user_id: profile.id,
            restaurant_id: restaurantId,
            booking_time: bookingTime.toISOString(),
            party_size: partySize,
            status: "pending",
            special_requests: specialRequests,
            is_shared_booking: true,
            source: "app",
          })
          .select()
          .single();

        if (bookingError) throw bookingError;

        // Link the booking to the shared table
        const { error: linkError } = await supabase
          .from("booking_tables")
          .insert({
            booking_id: booking.id,
            table_id: tableId,
            seats_occupied: partySize,
          });

        if (linkError) throw linkError;

        // Refresh availability
        await loadAvailability();

        return booking;
      } catch (error: any) {
        throw new Error(error.message || "Failed to book shared table seat");
      }
    },
    [profile?.id, restaurantId, state.sharedTables, loadAvailability],
  );

  // Setup realtime subscription for shared table updates
  useEffect(() => {
    if (!enableRealtime || !restaurantId) return;

    const setupRealtimeSubscription = async () => {
      // Subscribe to booking changes that might affect shared tables
      subscriptionRef.current = supabase
        .channel(`shared-tables-${restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookings",
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => {
            // Refresh availability when bookings change
            loadAvailability();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "booking_tables",
          },
          () => {
            // Refresh availability when table assignments change
            loadAvailability();
          },
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [enableRealtime, restaurantId, loadAvailability]);

  // Initial load and cleanup
  useEffect(() => {
    loadAvailability();

    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [loadAvailability]);

  // Refresh function for pull-to-refresh
  const refresh = useCallback(async () => {
    await loadAvailability();
  }, [loadAvailability]);

  return {
    ...state,
    refresh,
    bookSharedTableSeat,
    isOffline: false, // Always online for now, can be enhanced later
  };
}
