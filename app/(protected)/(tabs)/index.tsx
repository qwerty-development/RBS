// app/(protected)/(tabs)/index.tsx
import React, { useRef, useState } from "react";
import {
  Animated,
  View,
  RefreshControl,
  FlatList,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";

import { useColorScheme } from "@/lib/useColorScheme";
import { Text } from "@/components/ui/text";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/ui/section-header";
import { LoyaltyWidget } from "@/components/home/LoyaltyWidget";
import { HomeHeader } from "@/components/home/HomeHeader";
import { SpecialOfferBannerCarousel } from "@/components/home/SpecialOfferBannerCarousel";
import { Button } from "@/components/ui/button";
import { getRefreshControlColor } from "@/lib/utils";

import { useHomeScreenLogic } from "@/hooks/useHomeScreenLogic";
import { useOffers } from "@/hooks/useOffers";
import { useAuth } from "@/context/supabase-provider";
import { useGuestGuard } from "@/hooks/useGuestGuard";

import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { CUISINE_CATEGORIES } from "@/constants/homeScreenData";
import HomeScreenSkeleton from "@/components/skeletons/HomeScreenSkeleton";

// Global ref for scroll to top functionality
export const homeScrollRef = { current: null as any };

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // --- Guest & Auth Hooks ---
  const { isGuest, convertGuestToUser } = useAuth();
  const {
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // --- Data & Logic Hooks ---
  const {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    location,
    refreshing,
    loading,
    profile,
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleCuisinePress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
  } = useHomeScreenLogic();

  const { offers: specialOffers, loading: offersLoading } = useOffers();

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
  const handleToggleFavorite = (restaurantId: string) => {
    runProtectedAction(() => {
      // Your actual logic to toggle the favorite status would go here.
      // For now, we'll just log it.
      console.log(`Toggling favorite for restaurant: ${restaurantId}`);
      // e.g., call a function from a `useFavorites` hook
    }, "save your favorite restaurants");
  };

  // --- Loading State ---
  if (loading || offersLoading) {
    return <HomeScreenSkeleton />;
  }

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
                  Welcome to Booklet!
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

        <SpecialOfferBannerCarousel offers={specialOffers} />

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
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {newRestaurants.length > 0 && (
          <View className="mb-6">
            <SectionHeader
              title="New to the Platform"
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
                  variant="compact"
                  onPress={handleRestaurantPress}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
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
                  variant="compact"
                  onPress={handleRestaurantPress}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {/* Only show loyalty widget for signed-in users */}
        {!isGuest && (
          <LoyaltyWidget
            loyaltyPoints={profile?.loyalty_points || 0}
            onPress={handleProfilePress}
            colorScheme={colorScheme}
          />
        )}
        <View className="h-4" />
      </Animated.ScrollView>

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
