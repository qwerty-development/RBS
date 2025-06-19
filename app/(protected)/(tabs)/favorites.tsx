// app/(protected)/(tabs)/favorites.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  Animated,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Heart,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Filter,
  SortAsc,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Type Definitions and Constants
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Favorite = {
  id: string;
  restaurant_id: string;
  created_at: string;
  restaurant: Restaurant;
  last_booking?: string;
  total_bookings?: number;
};

type SortBy = "recently_added" | "name" | "rating" | "most_visited" | "cuisine";
type GroupBy = "none" | "cuisine" | "price_range" | "location";

// Helper type for grouping items in pairs for grid layout
type FavoritePair = [Favorite] | [Favorite, Favorite];

// 2. Component Configuration
const SORT_OPTIONS: { value: SortBy; label: string; icon: any }[] = [
  { value: "recently_added", label: "Recently Added", icon: Clock },
  { value: "name", label: "Name (A-Z)", icon: SortAsc },
  { value: "rating", label: "Highest Rated", icon: Star },
  { value: "most_visited", label: "Most Visited", icon: TrendingUp },
  { value: "cuisine", label: "Cuisine Type", icon: Filter },
];

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No Grouping" },
  { value: "cuisine", label: "By Cuisine" },
  { value: "price_range", label: "By Price" },
  { value: "location", label: "By Area" },
];

export default function FavoritesScreen() {
  // 3. State Management Architecture
  // 3.1 Core States
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  // 3.2 Data States
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // 3.3 View Configuration States (removed viewMode since we only use grid now)
  const [sortBy, setSortBy] = useState<SortBy>("recently_added");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showOptions, setShowOptions] = useState(false);
  const [insightsBannerDismissed, setInsightsBannerDismissed] = useState(false);

  // 3.4 Animation References
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 4. Data Fetching Implementation
  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // 4.1 Fetch favorites with restaurant details
      const { data: favoritesData, error: favoritesError } = await supabase
        .from("favorites")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (favoritesError) throw favoritesError;

      // 4.2 Fetch booking statistics for each favorite
      const enrichedFavorites = await Promise.all(
        (favoritesData || []).map(async (favorite) => {
          // 4.2.1 Get last booking date
          const { data: lastBooking } = await supabase
            .from("bookings")
            .select("booking_time")
            .eq("user_id", profile.id)
            .eq("restaurant_id", favorite.restaurant_id)
            .eq("status", "completed")
            .order("booking_time", { ascending: false })
            .limit(1)
            .single();

          // 4.2.2 Get total bookings count
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profile.id)
            .eq("restaurant_id", favorite.restaurant_id)
            .eq("status", "completed");

          return {
            ...favorite,
            last_booking: lastBooking?.booking_time,
            total_bookings: count || 0,
          };
        })
      );

      setFavorites(enrichedFavorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      Alert.alert("Error", "Failed to load favorites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // 5. Favorite Management Functions
  const removeFavorite = useCallback(
    async (favoriteId: string, restaurantName: string) => {
      // 5.1 Confirmation Dialog
      Alert.alert(
        "Remove from Favorites",
        `Are you sure you want to remove ${restaurantName} from your favorites?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setRemovingId(favoriteId);

              // 5.2 Animate removal
              Animated.parallel([
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                  toValue: 0.8,
                  useNativeDriver: true,
                }),
              ]).start();

              try {
                // 5.3 Delete from database
                const { error } = await supabase
                  .from("favorites")
                  .delete()
                  .eq("id", favoriteId);

                if (error) throw error;

                // 5.4 Haptic feedback
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                // 5.5 Update local state
                setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));

                // 5.6 Reset animations
                fadeAnim.setValue(1);
                scaleAnim.setValue(1);
              } catch (error) {
                console.error("Error removing favorite:", error);
                Alert.alert("Error", "Failed to remove from favorites");

                // 5.7 Reset animations on error
                Animated.parallel([
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                  }),
                ]).start();
              } finally {
                setRemovingId(null);
              }
            },
          },
        ]
      );
    },
    [fadeAnim, scaleAnim]
  );

  // 6. Helper function to group items in pairs for grid layout
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

  // 7. Sorting and Grouping Logic
  const processedFavorites = useMemo(() => {
    // 7.1 Apply sorting
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

    // 7.2 Apply grouping
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
            // 7.2.1 Extract area from address (simplified)
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

    // 7.3 Convert to section list format with paired items
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data: groupItemsInPairs(data) }));
  }, [favorites, sortBy, groupBy, groupItemsInPairs]);

  // 8. Navigation Functions
  const navigateToRestaurant = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    },
    [router]
  );

  const quickBook = useCallback(
    (restaurant: Restaurant) => {
      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          quickBook: "true",
        },
      });
    },
    [router]
  );

  // 9. Component Lifecycle
  useEffect(() => {
    if (profile) {
      fetchFavorites();
    }
  }, [profile, fetchFavorites]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setInsightsBannerDismissed(false); // Reset banner when refreshing
    fetchFavorites();
  }, [fetchFavorites]);

  // 10. Render Components
  // 10.1 Grid Card Component
  const GridCard = ({ item }: { item: Favorite }) => (
    <Animated.View
      style={{
        opacity: removingId === item.id ? fadeAnim : 1,
        transform: [{ scale: removingId === item.id ? scaleAnim : 1 }],
      }}
      className="flex-1 p-2"
    >
      <Pressable
        onPress={() => navigateToRestaurant(item.restaurant_id)}
        onLongPress={() => removeFavorite(item.id, item.restaurant.name)}
        className="bg-card rounded-xl overflow-hidden shadow-sm"
      >
        <Image
          source={{ uri: item.restaurant.main_image_url }}
          className="w-full h-32"
          contentFit="cover"
        />
        <View className="p-3">
          <Text className="font-semibold text-sm" numberOfLines={1}>
            {item.restaurant.name}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {item.restaurant.cuisine_type}
          </Text>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center gap-1">
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-xs">
                {item.restaurant.average_rating?.toFixed(1) || "N/A"}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {"$".repeat(item.restaurant.price_range)}
            </Text>
          </View>

          {(item.total_bookings || 0) > 0 && (
            <View className="mt-2 bg-primary/10 rounded px-2 py-1">
              <Text className="text-xs text-primary font-medium">
                Visited {item.total_bookings}x
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );

  // 10.2 Grid Row Component (renders 1 or 2 cards in a row)
  const GridRow = ({ item: pair }: { item: FavoritePair }) => (
    <View className="flex-row">
      <GridCard item={pair[0]} />
      {pair[1] ? <GridCard item={pair[1]} /> : <View className="flex-1 p-2" />}
    </View>
  );

  // 10.3 Filter Modal
  const FilterModal = () => (
    <Modal
      visible={showOptions}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowOptions(false)}
    >
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Pressable
            onPress={() => setShowOptions(false)}
            className="flex-row items-center gap-2"
          >
            <ChevronLeft size={24} />
            <Text className="text-lg font-medium">Filters</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              // Reset to defaults
              setSortBy("recently_added");
              setGroupBy("none");
            }}
            className="px-3 py-1"
          >
            <Text className="text-primary font-medium">Reset</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Sort Options Section */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold text-lg mb-4">Sort By</Text>
            <View className="gap-3">
              {SORT_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                const isSelected = sortBy === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSortBy(option.value)}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <IconComponent
                        size={20}
                        color={
                          isSelected
                            ? colorScheme === "dark"
                              ? "#3b82f6"
                              : "#2563eb"
                            : "#666"
                        }
                      />
                      <Text
                        className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground text-xs">
                          ✓
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Group Options Section */}
          <View className="p-4">
            <Text className="font-semibold text-lg mb-4">Group By</Text>
            <View className="gap-3">
              {GROUP_OPTIONS.map((option) => {
                const isSelected = groupBy === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setGroupBy(option.value)}
                    className={`flex-row items-center justify-between p-4 rounded-xl border ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                        <Text className="text-primary-foreground text-xs">
                          ✓
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Apply Button */}
        <View className="p-4 border-t border-border">
          <Button
            onPress={() => {
              setShowOptions(false);
              // Trigger haptic feedback
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="w-full"
          >
            <Text className="text-primary-foreground font-semibold">
              Apply Filters
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // 10.4 Empty State
  const EmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Heart size={64} color="#666" strokeWidth={1} />
      <H3 className="mt-4 text-center">No Favorites Yet</H3>
      <Muted className="mt-2 text-center px-8">
        Start exploring and add restaurants to your favorites for quick access
      </Muted>
      <Button
        variant="default"
        className="mt-6"
        onPress={() => router.push("/search")}
      >
        <Text>Discover Restaurants</Text>
      </Button>
    </View>
  );

  // 10.5 Section Header
  const SectionHeader = ({ title }: { title: string }) => {
    if (!title) return null;

    return (
      <View className="bg-background px-4 py-2">
        <Text className="font-semibold text-muted-foreground">{title}</Text>
      </View>
    );
  };

  // 11. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 12. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 12.1 Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <H2>My Favorites</H2>
          <Muted className="text-sm">
            {favorites.length}{" "}
            {favorites.length === 1 ? "restaurant" : "restaurants"}
          </Muted>
        </View>
        <Pressable
          onPress={() => setShowOptions(!showOptions)}
          className="p-2 relative"
        >
          <Filter size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          {/* Active filter indicator */}
          {(sortBy !== "recently_added" || groupBy !== "none") && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
          )}
        </Pressable>
      </View>

      {/* 12.2 Content */}
      {favorites.length === 0 ? (
        <EmptyState />
      ) : groupBy === "none" ? (
        // 12.2.1 Grid View without sections (using FlatList for better performance)
        <FlatList
          data={processedFavorites[0].data}
          renderItem={GridRow}
          keyExtractor={(item, index) => `${item[0].id}-${index}`}
          contentContainerStyle={{ padding: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colorScheme === "dark" ? "#fff" : "#000"}
            />
          }
        />
      ) : (
        // 12.2.2 Section List View with grid layout
        <SectionList
          sections={processedFavorites}
          renderItem={GridRow}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} />
          )}
          keyExtractor={(item, index) => `${item[0].id}-${index}`}
          contentContainerStyle={{
            padding: 8,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colorScheme === "dark" ? "#fff" : "#000"}
            />
          }
          stickySectionHeadersEnabled
        />
      )}

      {/* 12.3 Insights Banner (when applicable) */}
      {favorites.length > 5 && !insightsBannerDismissed && (
        <View className="absolute bottom-1 left-4 right-4">
          <View className="bg-primary rounded-xl p-4 shadow-lg">
            <View className="flex-row items-center">
              <Sparkles size={24} color="#fff" />
              <Pressable
                onPress={() => router.push("/profile/insights")}
                className="flex-1 ml-3"
              >
                <Text className="text-primary-foreground font-semibold">
                  Discover Your Dining Patterns
                </Text>
                <Text className="text-primary-foreground/80 text-sm">
                  View insights about your favorite cuisines and dining habits
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => router.push("/profile/insights")}
                  className="p-2"
                >
                  <ChevronRight size={20} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setInsightsBannerDismissed(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 12.4 Filter Modal */}
      <FilterModal />
    </SafeAreaView>
  );
}
