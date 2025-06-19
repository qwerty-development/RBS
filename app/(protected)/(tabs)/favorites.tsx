// app/(protected)/(tabs)/favorites.tsx
import React, { useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  SectionList,
} from "react-native";
import { useRouter } from "expo-router";
import { Filter } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useFavorites } from "@/hooks/useFavorites";
import { useFavoritesFilters } from "@/hooks/useFavoritesFilters";
import {
  FavoritesGridRow,
  FavoritesEmptyState,
  FavoritesSectionHeader,
  FavoritesInsightsBanner,
  FavoritesFilterModal,
} from "@/components/favorites";

export default function FavoritesScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  // Custom hooks for data and filtering
  const {
    favorites,
    loading,
    refreshing,
    removingId,
    fadeAnim,
    scaleAnim,
    fetchFavorites,
    removeFavorite,
    handleRefresh: originalHandleRefresh,
  } = useFavorites();

  const {
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
  } = useFavoritesFilters(favorites);

  // Navigation functions
  const navigateToRestaurant = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    },
    [router]
  );

  const navigateToInsights = useCallback(() => {
    router.push("/profile/insights");
  }, [router]);

  const navigateToSearch = useCallback(() => {
    router.push("/search");
  }, [router]);

  // Enhanced refresh handler that resets banner
  const handleRefresh = useCallback(() => {
    resetBannerOnRefresh();
    originalHandleRefresh();
  }, [resetBannerOnRefresh, originalHandleRefresh]);

  // Component lifecycle
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Render grid row with proper props
  const renderGridRow = useCallback(
    ({ item, index }: any) => (
      <FavoritesGridRow
        item={item}
        onPress={navigateToRestaurant}
        onLongPress={removeFavorite}
        removingId={removingId}
        fadeAnim={fadeAnim}
        scaleAnim={scaleAnim}
      />
    ),
    [navigateToRestaurant, removeFavorite, removingId, fadeAnim, scaleAnim]
  );

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section }: any) => <FavoritesSectionHeader title={section.title} />,
    []
  );

  // Loading state
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
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
          {hasActiveFilters && (
            <View className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
          )}
        </Pressable>
      </View>

      {/* Content */}
      {favorites.length === 0 ? (
        <FavoritesEmptyState onDiscoverPress={navigateToSearch} />
      ) : groupBy === "none" ? (
        // Grid View without sections (using FlatList for better performance)
        <FlatList
          data={processedFavorites[0].data}
          renderItem={renderGridRow}
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
        // Section List View with grid layout
        <SectionList
          sections={processedFavorites}
          renderItem={renderGridRow}
          renderSectionHeader={renderSectionHeader}
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

      {/* Insights Banner */}
      <FavoritesInsightsBanner
        isVisible={favorites.length > 5 && !insightsBannerDismissed}
        onInsightsPress={navigateToInsights}
        onDismiss={() => setInsightsBannerDismissed(true)}
      />

      {/* Filter Modal */}
      <FavoritesFilterModal
        visible={showOptions}
        sortBy={sortBy}
        groupBy={groupBy}
        onClose={() => setShowOptions(false)}
        onSortChange={setSortBy}
        onGroupChange={setGroupBy}
        onReset={resetFilters}
      />
    </SafeAreaView>
  );
}
