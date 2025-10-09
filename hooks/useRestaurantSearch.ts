// hooks/useRestaurantSearch.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { format } from "date-fns";
import debounce from "lodash.debounce";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface SearchFilters {
  cuisines: string[];
  features: string[];
  bookingPolicy: "all" | "instant" | "request";
  priceRange: [number, number];
  sortBy: "rating" | "distance" | "name";
  openNow?: boolean;
  date?: Date;
  time?: string;
  partySize?: number;
}

interface UseRestaurantSearchOptions {
  query: string;
  filters: SearchFilters;
  pageSize?: number;
}

export function useRestaurantSearch({
  query,
  filters,
  pageSize = 20,
}: UseRestaurantSearchOptions) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const currentRequestRef = useRef(0);

  const searchRestaurants = useCallback(
    async (reset = false) => {
      const requestId = ++currentRequestRef.current;

      setLoading(true);

      try {
        let supabaseQuery = supabase
          .from("restaurants")
          .select(
            `
            *,
            restaurant_hours!left(*),
            restaurant_special_hours!left(*),
            restaurant_closures!left(*),
            reviews!left(rating)
          `,
            { count: "exact" },
          )
          .eq("status", "active");

        // Apply search query
        if (query.trim()) {
          supabaseQuery = supabaseQuery.or(
            `name.ilike.%${query}%,cuisine_type.ilike.%${query}%,address.ilike.%${query}%`,
          );
        }

        // Apply filters
        if (filters.cuisines.length > 0) {
          supabaseQuery = supabaseQuery.in("cuisine_type", filters.cuisines);
        }

        if (filters.priceRange) {
          supabaseQuery = supabaseQuery
            .gte("price_range", filters.priceRange[0])
            .lte("price_range", filters.priceRange[1]);
        }

        if (filters.bookingPolicy !== "all") {
          supabaseQuery = supabaseQuery.eq(
            "booking_policy",
            filters.bookingPolicy,
          );
        }

        // Apply sorting
        switch (filters.sortBy) {
          case "rating":
            supabaseQuery = supabaseQuery.order("average_rating", {
              ascending: false,
            });
            break;
          case "name":
            supabaseQuery = supabaseQuery.order("name", { ascending: true });
            break;
          default:
            supabaseQuery = supabaseQuery
              .order("featured", { ascending: false })
              .order("average_rating", { ascending: false });
        }

        // Pagination
        const from = reset ? 0 : page * pageSize;
        const to = from + pageSize - 1;
        supabaseQuery = supabaseQuery.range(from, to);

        const { data, error, count } = await supabaseQuery;

        // Check if this is still the latest request
        if (requestId !== currentRequestRef.current) return;

        if (error) throw error;

        let processedRestaurants = data || [];

        // Post-process for availability filtering and ratings
        if (filters.openNow || (filters.date && filters.time)) {
          const checkDate = filters.date || new Date();
          const checkTime = filters.time || format(new Date(), "HH:mm");

          processedRestaurants = await Promise.all(
            processedRestaurants.map(async (restaurant: any) => {
              const isOpen = await checkRestaurantAvailability(
                restaurant,
                checkDate,
                checkTime,
              );
              return { ...restaurant, isCurrentlyOpen: isOpen };
            }),
          );

          if (filters.openNow) {
            processedRestaurants = processedRestaurants.filter(
              (r: { isCurrentlyOpen: any }) => r.isCurrentlyOpen,
            );
          }
        }

        // Calculate average ratings if reviews data is available
        processedRestaurants = processedRestaurants.map(
          (restaurant: { reviews?: any[]; average_rating?: number }) => ({
            ...restaurant,
            average_rating: restaurant.reviews?.length
              ? restaurant.reviews.reduce(
                  (sum: number, r: any) => sum + r.rating,
                  0,
                ) / restaurant.reviews.length
              : restaurant.average_rating || 0,
          }),
        );

        if (reset) {
          setRestaurants(processedRestaurants);
          setPage(1);
        } else {
          setRestaurants((prev) => [...prev, ...processedRestaurants]);
          setPage((prev) => prev + 1);
        }

        setHasMore(
          (processedRestaurants?.length || 0) === pageSize &&
            (count || 0) > from + pageSize,
        );
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        if (requestId === currentRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [query, filters, page, pageSize],
  );

  const debouncedSearch = useRef(
    debounce((reset: boolean) => searchRestaurants(reset), 300),
  ).current;

  useEffect(() => {
    setPage(0);
    debouncedSearch(true);

    return () => {
      debouncedSearch.cancel();
    };
  }, [query, filters]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      searchRestaurants(false);
    }
  }, [loading, hasMore, searchRestaurants]);

  return {
    restaurants,
    loading,
    hasMore,
    loadMore,
    refresh: () => searchRestaurants(true),
  };
}

// UPDATED: Helper function to check restaurant availability with MULTIPLE SHIFTS support
async function checkRestaurantAvailability(
  restaurant: any,
  date: Date,
  time: string,
): Promise<boolean> {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayOfWeek = format(date, "EEEE").toLowerCase();

  // Check closures
  const closure = restaurant.restaurant_closures?.find(
    (c: any) => dateStr >= c.start_date && dateStr <= c.end_date,
  );
  if (closure) {
    // Full-day closure (no specific times)
    if (!closure.start_time || !closure.end_time) {
      return false;
    }

    // Partial closure - check if requested time conflicts
    if (isTimeWithinRange(time, closure.start_time, closure.end_time)) {
      return false;
    }
    // If time doesn't conflict with partial closure, continue checking regular hours
  }

  // Check special hours
  const special = restaurant.restaurant_special_hours?.find(
    (s: any) => s.date === dateStr,
  );
  if (special) {
    if (special.is_closed) return false;
    if (special.open_time && special.close_time) {
      // Check if within special hours
      const withinSpecialHours = isTimeWithinRange(
        time,
        special.open_time,
        special.close_time,
      );

      // Also check if it conflicts with partial closures
      if (
        withinSpecialHours &&
        closure &&
        closure.start_time &&
        closure.end_time
      ) {
        return !isTimeWithinRange(time, closure.start_time, closure.end_time);
      }

      return withinSpecialHours;
    }
  }

  // UPDATED: Check ALL regular hour shifts for the day
  const regularShifts = restaurant.restaurant_hours?.filter(
    (h: any) => h.day_of_week === dayOfWeek && h.is_open,
  );

  if (!regularShifts || regularShifts.length === 0) return false;

  // Check if time falls within ANY of the shifts
  for (const shift of regularShifts) {
    if (shift.open_time && shift.close_time) {
      if (isTimeWithinRange(time, shift.open_time, shift.close_time)) {
        // Time is within shift hours, but check if it conflicts with partial closures
        if (closure && closure.start_time && closure.end_time) {
          // If there's a partial closure and time conflicts with it, this shift is not available
          if (isTimeWithinRange(time, closure.start_time, closure.end_time)) {
            continue; // Try next shift
          }
        }
        return true; // Time is within this shift and doesn't conflict with partial closures
      }
    }
  }

  return false; // Time doesn't fall within any shift
}

function isTimeWithinRange(
  time: string,
  openTime: string,
  closeTime: string,
): boolean {
  const [hour, minute] = time.split(":").map(Number);
  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  const currentMinutes = hour * 60 + minute;
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}
