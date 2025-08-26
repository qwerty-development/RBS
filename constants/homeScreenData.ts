import { Zap, Star, Award, MapPin, TrendingUp } from "lucide-react-native";

interface QuickFilter {
  id: string;
  label: string;
  icon: any;
  color: string;
  params: Record<string, string>;
}

interface CuisineCategory {
  id: string;
  label: string;
  image: string;
  popular?: boolean;
}

export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: "instant_book",
    label: "Instant Book",
    icon: Zap,
    color: "#10b981",
    params: { bookingPolicy: "instant" },
  },
  {
    id: "top_rated",
    label: "Top Rated",
    icon: Star,
    color: "#f59e0b",
    params: { minRating: "4.5" },
  },
  {
    id: "fine_dining",
    label: "Fine Dining",
    icon: Award,
    color: "#8b5cf6",
    params: { priceRange: "4" },
  },
  {
    id: "outdoor",
    label: "Outdoor",
    icon: MapPin,
    color: "#06b6d4",
    params: { feature: "outdoor_seating" },
  },
  {
    id: "trending",
    label: "Trending",
    icon: TrendingUp,
    color: "#ef4444",
    params: { trending: "true" },
  },
];

export const CUISINE_CATEGORIES: CuisineCategory[] = [
  { id: "lebanese", label: "Lebanese", image: require("@/assets/cuisine-categories/lebanese.png"), popular: true },
  { id: "italian", label: "Italian", image: require("@/assets/cuisine-categories/italian.png"), popular: true },
  { id: "japanese", label: "Japanese", image: require("@/assets/cuisine-categories/japanese.png"), popular: true },
  { id: "french", label: "French", image: require("@/assets/cuisine-categories/french.png") },
  { id: "chinese", label: "Chinese", image: require("@/assets/cuisine-categories/chinese.png") },
  { id: "indian", label: "Indian", image: require("@/assets/cuisine-categories/indian.png") },
  { id: "mexican", label: "Mexican", image: require("@/assets/cuisine-categories/mexican.png") },
  { id: "seafood", label: "Seafood", image: require("@/assets/cuisine-categories/seafood.png") },
];
