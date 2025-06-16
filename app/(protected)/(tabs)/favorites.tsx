// app/(protected)/(tabs)/favorites.tsx
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  Animated,
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
  Grid,
  List,
  Calendar,
  ChevronRight,
  Sparkles,
  TrendingUp,
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

type ViewMode = "grid" | "list";
type SortBy = "recently_added" | "name" | "rating" | "most_visited" | "cuisine";
type GroupBy = "none" | "cuisine" | "price_range" | "location";

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
  
  // 3.3 View Configuration States
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("recently_added");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showOptions, setShowOptions] = useState(false);
  
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
        .select(`
          *,
          restaurant:restaurants (*)
        `)
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
  const removeFavorite = useCallback(async (favoriteId: string, restaurantName: string) => {
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
  }, [fadeAnim, scaleAnim]);

  // 6. Sorting and Grouping Logic
  const processedFavorites = useMemo(() => {
    // 6.1 Apply sorting
    let sorted = [...favorites];
    
    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.restaurant.name.localeCompare(b.restaurant.name));
        break;
      case "rating":
        sorted.sort((a, b) => (b.restaurant.average_rating || 0) - (a.restaurant.average_rating || 0));
        break;
      case "most_visited":
        sorted.sort((a, b) => (b.total_bookings || 0) - (a.total_bookings || 0));
        break;
      case "cuisine":
        sorted.sort((a, b) => a.restaurant.cuisine_type.localeCompare(b.restaurant.cuisine_type));
        break;
      case "recently_added":
      default:
        // Already sorted by created_at desc from query
        break;
    }
    
    // 6.2 Apply grouping
    if (groupBy === "none") {
      return [{ title: "", data: sorted }];
    }
    
    const grouped = sorted.reduce((acc, favorite) => {
      let key: string;
      
      switch (groupBy) {
        case "cuisine":
          key = favorite.restaurant.cuisine_type;
          break;
        case "price_range":
          key = `${"$".repeat(favorite.restaurant.price_range)} (${
            ["Budget", "Moderate", "Upscale", "Fine Dining"][favorite.restaurant.price_range - 1]
          })`;
          break;
        case "location":
          // 6.2.1 Extract area from address (simplified)
          key = favorite.restaurant.address.split(",")[1]?.trim() || "Unknown Area";
          break;
        default:
          key = "Other";
      }
      
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(favorite);
      return acc;
    }, {} as Record<string, Favorite[]>);
    
    // 6.3 Convert to section list format
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [favorites, sortBy, groupBy]);

  // 7. Navigation Functions
  const navigateToRestaurant = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurantId },
    });
  }, [router]);

  const quickBook = useCallback((restaurant: Restaurant) => {
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        quickBook: "true",
      },
    });
  }, [router]);

  // 8. Component Lifecycle
  useEffect(() => {
    if (profile) {
      fetchFavorites();
    }
  }, [profile, fetchFavorites]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, [fetchFavorites]);

  // 9. Render Components
  // 9.1 Grid View Card
  const GridCard = ({ item }: { item: Favorite }) => (
    <Animated.View
      style={{
        opacity: removingId === item.id ? fadeAnim : 1,
        transform: [{ scale: removingId === item.id ? scaleAnim : 1 }],
      }}
      className="w-1/2 p-2"
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
              <Text className="text-xs">{item.restaurant.average_rating?.toFixed(1) || "N/A"}</Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {"$".repeat(item.restaurant.price_range)}
            </Text>
          </View>
          
          {item.total_bookings > 0 && (
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

  // 9.2 List View Card
  const ListCard = ({ item }: { item: Favorite }) => (
    <Animated.View
      style={{
        opacity: removingId === item.id ? fadeAnim : 1,
        transform: [{ scale: removingId === item.id ? scaleAnim : 1 }],
      }}
    >
      <Pressable
        onPress={() => navigateToRestaurant(item.restaurant_id)}
        onLongPress={() => removeFavorite(item.id, item.restaurant.name)}
        className="bg-card rounded-xl overflow-hidden mb-3 shadow-sm"
      >
        <View className="flex-row p-4">
          <Image
            source={{ uri: item.restaurant.main_image_url }}
            className="w-24 h-24 rounded-lg"
            contentFit="cover"
          />
          
          <View className="flex-1 ml-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <H3 className="mb-1">{item.restaurant.name}</H3>
                <P className="text-muted-foreground text-sm">{item.restaurant.cuisine_type}</P>
              </View>
              <Heart size={20} color="#ef4444" fill="#ef4444" />
            </View>
            
            <View className="flex-row items-center gap-3 mt-2">
              <View className="flex-row items-center gap-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm">{item.restaurant.average_rating?.toFixed(1) || "N/A"}</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                {"$".repeat(item.restaurant.price_range)}
              </Text>
              <View className="flex-row items-center gap-1">
                <MapPin size={14} color="#666" />
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {item.restaurant.address.split(",")[0]}
                </Text>
              </View>
            </View>
            
            {/* 9.2.1 Statistics Row */}
            <View className="flex-row items-center gap-3 mt-3">
              {item.total_bookings > 0 && (
                <View className="bg-primary/10 rounded-full px-2 py-1">
                  <Text className="text-xs text-primary font-medium">
                    {item.total_bookings} visits
                  </Text>
                </View>
              )}
              {item.last_booking && (
                <Text className="text-xs text-muted-foreground">
                  Last visited {new Date(item.last_booking).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* 9.2.2 Quick Actions */}
        <View className="border-t border-border px-4 py-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                {item.restaurant.opening_time} - {item.restaurant.closing_time}
              </Text>
            </View>
            <Button
              size="sm"
              variant="secondary"
              onPress={(e) => {
                e.stopPropagation();
                quickBook(item.restaurant);
              }}
            >
              <Calendar size={14} />
              <Text className="ml-1 text-xs">Book Now</Text>
            </Button>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  // 9.3 Options Modal
  const OptionsSheet = () => (
    <View className="absolute top-0 left-0 right-0 bg-background shadow-lg rounded-b-xl p-4 z-10">
      {/* 9.3.1 View Mode Toggle */}
      <View className="mb-4">
        <Text className="font-semibold mb-2">View Mode</Text>
        <View className="flex-row bg-muted rounded-lg p-1">
          <Pressable
            onPress={() => setViewMode("list")}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2 rounded-md ${
              viewMode === "list" ? "bg-background" : ""
            }`}
          >
            <List size={16} color={viewMode === "list" ? "#000" : "#666"} />
            <Text className={viewMode === "list" ? "font-medium" : "text-muted-foreground"}>
              List
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("grid")}
            className={`flex-1 flex-row items-center justify-center gap-2 py-2 rounded-md ${
              viewMode === "grid" ? "bg-background" : ""
            }`}
          >
            <Grid size={16} color={viewMode === "grid" ? "#000" : "#666"} />
            <Text className={viewMode === "grid" ? "font-medium" : "text-muted-foreground"}>
              Grid
            </Text>
          </Pressable>
        </View>
      </View>
      
      {/* 9.3.2 Sort Options */}
      <View className="mb-4">
        <Text className="font-semibold mb-2">Sort By</Text>
        <View className="flex-row flex-wrap gap-2">
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSortBy(option.value)}
              className={`px-3 py-2 rounded-full border ${
                sortBy === option.value
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              <Text
                className={
                  sortBy === option.value
                    ? "text-primary-foreground text-sm"
                    : "text-foreground text-sm"
                }
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      
      {/* 9.3.3 Group Options */}
      <View>
        <Text className="font-semibold mb-2">Group By</Text>
        <View className="flex-row flex-wrap gap-2">
          {GROUP_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setGroupBy(option.value)}
              className={`px-3 py-2 rounded-full border ${
                groupBy === option.value
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              <Text
                className={
                  groupBy === option.value
                    ? "text-primary-foreground text-sm"
                    : "text-foreground text-sm"
                }
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  // 9.4 Empty State
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

  // 9.5 Section Header
  const SectionHeader = ({ title }: { title: string }) => {
    if (!title) return null;
    
    return (
      <View className="bg-background px-4 py-2">
        <Text className="font-semibold text-muted-foreground">{title}</Text>
      </View>
    );
  };

  // 10. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  // 11. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 11.1 Header */}
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-1">
          <H2>My Favorites</H2>
          <Muted className="text-sm">
            {favorites.length} {favorites.length === 1 ? "restaurant" : "restaurants"}
          </Muted>
        </View>
        <Pressable
          onPress={() => setShowOptions(!showOptions)}
          className="p-2"
        >
          <Filter size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
        </Pressable>
      </View>
      
      {/* 11.2 Options Sheet */}
      {showOptions && <OptionsSheet />}
      
      {/* 11.3 Content */}
      {favorites.length === 0 ? (
        <EmptyState />
      ) : groupBy === "none" && viewMode === "grid" ? (
        // 11.3.1 Grid View without sections
        <FlatList
          data={processedFavorites[0].data}
          renderItem={({ item }) => <GridCard item={item} />}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 8 }}
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
        // 11.3.2 Section List View
        <SectionList
          sections={processedFavorites}
          renderItem={({ item }) =>
            viewMode === "list" ? <ListCard item={item} /> : <GridCard item={item} />
          }
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ 
            padding: viewMode === "list" ? 16 : 8,
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
      
      {/* 11.4 Insights Banner (when applicable) */}
      {favorites.length > 5 && (
        <View className="absolute bottom-20 left-4 right-4">
          <Pressable
            onPress={() => router.push("/profile/insights")}
            className="bg-primary rounded-xl p-4 flex-row items-center shadow-lg"
          >
            <Sparkles size={24} color="#fff" />
            <View className="flex-1 ml-3">
              <Text className="text-primary-foreground font-semibold">
                Discover Your Dining Patterns
              </Text>
              <Text className="text-primary-foreground/80 text-sm">
                View insights about your favorite cuisines and dining habits
              </Text>
            </View>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}