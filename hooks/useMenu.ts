// hooks/useMenu.ts

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/config/supabase";
import { MenuCategory, MenuItem, MenuFilters } from "@/types/menu";

interface UseMenuParams {
  restaurantId: string;
}

interface UseMenuReturn {
  categories: MenuCategory[];
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  filters: MenuFilters;
  filteredItems: MenuItem[];
  setFilters: (filters: Partial<MenuFilters>) => void;
  refresh: () => Promise<void>;
  featuredItems: MenuItem[];
}

export function useMenu({ restaurantId }: UseMenuParams): UseMenuReturn {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFiltersState] = useState<MenuFilters>({
    dietary_tags: [],
    maxPrice: null,
    searchQuery: "",
    showUnavailable: false,
  });

  const fetchMenu = useCallback(async () => {
    try {
      setError(null);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("menu_categories")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (categoriesError) throw categoriesError;

      // Fetch menu items
      const { data: itemsData, error: itemsError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: true });

      if (itemsError) throw itemsError;

      // Group items by category
      const categoriesWithItems = (categoriesData || []).map((category) => ({
        ...category,
        items: (itemsData || []).filter(
          (item) =>
            item.category_id === category.id &&
            (filters.showUnavailable || item.is_available),
        ),
      }));

      setCategories(categoriesWithItems);
    } catch (err) {
      console.error("Error fetching menu:", err);
      setError(err instanceof Error ? err.message : "Failed to load menu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, filters.showUnavailable]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMenu();
  }, [fetchMenu]);

  const setFilters = useCallback((newFilters: Partial<MenuFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Calculate filtered items
  const filteredItems = useMemo(() => {
    const allItems = categories.flatMap((cat) => cat.items || []);

    return allItems.filter((item) => {
      // Search filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (
          !item.name.toLowerCase().includes(query) &&
          !item.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Price filter
      if (filters.maxPrice && item.price > filters.maxPrice) {
        return false;
      }

      // Dietary tags filter
      if (filters.dietary_tags.length > 0) {
        const hasAllTags = filters.dietary_tags.every((tag) =>
          item.dietary_tags.includes(tag),
        );
        if (!hasAllTags) return false;
      }

      // Availability filter
      if (!filters.showUnavailable && !item.is_available) {
        return false;
      }

      return true;
    });
  }, [categories, filters]);

  // Get featured items
  const featuredItems = useMemo(() => {
    return categories
      .flatMap((cat) => cat.items || [])
      .filter((item) => item.is_featured && item.is_available)
      .slice(0, 6);
  }, [categories]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  return {
    categories,
    loading,
    error,
    refreshing,
    filters,
    filteredItems,
    setFilters,
    refresh,
    featuredItems,
  };
}