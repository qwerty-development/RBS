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
import {
  Filter,
  Plus,
  FolderPlus,
  Heart,
  UserPlus,
  Mail,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { PageHeader } from "@/components/ui/page-header";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useFavorites } from "@/hooks/useFavorites";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useFavoritesFilters } from "@/hooks/useFavoritesFilters";
import { usePlaylistInvitations } from "@/hooks/usePlaylistInvitations";
import { getRefreshControlColor } from "@/lib/utils";
import {
  FavoritesGridRow,
  FavoritesEmptyState,
  FavoritesInsightsBanner,
  FavoritesFilterModal,
} from "@/components/favorites";
import { PlaylistCard } from "@/components/playlists/PlaylistCard";
import { CreatePlaylistModal } from "@/components/playlists/CreatePlaylistModal";
import FavoritesScreenSkeleton from "@/components/skeletons/FavoritesScreenSkeleton";

// Error boundary component for playlists
class PlaylistErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Playlist Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { isGuest, convertGuestToUser } = useAuth();

  // --- All hooks must be called before any early returns ---
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [activeTab, setActiveTab] = useState<"favorites" | "playlists">(
    "favorites",
  );
  const [playlistError, setPlaylistError] = useState(false);
  const [invitationError, setInvitationError] = useState(false);

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

  // Playlists hooks with error handling
  // We let the hook surface its own error state instead of catching here –
  // calling setState inside render causes an infinite re-render loop and the
  // `commitLayoutEffectOnFiber` stack you were seeing.
  const playlistsHook = usePlaylists();

  // Reflect hook-level error in local UI state *after* the commit phase.
  useEffect(() => {
    if (playlistsHook.error) {
      setPlaylistError(true);
    }
  }, [playlistsHook.error]);

  const {
    playlists = [],
    loading: playlistsLoading = false,
    refreshing: playlistsRefreshing = false,
    createPlaylist,
    handleRefresh: handlePlaylistsRefresh,
    removePlaylistFromState,
  } = playlistsHook;

  // --- Guest View ---
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Header */}
        <View className="p-4">
          <H2>My Collection</H2>
        </View>

        {/* Guest State */}
        <View className="flex-1 items-center justify-center px-6 -mt-10">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <Heart size={48} className="text-primary" />
          </View>

          <H2 className="text-center mb-2">Save & Organize</H2>
          <P className="text-center text-muted-foreground mb-8">
            Create an account to save your favorite spots and create playlists
            for any occasion.
          </P>

          <Button
            onPress={convertGuestToUser}
            size="lg"
            className="w-full max-w-xs"
          >
            <UserPlus size={20} color="#fff" />
            <Text className="ml-2 font-bold text-white">
              Create a Free Account
            </Text>
          </Button>

          <Button
            onPress={() => router.push("/(protected)/(tabs)/search")}
            size="lg"
            variant="ghost"
            className="w-full max-w-xs mt-2"
          >
            <Text>Browse Restaurants</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Invitations hook (same pattern as above – keep side-effects out of render)
  const invitationsHook = usePlaylistInvitations();

  useEffect(() => {
    if (invitationsHook.error) {
      setInvitationError(true);
    }
  }, [invitationsHook.error]);

  const { pendingCount = 0 } = invitationsHook;

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
      try {
        router.push({
          pathname: "/restaurant/[id]",
          params: { id: restaurantId },
        });
      } catch (error) {
        console.error("Navigation error:", error);
      }
    },
    [router],
  );

  const navigateToPlaylist = useCallback(
    (playlistId: string) => {
      try {
        router.push({
          pathname: "/playlist/[id]",
          params: { id: playlistId },
        });
      } catch (error) {
        console.error("Navigation error:", error);
      }
    },
    [router],
  );

  const navigateToInsights = useCallback(() => {
    try {
      router.push("/profile/insights");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  const navigateToSearch = useCallback(() => {
    try {
      router.push("/search");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  const navigateToJoinPlaylist = useCallback(() => {
    try {
      router.push("/playlist/join");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  const navigateToInvitations = useCallback(() => {
    try {
      router.push("/playlist/invitations");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    try {
      if (activeTab === "favorites") {
        resetBannerOnRefresh();
        originalHandleRefresh();
      } else {
        handlePlaylistsRefresh?.();
      }
    } catch (error) {
      console.error("Refresh error:", error);
    }
  }, [
    activeTab,
    resetBannerOnRefresh,
    originalHandleRefresh,
    handlePlaylistsRefresh,
  ]);

  // Handle playlist creation
  const handleCreatePlaylist = useCallback(
    async (data: { name: string; description: string; emoji: string }) => {
      try {
        if (!createPlaylist) {
          console.error("createPlaylist function not available");
          return;
        }

        const newPlaylist = await createPlaylist(
          data.name,
          data.description,
          data.emoji,
        );
        if (newPlaylist) {
          setShowCreatePlaylist(false);
          navigateToPlaylist(newPlaylist.id);
        }
      } catch (error) {
        console.error("Create playlist error:", error);
        setShowCreatePlaylist(false);
      }
    },
    [createPlaylist, navigateToPlaylist],
  );

  const handleTabSwitch = useCallback((tab: "favorites" | "playlists") => {
    try {
      setActiveTab(tab);
    } catch (error) {
      console.error("Tab switch error:", error);
    }
  }, []);

  useEffect(() => {
    try {
      if (activeTab === "favorites") {
        fetchFavorites();
      }
    } catch (error) {
      console.error("Fetch favorites error:", error);
    }
  }, [activeTab, fetchFavorites]);

  // Render functions
  const renderGridRow = useCallback(
    ({ item }: any) => {
      try {
        return (
          <FavoritesGridRow
            item={item}
            onPress={navigateToRestaurant}
            onLongPress={removeFavorite}
            removingId={removingId}
            fadeAnim={fadeAnim}
            scaleAnim={scaleAnim}
          />
        );
      } catch (error) {
        console.error("Render grid row error:", error);
        return null;
      }
    },
    [navigateToRestaurant, removeFavorite, removingId, fadeAnim, scaleAnim],
  );

  const renderSectionHeader = useCallback(({ section }: any) => {
    try {
      return <SectionHeader title={section.title} />;
    } catch (error) {
      console.error("Render section header error:", error);
      return null;
    }
  }, []);

  const renderPlaylistItem = useCallback(
    ({ item }: { item: any }) => {
      try {
        if (!item || !item.id) {
          return null;
        }

        // Optimistic delete handler
        const handleDelete = (playlistId: string) => {
          removePlaylistFromState(playlistId); // Optimistically remove from UI
        };

        return (
          <PlaylistErrorBoundary
            fallback={
              <View className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg m-2">
                <Text className="text-center text-gray-500">
                  Unable to load playlist
                </Text>
              </View>
            }
          >
            <PlaylistCard
              playlist={item}
              onPress={() => navigateToPlaylist(item.id)}
              onDelete={handleDelete}
              variant="list"
            />
          </PlaylistErrorBoundary>
        );
      } catch (error) {
        console.error("Render playlist item error:", error);
        return (
          <View className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg m-2">
            <Text className="text-center text-gray-500">
              Unable to load playlist
            </Text>
          </View>
        );
      }
    },
    [navigateToPlaylist, removePlaylistFromState],
  );

  const PlaylistHeaderActions = useCallback(
    () => (
      <View className="flex-row items-center gap-2">
        {!invitationError && (
          <Pressable
            onPress={navigateToInvitations}
            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg relative"
          >
            <Mail size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
            {pendingCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-5 h-5 items-center justify-center px-1">
                <Text className="text-white text-xs font-bold">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={navigateToJoinPlaylist}
          className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"
        >
          <UserPlus
            size={20}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
        <Pressable
          onPress={() => setShowCreatePlaylist(true)}
          className="p-2 bg-primary rounded-lg"
        >
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>
    ),
    [
      navigateToInvitations,
      navigateToJoinPlaylist,
      colorScheme,
      pendingCount,
      invitationError,
    ],
  );

  const loading =
    activeTab === "favorites" ? favoritesLoading : playlistsLoading;
  const refreshing =
    activeTab === "favorites" ? favoritesRefreshing : playlistsRefreshing;

  // Loading state
  if (
    loading &&
    (activeTab === "favorites"
      ? (favorites?.length || 0) === 0
      : (playlists?.length || 0) === 0)
  ) {
    return <FavoritesScreenSkeleton />;
  }

  // Error state for playlists
  if (playlistError && activeTab === "playlists") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <FolderPlus size={64} color="#6b7280" className="mb-4" />
          <H3 className="text-center mb-2">Unable to Load Playlists</H3>
          <Muted className="text-center mb-6">
            There was an issue loading your playlists. Please try again.
          </Muted>
          <Button onPress={() => handleTabSwitch("favorites")}>
            <Text className="text-white">Go to Favorites</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <PageHeader
        title="My Collection"
        subtitle={
          activeTab === "favorites"
            ? `${favorites?.length || 0} ${(favorites?.length || 0) === 1 ? "restaurant" : "restaurants"}`
            : `${playlists?.length || 0} ${(playlists?.length || 0) === 1 ? "playlist" : "playlists"}`
        }
        actions={
          activeTab === "favorites" ? (
            <Pressable
              onPress={() => setShowOptions(!showOptions)}
              className="p-2 relative"
            >
              <Filter
                size={24}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
              {hasActiveFilters && (
                <View className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-background" />
              )}
            </Pressable>
          ) : (
            <PlaylistHeaderActions />
          )
        }
      />

      <View className="px-4">
        {/* Tabs */}
        <View className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <Pressable
            onPress={() => handleTabSwitch("favorites")}
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
                activeTab === "favorites"
                  ? "text-primary"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Favorites
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleTabSwitch("playlists")}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg relative ${
              activeTab === "playlists" ? "bg-white dark:bg-gray-700" : ""
            }`}
          >
            <FolderPlus
              size={18}
              color={activeTab === "playlists" ? "#dc2626" : "#6b7280"}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === "playlists"
                  ? "text-primary"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              Playlists
            </Text>
            {pendingCount > 0 && !invitationError && (
              <View className="absolute -top-1 -right-1 bg-primary rounded-full min-w-5 h-5 items-center justify-center px-1">
                <Text className="text-white text-xs font-bold">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Content with ScrollView for pull-to-refresh */}
      <PlaylistErrorBoundary
        fallback={
          <View className="flex-1 items-center justify-center px-8">
            <H3 className="text-center mb-2">Something went wrong</H3>
            <Muted className="text-center mb-6">
              Please try switching back to favorites and then to playlists
              again.
            </Muted>
            <Button onPress={() => handleTabSwitch("favorites")}>
              <Text className="text-white">Go to Favorites</Text>
            </Button>
          </View>
        }
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getRefreshControlColor(colorScheme)}
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {activeTab === "favorites" ? (
            // Favorites content
            (favorites?.length || 0) === 0 ? (
              <FavoritesEmptyState onDiscoverPress={navigateToSearch} />
            ) : groupBy === "none" ? (
              <View className="p-2 pb-20">
                {processedFavorites?.[0]?.data?.map((item: any, index: number) => (
                  <View key={`${item?.[0]?.id || index}-${index}`}>
                    {renderGridRow({ item })}
                  </View>
                ))}
              </View>
            ) : (
              <View className="pb-20">
                {processedFavorites?.map((section: any, sectionIndex: number) => (
                  <View key={section.title}>
                    {renderSectionHeader({ section })}
                    <View className="p-2">
                      {section.data?.map((item: any, index: number) => (
                        <View key={`${item?.[0]?.id || index}-${index}`}>
                          {renderGridRow({ item })}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : // Playlists content
          (playlists?.length || 0) === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <FolderPlus size={64} color="#6b7280" className="mb-4" />
              <H3 className="text-center mb-2">No Playlists Yet</H3>
              <Muted className="text-center mb-6">
                Create playlists to organize your favorite restaurants by theme,
                occasion, or any way you like!
              </Muted>
              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={navigateToJoinPlaylist}
                  className="flex-1"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <UserPlus
                      size={16}
                      color={colorScheme === "dark" ? "#fff" : "#000"}
                    />
                    <Text>Join Playlist</Text>
                  </View>
                </Button>
                <Button
                  onPress={() => setShowCreatePlaylist(true)}
                  className="flex-1"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Plus size={16} color="#fff" />
                    <Text className="text-white">Create Playlist</Text>
                  </View>
                </Button>
              </View>
            </View>
          ) : (
            <View className="pb-20">
              {playlists?.map((item: any) => (
                <View key={item?.id || Math.random().toString()}>
                  {renderPlaylistItem({ item })}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </PlaylistErrorBoundary>

      {/* Insights Banner */}
      {activeTab === "favorites" && (
        <FavoritesInsightsBanner
          isVisible={(favorites?.length || 0) > 5 && !insightsBannerDismissed}
          onInsightsPress={navigateToInsights}
          onDismiss={() => setInsightsBannerDismissed(true)}
        />
      )}

      {/* Filter Modal */}
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
}
