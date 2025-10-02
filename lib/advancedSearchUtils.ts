import Fuse, { type IFuseOptions } from "fuse.js";
import type { Restaurant, UserLocation } from "@/types/search";

// Common cuisine types with variations and misspellings - based on your actual cuisine categories
const CUISINE_MAPPING: Record<string, string[]> = {
  American: [
    "american",
    "burger",
    "burgers",
    "steakhouse",
    "steak",
    "bbq",
    "barbecue",
    "usa",
    "us",
  ],
  Cafe: [
    "cafe",
    "coffee",
    "bistro",
    "breakfast",
    "brunch",
    "bakery",
    "pastry",
    "dessert",
  ],
  Chinese: [
    "chinese",
    "chineese",
    "chineze",
    "asian",
    "noodles",
    "dim sum",
    "wok",
    "canton",
    "cantonese",
  ],
  French: [
    "french",
    "france",
    "bistro",
    "brasserie",
    "croissant",
    "crepe",
    "patisserie",
  ],
  Greek: [
    "greek",
    "greece",
    "gyro",
    "souvlaki",
    "feta",
    "olive",
    "mediterranean",
    "moussaka",
  ],
  Indian: [
    "indian",
    "india",
    "curry",
    "tandoor",
    "biryani",
    "naan",
    "masala",
    "spicy",
  ],
  International: [
    "international",
    "fusion",
    "global",
    "world",
    "mixed",
    "varied",
    "diverse",
  ],
  Italian: [
    "italian",
    "italain",
    "itallian",
    "italy",
    "pasta",
    "pizza",
    "risotto",
    "gelato",
  ],
  Japanese: [
    "japanese",
    "japan",
    "sushi",
    "ramen",
    "tempura",
    "teriyaki",
    "sake",
    "asian",
  ],
  Lebanese: [
    "lebanese",
    "lebanse",
    "lebanees",
    "lebanise",
    "lebanon",
    "arab",
    "middle eastern",
    "levantine",
    "hummus",
    "shawarma",
    "kebab",
  ],
  Mediterranean: [
    "mediterranean",
    "med",
    "olive",
    "greek",
    "healthy",
    "fresh",
    "herbs",
  ],
  Mexican: [
    "mexican",
    "mexico",
    "tex-mex",
    "texmex",
    "tacos",
    "burritos",
    "quesadilla",
    "salsa",
  ],
  Seafood: [
    "seafood",
    "fish",
    "shrimp",
    "crab",
    "lobster",
    "oyster",
    "salmon",
    "tuna",
    "ocean",
  ],
  Spanish: [
    "spanish",
    "spain",
    "tapas",
    "paella",
    "iberian",
    "flamenco",
    "sangria",
  ],
  Thai: [
    "thai",
    "thailand",
    "pad thai",
    "curry",
    "spicy",
    "coconut",
    "asian",
    "tom yum",
  ],
};

// Normalize cuisine names for better matching
const NORMALIZED_CUISINES = Object.keys(CUISINE_MAPPING).reduce(
  (acc, key) => {
    CUISINE_MAPPING[key].forEach((variation) => {
      acc[variation.toLowerCase()] = key;
    });
    return acc;
  },
  {} as Record<string, string>,
);

// Advanced search configuration for restaurants
const RESTAURANT_SEARCH_CONFIG: IFuseOptions<Restaurant> = {
  keys: [
    { name: "name", weight: 0.4 },
    { name: "cuisine_type", weight: 0.25 },
    { name: "tags", weight: 0.2 },
    { name: "description", weight: 0.1 },
    { name: "address", weight: 0.05 },
  ],
  threshold: 0.4, // More forgiving threshold for typos
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: false,
  findAllMatches: true,
  useExtendedSearch: true,
};

// Cuisine search configuration for better matching
const CUISINE_SEARCH_CONFIG: IFuseOptions<{
  name: string;
  variations: string[];
}> = {
  keys: [
    { name: "name", weight: 0.6 },
    { name: "variations", weight: 0.4 },
  ],
  threshold: 0.3,
  distance: 50,
  minMatchCharLength: 3,
  includeScore: true,
  ignoreLocation: false,
  findAllMatches: true,
};

export interface SearchSuggestion {
  type: "restaurant" | "cuisine" | "tag" | "location";
  value: string;
  label: string;
  score?: number;
  matches?: any[];
}

export interface AdvancedSearchResult {
  restaurants: Restaurant[];
  suggestions: SearchSuggestion[];
  totalResults: number;
  searchTime: number;
  hasMore: boolean;
}

export class AdvancedSearchEngine {
  private restaurantIndex: Fuse<Restaurant> | null = null;
  private cuisineIndex: Fuse<{ name: string; variations: string[] }>;
  private lastIndexUpdate = 0;
  private readonly INDEX_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize cuisine index
    const cuisineData = Object.entries(CUISINE_MAPPING).map(
      ([name, variations]) => ({
        name,
        variations,
      }),
    );
    this.cuisineIndex = new Fuse(cuisineData, CUISINE_SEARCH_CONFIG);
  }

  /**
   * Initialize or update the restaurant search index
   */
  updateRestaurantIndex(restaurants: Restaurant[]): void {
    this.restaurantIndex = new Fuse(restaurants, RESTAURANT_SEARCH_CONFIG);
    this.lastIndexUpdate = Date.now();
  }

  /**
   * Check if the index needs refreshing
   */
  private shouldRefreshIndex(): boolean {
    return Date.now() - this.lastIndexUpdate > this.INDEX_REFRESH_INTERVAL;
  }

  /**
   * Normalize and expand search query for better matching
   */
  private preprocessQuery(query: string): string[] {
    const normalizedQuery = query.toLowerCase().trim();
    const queries = [normalizedQuery];

    // Check for cuisine matches and add normalized cuisine names
    Object.entries(NORMALIZED_CUISINES).forEach(([variation, cuisine]) => {
      if (normalizedQuery.includes(variation)) {
        queries.push(cuisine.toLowerCase());
        queries.push(variation);
      }
    });

    // Add partial matches for common food terms
    const foodTerms = [
      "restaurant",
      "food",
      "eat",
      "dining",
      "meal",
      "lunch",
      "dinner",
      "breakfast",
      "brunch",
    ];

    foodTerms.forEach((term) => {
      if (normalizedQuery.includes(term)) {
        queries.push(term);
      }
    });

    return [...new Set(queries)]; // Remove duplicates
  }

  /**
   * Generate search suggestions based on partial input
   */
  generateSuggestions(
    query: string,
    restaurants: Restaurant[],
  ): SearchSuggestion[] {
    if (query.length < 2) return [];

    const suggestions: SearchSuggestion[] = [];

    // Restaurant name suggestions
    if (this.restaurantIndex) {
      const restaurantResults = this.restaurantIndex.search(query);
      restaurantResults.slice(0, 3).forEach((result) => {
        if (result.score && result.score < 0.6) {
          suggestions.push({
            type: "restaurant",
            value: result.item.name,
            label: `${result.item.name} • ${result.item.cuisine_type}`,
            score: result.score,
          });
        }
      });
    }

    // Cuisine suggestions
    const cuisineResults = this.cuisineIndex.search(query);
    cuisineResults.slice(0, 3).forEach((result) => {
      if (result.score && result.score < 0.5) {
        suggestions.push({
          type: "cuisine",
          value: result.item.name,
          label: `${result.item.name} cuisine`,
          score: result.score,
        });
      }
    });

    // Tag-based suggestions from available restaurants
    const uniqueTags = [...new Set(restaurants.flatMap((r) => r.tags || []))];
    const tagMatches = uniqueTags
      .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map((tag) => ({
        type: "tag" as const,
        value: tag,
        label: `Places with ${tag}`,
        score: 0,
      }));

    suggestions.push(...tagMatches);

    // Sort by relevance score and remove duplicates
    return suggestions
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .slice(0, 8);
  }

  /**
   * Perform advanced fuzzy search on restaurants
   */
  search(
    query: string,
    restaurants: Restaurant[],
    userLocation?: UserLocation | null,
    limit: number = 50,
  ): AdvancedSearchResult {
    const startTime = Date.now();

    // Return all restaurants if no query
    if (!query.trim()) {
      return {
        restaurants: restaurants.slice(0, limit),
        suggestions: [],
        totalResults: restaurants.length,
        searchTime: Date.now() - startTime,
        hasMore: restaurants.length > limit,
      };
    }

    // Update index if needed
    if (!this.restaurantIndex || this.shouldRefreshIndex()) {
      this.updateRestaurantIndex(restaurants);
    }

    if (!this.restaurantIndex) {
      return {
        restaurants: [],
        suggestions: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        hasMore: false,
      };
    }

    // Preprocess query for better matching
    const expandedQueries = this.preprocessQuery(query);

    // Perform fuzzy search with multiple query variations
    const allResults: { item: Restaurant; score: number; matches: any[] }[] =
      [];

    expandedQueries.forEach((searchQuery) => {
      const results = this.restaurantIndex!.search(searchQuery);
      results.forEach((result) => {
        if (result.score !== undefined) {
          allResults.push({
            item: result.item,
            score: result.score,
            matches: result.matches ? [...result.matches] : [],
          });
        }
      });
    });

    // Remove duplicates and enhance scoring
    const uniqueResults = new Map<
      string,
      { item: Restaurant; score: number; matches: any[] }
    >();

    allResults.forEach((result) => {
      const existing = uniqueResults.get(result.item.id);
      if (!existing || result.score < existing.score) {
        uniqueResults.set(result.item.id, result);
      }
    });

    // Apply advanced scoring algorithm
    let scoredResults = Array.from(uniqueResults.values()).map((result) => {
      const enhancedScore = this.calculateEnhancedScore(
        result.item,
        result.score,
        query,
        userLocation,
      );

      return {
        ...result.item,
        searchScore: enhancedScore,
        originalScore: result.score,
        matches: result.matches,
      };
    });

    // Sort by enhanced score (lower is better for fuzzy search scores)
    scoredResults.sort((a, b) => (a.searchScore || 1) - (b.searchScore || 1));

    // Generate suggestions
    const suggestions = this.generateSuggestions(query, restaurants);

    const searchTime = Date.now() - startTime;

    return {
      restaurants: scoredResults.slice(0, limit),
      suggestions,
      totalResults: scoredResults.length,
      searchTime,
      hasMore: scoredResults.length > limit,
    };
  }

  /**
   * Calculate enhanced relevance score combining fuzzy score with other factors
   */
  private calculateEnhancedScore(
    restaurant: Restaurant,
    fuseScore: number,
    query: string,
    userLocation?: UserLocation | null,
  ): number {
    let enhancedScore = fuseScore;

    // Boost exact name matches
    if (restaurant.name.toLowerCase().includes(query.toLowerCase())) {
      enhancedScore *= 0.7; // Lower score = better match
    }

    // Boost exact cuisine matches
    if (restaurant.cuisine_type.toLowerCase().includes(query.toLowerCase())) {
      enhancedScore *= 0.8;
    }

    // Boost highly rated restaurants
    const ratingBoost = (restaurant.average_rating || 0) / 5;
    enhancedScore *= 1 - ratingBoost * 0.1;

    // Boost restaurants with more reviews
    const reviewBoost = Math.min((restaurant.total_reviews || 0) / 100, 1);
    enhancedScore *= 1 - reviewBoost * 0.05;

    // Distance boost if location is available
    if (
      userLocation &&
      restaurant.distance !== null &&
      restaurant.distance !== undefined
    ) {
      const distanceBoost = Math.max(0, 1 - restaurant.distance / 20); // Within 20km
      enhancedScore *= 1 - distanceBoost * 0.1;
    }

    // Boost featured restaurants slightly
    if (restaurant.featured || restaurant.ai_featured) {
      enhancedScore *= 0.95;
    }

    return enhancedScore;
  }

  /**
   * Get cuisine suggestions for autocomplete
   */
  getCuisineSuggestions(query: string): string[] {
    if (query.length < 2) return [];

    const results = this.cuisineIndex.search(query);
    return results
      .filter((result) => result.score && result.score < 0.4)
      .map((result) => result.item.name)
      .slice(0, 5);
  }

  /**
   * Normalize cuisine input to standard cuisine types
   */
  normalizeCuisineInput(input: string): string[] {
    const normalized = input.toLowerCase().trim();
    const matches: string[] = [];

    Object.entries(NORMALIZED_CUISINES).forEach(([variation, cuisine]) => {
      if (normalized.includes(variation)) {
        matches.push(cuisine);
      }
    });

    return [...new Set(matches)];
  }
}

// Singleton instance for better performance
export const advancedSearchEngine = new AdvancedSearchEngine();

// Utility functions for enhanced search features
export const searchUtils = {
  highlightMatches: (text: string, query: string): string => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.split("").join(".*?")})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  },

  calculateRelevanceScore: (restaurant: Restaurant, query: string): number => {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerName = restaurant.name.toLowerCase();
    const lowerCuisine = restaurant.cuisine_type.toLowerCase();

    // Exact matches get highest score
    if (lowerName === lowerQuery) score += 100;
    else if (lowerName.startsWith(lowerQuery)) score += 80;
    else if (lowerName.includes(lowerQuery)) score += 60;

    // Cuisine matches
    if (lowerCuisine === lowerQuery) score += 70;
    else if (lowerCuisine.includes(lowerQuery)) score += 40;

    // Tag matches
    const tags = restaurant.tags || [];
    tags.forEach((tag) => {
      if (tag.toLowerCase().includes(lowerQuery)) score += 30;
    });

    // Rating bonus
    score += (restaurant.average_rating || 0) * 5;

    return score;
  },

  filterBySearchCriteria: (
    restaurants: Restaurant[],
    criteria: {
      minRating?: number;
      maxDistance?: number;
      priceRange?: number[];
      features?: string[];
    },
  ): Restaurant[] => {
    return restaurants.filter((restaurant) => {
      if (
        criteria.minRating &&
        (restaurant.average_rating || 0) < criteria.minRating
      ) {
        return false;
      }

      if (
        criteria.maxDistance &&
        restaurant.distance &&
        restaurant.distance > criteria.maxDistance
      ) {
        return false;
      }

      if (criteria.priceRange && criteria.priceRange.length > 0) {
        if (!criteria.priceRange.includes(restaurant.price_range || 0)) {
          return false;
        }
      }

      if (criteria.features && criteria.features.length > 0) {
        const hasAllFeatures = criteria.features.every((feature) => {
          switch (feature) {
            case "parking":
              return restaurant.parking_available;
            case "valet":
              return restaurant.valet_parking;
            case "outdoor":
              return restaurant.outdoor_seating;
            case "shisha":
              return restaurant.shisha_available;
            default:
              return true;
          }
        });
        if (!hasAllFeatures) return false;
      }

      return true;
    });
  },
};
