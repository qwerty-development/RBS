import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/config/supabase";
import { CUISINE_IMAGE_MAP } from "@/constants/homeScreenData";

const CACHE_KEY = "cuisine_categories_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export interface CuisineCategory {
  id: string; // cuisine_type in lowercase
  label: string; // cuisine_type as-is
  image: any; // mapped from CUISINE_IMAGE_MAP
  restaurantCount: number; // restaurant_count from RPC
}

interface CachedData {
  categories: CuisineCategory[];
  timestamp: number;
}

/**
 * Hook to fetch and cache cuisine categories from database
 * - Fetches from Supabase RPC get_restaurant_categories
 * - Returns: { cuisine_type: string, restaurant_count: bigint }
 * - Caches results in AsyncStorage for 24 hours
 * - Maps cuisine types to local images
 */
export function useCuisineCategories() {
  const [categories, setCategories] = useState<CuisineCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🍽️ useCuisineCategories hook mounted");
    fetchCategories();
  }, []);

  const fetchCategories = async (): Promise<void> => {
    try {
      console.log("🍽️ Fetching cuisine categories...");

      // Try to get from cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);

      if (cached) {
        const { categories: cachedCategories, timestamp }: CachedData =
          JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;

        if (!isExpired) {
          console.log("✅ Using cached categories:", cachedCategories.length);
          setCategories(cachedCategories);
          setLoading(false);
          return;
        }
        console.log("⏰ Cache expired, fetching fresh data");
      }

      // Fetch from database - returns { cuisine_type, restaurant_count }[]
      console.log("📡 Calling RPC: get_restaurant_categories");
      const { data, error: rpcError } = await supabase.rpc(
        "get_restaurant_categories",
      );

      if (rpcError) {
        console.error("❌ RPC error:", rpcError);
        throw rpcError;
      }

      console.log(
        "📊 RPC returned:",
        data?.length,
        "items",
        JSON.stringify(data),
      );

      // Map database results to category objects with images
      const mappedCategories: CuisineCategory[] = (data || [])
        .map((item: { cuisine_type: string; restaurant_count: number }) => {
          // Convert to lowercase for image lookup
          const cuisineId = item.cuisine_type.toLowerCase();

          // Only include if we have an image for it
          if (!CUISINE_IMAGE_MAP[cuisineId]) {
            console.log("⚠️  No image for cuisine:", cuisineId);
            return null;
          }

          return {
            id: cuisineId, // "italian", "japanese", etc.
            label: item.cuisine_type, // "Italian", "Japanese", etc.
            image: CUISINE_IMAGE_MAP[cuisineId], // require() from image map
            restaurantCount: Number(item.restaurant_count), // bigint to number
          };
        })
        .filter(Boolean) as CuisineCategory[];

      console.log(
        "✨ Mapped categories:",
        mappedCategories.length,
        "with images",
      );

      // Cache the results
      const cacheData: CachedData = {
        categories: mappedCategories,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

      setCategories(mappedCategories);
      setError(null);
      console.log("💾 Categories cached successfully");
    } catch (err) {
      console.error("❌ Error fetching cuisine categories:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch categories",
      );

      // Fallback to empty array on error
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshCategories = async (): Promise<void> => {
    setLoading(true);
    await AsyncStorage.removeItem(CACHE_KEY);
    await fetchCategories();
  };

  return {
    categories,
    loading,
    error,
    refreshCategories,
  };
}
