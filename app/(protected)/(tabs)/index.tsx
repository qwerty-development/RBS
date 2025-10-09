// app/(protected)/(tabs)/index.tsx
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Animated,
  View,
  RefreshControl,
  FlatList,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/lib/useColorScheme";
import { Text } from "@/components/ui/text";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/ui/section-header";
import { LoyaltyWidget } from "@/components/home/LoyaltyWidget";
import { HomeHeader } from "@/components/home/HomeHeader";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import { Button } from "@/components/ui/button";
import { getRefreshControlColor } from "@/lib/utils";
import { supabase } from "@/config/supabase";

import { useHomeScreenLogic } from "@/hooks/useHomeScreenLogic";
import { useBanners } from "@/hooks/useBanners";
import { useAuth } from "@/context/supabase-provider";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useRestaurantStore } from "@/stores/index";

import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { CUISINE_CATEGORIES } from "@/constants/homeScreenData";
import HomeScreenSkeleton from "@/components/skeletons/HomeScreenSkeleton";

// Global ref for scroll to top functionality
export const homeScrollRef = { current: null as any };

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // --- Guest & Auth Hooks ---
  const { isGuest, convertGuestToUser, profile } = useAuth();
  const {
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // --- Favorites Management from Zustand ---
  const {
    isFavorite: checkIsFavorite,
    addToFavorites,
    removeFromFavorites,
  } = useRestaurantStore();

  // --- Sync Favorites from Database ---
  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("restaurant_id")
        .eq("user_id", profile.id);

      if (error) throw error;

      // Sync to Zustand store
      const favoriteIds = data?.map((f) => f.restaurant_id) || [];
      favoriteIds.forEach((id) => {
        if (!checkIsFavorite(id)) {
          addToFavorites(id);
        }
      });
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  }, [profile?.id, checkIsFavorite, addToFavorites]);

  const toggleFavorite = useCallback(
    async (restaurantId: string) => {
      if (!profile?.id) {
        console.error("Missing profile ID");
        return;
      }

      try {
        // Check current favorite status
        const currentIsFavorite = checkIsFavorite(restaurantId);

        if (currentIsFavorite) {
          // Remove from favorites
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId)
            .select();

          if (error) {
            console.error("Home: Supabase delete error:", error);
            throw error;
          }

          // Update Zustand store
          removeFromFavorites(restaurantId);
        } else {
          // Add to favorites
          const { error } = await supabase
            .from("favorites")
            .insert({
              user_id: profile.id,
              restaurant_id: restaurantId,
            })
            .select();

          if (error) {
            console.error("Home: Supabase insert error:", error);
            throw error;
          }

          // Update Zustand store
          addToFavorites(restaurantId);
        }
      } catch (error: any) {
        console.error("Home: Error toggling favorite:", {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        Alert.alert(
          "Error",
          `Failed to update favorite status: ${error?.message || "Unknown error"}`,
        );
      }
    },
    [profile?.id, checkIsFavorite, addToFavorites, removeFromFavorites],
  );

  // --- Data & Logic Hooks ---
  const {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    recentlyVisitedRestaurants,
    location,
    refreshing,
    loading,
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleCuisinePress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
  } = useHomeScreenLogic();

  const { banners, loading: bannersLoading } = useBanners();

  // --- Performance Optimization: getItemLayout for FlatLists ---
  // Featured cards: width 288 + 16 margin = 304
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: 304,
      offset: 304 * index,
      index,
    }),
    [],
  );

  // --- Animation State ---
  const scrollY = useRef(new Animated.Value(0)).current;
  const [totalHeaderHeight, setTotalHeaderHeight] = useState(0);
  const [collapsibleHeaderHeight, setCollapsibleHeaderHeight] = useState(0);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, collapsibleHeaderHeight],
    outputRange: [0, -collapsibleHeaderHeight],
    extrapolate: "clamp",
  });

  const greetingOpacity = scrollY.interpolate({
    inputRange: [0, collapsibleHeaderHeight / 2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // --- Protected Action Handlers ---
  const handleToggleFavorite = useCallback(
    (restaurantId: string) => {
      runProtectedAction(() => {
        toggleFavorite(restaurantId);
      }, "save your favorite restaurants");
    },
    [runProtectedAction, toggleFavorite],
  );

  // --- Effects ---
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // --- Loading State ---
  const isLoading = loading || bannersLoading;

  return (
    <View className="flex-1 bg-background">
      <HomeHeader
        profile={profile}
        isGuest={isGuest} // Pass guest status
        location={location}
        headerTranslateY={headerTranslateY}
        greetingOpacity={greetingOpacity}
        setTotalHeaderHeight={setTotalHeaderHeight}
        setCollapsibleHeaderHeight={setCollapsibleHeaderHeight}
        onLocationPress={handleLocationPress}
        onProfilePress={isGuest ? convertGuestToUser : handleProfilePress}
      />

      {isLoading ? (
        <HomeScreenSkeleton />
      ) : (
        <Animated.ScrollView
          ref={(ref) => {
            homeScrollRef.current = ref;
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getRefreshControlColor(colorScheme)}
              progressViewOffset={totalHeaderHeight}
            />
          }
        >
          <View style={{ height: totalHeaderHeight }} />

          {/* Guest Banner */}
          {isGuest && (
            <View className="mx-4 my-4 bg-primary/10 rounded-lg p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="font-semibold text-primary">
                    Welcome to Plate!
                  </Text>
                  <Text className="text-sm text-muted-foreground mt-1">
                    Sign up to unlock exclusive features
                  </Text>
                </View>
                <Button size="sm" onPress={convertGuestToUser} className="ml-3">
                  <Text className="text-white text-xs font-bold">Sign Up</Text>
                </Button>
              </View>
            </View>
          )}

          <View className="mb-6 mt-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="pl-4"
            >
              <View className="flex-row gap-3 pr-4">
                {CUISINE_CATEGORIES.map((cuisine) => (
                  <CuisineCategory
                    key={cuisine.id}
                    cuisine={cuisine}
                    onPress={handleCuisinePress}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Loyalty Widget moved above banners - only show for signed-in users */}
          {!isGuest && (
            <LoyaltyWidget
              loyaltyPoints={profile?.loyalty_points || 0}
              onPress={() => router.push("/profile/loyalty")}
              colorScheme={colorScheme}
            />
          )}

          <BannerCarousel banners={banners} />

          {featuredRestaurants.length > 0 && (
            <View className="mb-6">
              <SectionHeader
                title="Featured This Week"
                subtitle="Hand-picked restaurants just for you"
                actionLabel="See All"
                onAction={handleSearchPress}
              />
              <FlatList
                horizontal
                data={featuredRestaurants}
                renderItem={({ item }) => (
                  <RestaurantCard
                    item={item}
                    variant="featured"
                    onPress={handleRestaurantPress}
                    onFavoritePress={() => handleToggleFavorite(item.id)}
                    isFavorite={checkIsFavorite(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
              />
            </View>
          )}

          {newRestaurants.length > 0 && (
            <View className="mb-6">
              <SectionHeader
                title="New to the App"
                subtitle="Recently added restaurants"
                actionLabel="Explore"
                onAction={() => handleSearchWithParams({ sortBy: "newest" })}
              />
              <FlatList
                horizontal
                data={newRestaurants}
                renderItem={({ item }) => (
                  <RestaurantCard
                    item={item}
                    variant="featured"
                    onPress={handleRestaurantPress}
                    onFavoritePress={() => handleToggleFavorite(item.id)}
                    isFavorite={checkIsFavorite(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
              />
            </View>
          )}

          {topRatedRestaurants.length > 0 && (
            <View className="mb-6">
              <SectionHeader
                title="Top Rated"
                subtitle="Highest rated by diners"
                actionLabel="View All"
                onAction={() => handleSearchWithParams({ sortBy: "rating" })}
              />
              <FlatList
                horizontal
                data={topRatedRestaurants}
                renderItem={({ item }) => (
                  <RestaurantCard
                    item={item}
                    variant="featured"
                    onPress={handleRestaurantPress}
                    onFavoritePress={() => handleToggleFavorite(item.id)}
                    isFavorite={checkIsFavorite(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
              />
            </View>
          )}

          {recentlyVisitedRestaurants.length > 0 && (
            <View className="mb-6">
              <SectionHeader
                title="Recently Visited"
                subtitle="Places you've completed bookings at"
                actionLabel="See All"
                onAction={() =>
                  router.push("/(protected)/(tabs)/bookings?tab=past")
                }
              />
              <FlatList
                horizontal
                data={recentlyVisitedRestaurants}
                renderItem={({ item }) => (
                  <RestaurantCard
                    item={item}
                    variant="featured"
                    onPress={handleRestaurantPress}
                    onFavoritePress={() => handleToggleFavorite(item.id)}
                    isFavorite={checkIsFavorite(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={getItemLayout}
              />
            </View>
          )}

          {/* Add bottom padding to account for tab bar */}
          <View className="h-24" />
        </Animated.ScrollView>
      )}

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />
    </View>
  );
}
