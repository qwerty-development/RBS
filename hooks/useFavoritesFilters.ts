import { useState, useCallback, useMemo } from "react";
import { Clock, SortAsc, Star, Filter, TrendingUp } from "lucide-react-native";
import type { Favorite } from "./useFavorites";

export type SortBy =
  | "recently_added"
  | "name"
  | "rating"
  | "most_visited"
  | "cuisine";
export type GroupBy = "none" | "cuisine" | "price_range" | "location";

// Helper type for grouping items in pairs for grid layout
export type FavoritePair = [Favorite] | [Favorite, Favorite];

export const SORT_OPTIONS: { value: SortBy; label: string; icon: any }[] = [
  { value: "recently_added", label: "Recently Added", icon: Clock },
  { value: "name", label: "Name (A-Z)", icon: SortAsc },
  { value: "rating", label: "Highest Rated", icon: Star },
  { value: "most_visited", label: "Most Visited", icon: TrendingUp },
  { value: "cuisine", label: "Cuisine Type", icon: Filter },
];

export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No Grouping" },
  { value: "cuisine", label: "By Cuisine" },
  { value: "price_range", label: "By Price" },
  { value: "location", label: "By Area" },
];

export const useFavoritesFilters = (favorites: Favorite[]) => {
  const [sortBy, setSortBy] = useState<SortBy>("recently_added");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showOptions, setShowOptions] = useState(false);
  const [insightsBannerDismissed, setInsightsBannerDismissed] = useState(false);

  // Helper function to group items in pairs for grid layout
  const groupItemsInPairs = useCallback((items: Favorite[]): FavoritePair[] => {
    const pairs: FavoritePair[] = [];
    for (let i = 0; i < items.length; i += 2) {
      if (i + 1 < items.length) {
        pairs.push([items[i], items[i + 1]]);
      } else {
        pairs.push([items[i]]);
      }
    }
    return pairs;
  }, []);

  // Process favorites with sorting and grouping
  const processedFavorites = useMemo(() => {
    // Apply sorting
    let sorted = [...favorites];

    switch (sortBy) {
      case "name":
        sorted.sort((a, b) =>
          a.restaurant.name.localeCompare(b.restaurant.name)
        );
        break;
      case "rating":
        sorted.sort(
          (a, b) =>
            (b.restaurant.average_rating || 0) -
            (a.restaurant.average_rating || 0)
        );
        break;
      case "most_visited":
        sorted.sort(
          (a, b) => (b.total_bookings || 0) - (a.total_bookings || 0)
        );
        break;
      case "cuisine":
        sorted.sort((a, b) =>
          a.restaurant.cuisine_type.localeCompare(b.restaurant.cuisine_type)
        );
        break;
      case "recently_added":
      default:
        // Already sorted by created_at desc from query
        break;
    }

    // Apply grouping
    if (groupBy === "none") {
      return [{ title: "", data: groupItemsInPairs(sorted) }];
    }

    const grouped = sorted.reduce(
      (acc, favorite) => {
        let key: string;

        switch (groupBy) {
          case "cuisine":
            key = favorite.restaurant.cuisine_type;
            break;
          case "price_range":
            key = `${"$".repeat(favorite.restaurant.price_range)} (${
              ["Budget", "Moderate", "Upscale", "Fine Dining"][
                favorite.restaurant.price_range - 1
              ]
            })`;
            break;
          case "location":
            // Extract area from address (simplified)
            key =
              favorite.restaurant.address.split(",")[1]?.trim() ||
              "Unknown Area";
            break;
          default:
            key = "Other";
        }

        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(favorite);
        return acc;
      },
      {} as Record<string, Favorite[]>
    );

    // Convert to section list format with paired items
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data: groupItemsInPairs(data) }));
  }, [favorites, sortBy, groupBy, groupItemsInPairs]);

  const resetFilters = useCallback(() => {
    setSortBy("recently_added");
    setGroupBy("none");
  }, []);

  const resetBannerOnRefresh = useCallback(() => {
    setInsightsBannerDismissed(false);
  }, []);

  const hasActiveFilters = sortBy !== "recently_added" || groupBy !== "none";

  return {
    sortBy,
    setSortBy,
    groupBy,
    setGroupBy,
    showOptions,
    setShowOptions,
    insightsBannerDismissed,
    setInsightsBannerDismissed,
    processedFavorites,
    resetFilters,
    resetBannerOnRefresh,
    hasActiveFilters,
  };
};
