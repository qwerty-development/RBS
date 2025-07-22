// hooks/useRestaurantSearch.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import debounce from "lodash.debounce";
import * as Location from "expo-location";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface SearchFilters {
  cuisines: string[];
  features: string[];
  bookingPolicy: "all" | "instant" | "request";
  priceRange: [number, number];
  sortBy: "recommended" | "rating" | "distance" | "name";
}

interface UseRestaurantSearchOptions {
  query: string;
  filters: SearchFilters;
  userLocation?: Location.LocationObject | null;
  pageSize?: number;
}

export function useRestaurantSearch({
  query,
  filters,
  userLocation,
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
        let rpcParams: any = {
          p_query: query,
          p_cuisines: filters.cuisines,
          p_features: filters.features,
          p_min_price: filters.priceRange[0],
          p_max_price: filters.priceRange[1],
          p_booking_policy: filters.bookingPolicy === "all" ? null : filters.bookingPolicy,
          p_sort_by: filters.sortBy,
          p_limit: pageSize,
          p_offset: reset ? 0 : page * pageSize,
        };

        if (userLocation) {
          rpcParams.p_lat = userLocation.coords.latitude;
          rpcParams.p_lon = userLocation.coords.longitude;
        }

        const { data, error } = await supabase.rpc(
          "search_restaurants",
          rpcParams
        );

        // Check if this is still the latest request
        if (requestId !== currentRequestRef.current) return;

        if (error) throw error;

        if (reset) {
          setRestaurants(data || []);
          setPage(1);
        } else {
          setRestaurants((prev) => [...prev, ...(data || [])]);
          setPage((prev) => prev + 1);
        }

        setHasMore((data?.length || 0) === pageSize);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        if (requestId === currentRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [query, filters, page, pageSize, userLocation],
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
  }, [query, filters, userLocation]);

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
