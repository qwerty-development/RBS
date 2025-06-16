// hooks/useRestaurantSearch.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import debounce from "lodash.debounce";

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

  const searchRestaurants = useCallback(async (reset = false) => {
    const requestId = ++currentRequestRef.current;
    
    setLoading(true);
    
    try {
      let supabaseQuery = supabase.from("restaurants").select("*", { count: "exact" });

      // Apply search query
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(
          `name.ilike.%${query}%,cuisine_type.ilike.%${query}%,address.ilike.%${query}%`
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
        supabaseQuery = supabaseQuery.eq("booking_policy", filters.bookingPolicy);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case "rating":
          supabaseQuery = supabaseQuery.order("average_rating", { ascending: false });
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

      if (reset) {
        setRestaurants(data || []);
        setPage(1);
      } else {
        setRestaurants((prev) => [...prev, ...(data || [])]);
        setPage((prev) => prev + 1);
      }

      setHasMore((data?.length || 0) === pageSize && (count || 0) > from + pageSize);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (requestId === currentRequestRef.current) {
        setLoading(false);
      }
    }
  }, [query, filters, page, pageSize]);

  const debouncedSearch = useRef(
    debounce((reset: boolean) => searchRestaurants(reset), 300)
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