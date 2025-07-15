// hooks/useMenu.ts - Updated with offline support
import { useState, useEffect, useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useNetwork } from "@/context/network-provider";
import { MenuCategory, MenuItem, MenuFilters } from "@/types/menu";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  isFromCache: boolean;
  setFilters: (filters: Partial<MenuFilters>) => void;
  refresh: () => Promise<void>;
  featuredItems: MenuItem[];
}

const MENU_CACHE_KEY = (restaurantId: string) => `@menu_${restaurantId}`;
const MENU_SYNC_KEY = (restaurantId: string) => `@menu_sync_${restaurantId}`;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function useMenu({ restaurantId }: UseMenuParams): UseMenuReturn {
  const { isOnline, isOffline } = useNetwork();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [filters, setFiltersState] = useState<MenuFilters>({
    dietary_tags: [],
    maxPrice: null,
    searchQuery: "",
    showUnavailable: false,
  });

  // Cache management functions
  const getCachedMenu = useCallback(async (): Promise<MenuCategory[] | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(MENU_CACHE_KEY(restaurantId));
      const syncTime = await AsyncStorage.getItem(MENU_SYNC_KEY(restaurantId));
      
      if (cachedData && syncTime) {
        const parsedData = JSON.parse(cachedData);
        const lastSync = parseInt(syncTime);
        const isStale = Date.now() - lastSync > CACHE_DURATION;
        
        if (!isStale || isOffline) {
          console.log("📱 Using cached menu data");
          return parsedData;
        }
      }
      return null;
    } catch (error) {
      console.error("Error reading cached menu:", error);
      return null;
    }
  }, [restaurantId, isOffline]);

  const cacheMenu = useCallback(async (menuData: MenuCategory[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(MENU_CACHE_KEY(restaurantId), JSON.stringify(menuData));
      await AsyncStorage.setItem(MENU_SYNC_KEY(restaurantId), Date.now().toString());
      console.log("💾 Menu cached for offline use");
    } catch (error) {
      console.error("Error caching menu:", error);
    }
  }, [restaurantId]);

  const fetchMenu = useCallback(async (forceOnline = false) => {
    try {
      setError(null);

      // If offline and not forcing online, try to load from cache
      if (isOffline && !forceOnline) {
        console.log("📱 Loading menu from cache (offline)");
        const cachedMenu = await getCachedMenu();
        
        if (cachedMenu) {
          setCategories(cachedMenu);
          setIsFromCache(true);
          return;
        } else {
          throw new Error("No cached menu available");
        }
      }

      // Check if we can use cache first
      if (!forceOnline) {
        const cachedMenu = await getCachedMenu();
        if (cachedMenu) {
          setCategories(cachedMenu);
          setIsFromCache(true);
          setLoading(false);
          return;
        }
      }

      // Online fetch
      console.log("🌐 Fetching menu from server");

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
      setIsFromCache(false);

      // Cache for offline use
      await cacheMenu(categoriesWithItems);

    } catch (err) {
      console.error("Error fetching menu:", err);
      
      // If error and offline, try cache as fallback
      if (isOffline) {
        const cachedMenu = await getCachedMenu();
        if (cachedMenu) {
          setCategories(cachedMenu);
          setIsFromCache(true);
          setError(null); // Clear error if we have cache
          console.log("📱 Using cached menu after error");
          return;
        }
      }
      
      setError(
        isOffline 
          ? "Unable to load menu. Please check your internet connection."
          : err instanceof Error ? err.message : "Failed to load menu"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, filters.showUnavailable, isOffline, getCachedMenu, cacheMenu]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMenu(!isOffline); // Force online if possible
  }, [fetchMenu, isOffline]);

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

  // Initial load
  useEffect(() => {
    if (restaurantId) {
      fetchMenu();
    }
  }, [restaurantId]);

  // Refresh when coming back online if using cached data
  useEffect(() => {
    if (isOnline && isFromCache) {
      console.log("🔄 Back online, refreshing menu");
      fetchMenu(true); // Force online refresh
    }
  }, [isOnline, isFromCache]);

  // Clear cache when restaurant changes
  useEffect(() => {
    return () => {
      // Cleanup cache on unmount
      setCategories([]);
      setIsFromCache(false);
      setError(null);
    };
  }, [restaurantId]);

  return {
    categories,
    loading,
    error,
    refreshing,
    filters,
    filteredItems,
    isFromCache,
    setFilters,
    refresh,
    featuredItems,
  };
}