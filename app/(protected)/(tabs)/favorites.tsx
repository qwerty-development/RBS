// app/(protected)/(tabs)/favorites.tsx
import React, { useEffect, useCallback, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  SectionList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Filter, Plus, FolderPlus, Heart } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { useColorScheme } from "@/lib/useColorScheme";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavoritesFilters } from "@/hooks/useFavoritesFilters";
import {
  FavoritesGridRow,
  FavoritesEmptyState,
  FavoritesInsightsBanner,
  FavoritesFilterModal,
} from "@/components/favorites";
import { PlaylistCard } from "@/components/playlists/PlaylistCard";
import { CreatePlaylistModal } from "@/components/playlists/CreatePlaylistModal";

export default function FavoritesScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [activeTab, setActiveTab] = useState<"favorites" | "playlists">("favorites");

  // Favorites hooks
  const {
    favorites,
    loading: favoritesLoading,
    refreshing: favoritesRefreshing,
    removingId,
    fadeAnim,
    scaleAnim,
    fetchFavorites,
    removeFavorite,
    handleRefresh: originalHandleRefresh,
  } = useFavorites();

  // Playlists hooks
  const {
    playlists,
    loading: playlistsLoading,
    refreshing: playlistsRefreshing,
    createPlaylist,
    handleRefresh: handlePlaylistsRefresh,
  } = usePlaylists();

  // Filters hook
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

  const navigateToPlaylist = useCallback(
    (playlistId: string) => {
      router.push({
        pathname: "/playlist/[id]",
        params: { id: playlistId },
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

  // Enhanced refresh handler
  const handleRefresh = useCallback(() => {
    if (activeTab === "favorites") {
      resetBannerOnRefresh();
      originalHandleRefresh();
    } else {
      handlePlaylistsRefresh();
    }
  }, [activeTab, resetBannerOnRefresh, originalHandleRefresh, handlePlaylistsRefresh]);

  // Handle playlist creation
  const handleCreatePlaylist = useCallback(async (data: {
    name: string;
    description: string;
    emoji: string;
  }) => {
    const newPlaylist = await createPlaylist(data.name, data.description, data.emoji);
    if (newPlaylist) {
      setShowCreatePlaylist(false);
      navigateToPlaylist(newPlaylist.id);
    }
  }, [createPlaylist, navigateToPlaylist]);

  // Component lifecycle
  useEffect(() => {
    if (activeTab === "favorites") {
      fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  // Render grid row
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
    ({ section }: any) => <SectionHeader title={section.title} />,
    []
  );

  // Render playlist item
  const renderPlaylistItem = useCallback(
    ({ item }: { item: any }) => (
      <PlaylistCard
        playlist={item}
        onPress={() => navigateToPlaylist(item.id)}
        variant="list"
      />
    ),
    [navigateToPlaylist]
  );

  const loading = activeTab === "favorites" ? favoritesLoading : playlistsLoading;
  const refreshing = activeTab === "favorites" ? favoritesRefreshing : playlistsRefreshing;

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
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <H2>My Collection</H2>
            <Muted className="text-sm">
              {activeTab === "favorites"
                ? `${favorites.length} ${favorites.length === 1 ? "restaurant" : "restaurants"}`
                : `${playlists.length} ${playlists.length === 1 ? "playlist" : "playlists"}`}
            </Muted>
          </View>
          
          {activeTab === "favorites" ? (
            <Pressable
              onPress={() => setShowOptions(!showOptions)}
              className="p-2 relative"
            >
              <Filter size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
              {hasActiveFilters && (
                <View className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowCreatePlaylist(true)}
              className="p-2"
            >
              <Plus size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <Pressable
            onPress={() => setActiveTab("favorites")}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
              activeTab === "favorites" ? "bg-white dark:bg-gray-700" : ""
            }`}
          >
            <Heart
              size={18}
              color={activeTab === "favorites" ? "#dc2626" : "#6b7280"}
              fill={activeTab === "favorites" ? "#dc2626" : "none"}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === "favorites" ? "text-primary" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Favorites
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => setActiveTab("playlists")}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
              activeTab === "playlists" ? "bg-white dark:bg-gray-700" : ""
            }`}
          >
            <FolderPlus
              size={18}
              color={activeTab === "playlists" ? "#dc2626" : "#6b7280"}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === "playlists" ? "text-primary" : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Playlists
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {activeTab === "favorites" ? (
        // Favorites content
        favorites.length === 0 ? (
          <FavoritesEmptyState onDiscoverPress={navigateToSearch} />
        ) : groupBy === "none" ? (
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
        )
      ) : (
        // Playlists content
        playlists.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <FolderPlus size={64} color="#6b7280" className="mb-4" />
            <H3 className="text-center mb-2">No Playlists Yet</H3>
            <Muted className="text-center mb-6">
              Create playlists to organize your favorite restaurants by theme, occasion, or any way you like!
            </Muted>
            <Button onPress={() => setShowCreatePlaylist(true)}>
              <Text className="text-white">Create Your First Playlist</Text>
            </Button>
          </View>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderPlaylistItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colorScheme === "dark" ? "#fff" : "#000"}
              />
            }
          />
        )
      )}

      {/* Insights Banner (only for favorites) */}
      {activeTab === "favorites" && (
        <FavoritesInsightsBanner
          isVisible={favorites.length > 5 && !insightsBannerDismissed}
          onInsightsPress={navigateToInsights}
          onDismiss={() => setInsightsBannerDismissed(true)}
        />
      )}

      {/* Filter Modal (only for favorites) */}
      {activeTab === "favorites" && (
        <FavoritesFilterModal
          visible={showOptions}
          sortBy={sortBy}
          groupBy={groupBy}
          onClose={() => setShowOptions(false)}
          onSortChange={setSortBy}
          onGroupChange={setGroupBy}
          onReset={resetFilters}
        />
      )}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        visible={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onSubmit={handleCreatePlaylist}
      />
    </SafeAreaView>
  );
};