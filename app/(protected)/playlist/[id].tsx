// app/(protected)/playlist/[id].tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Settings,
  Share2,
  Users,
  Globe,
  Lock,
  Plus,
  Copy,
  Edit3,
  Trash2,
  UserPlus,
} from "lucide-react-native";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";

import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { usePlaylists, Playlist, PlaylistItem } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { useDeletePlaylist } from "@/hooks/useDeletePlaylist";

import { usePlaylistSharing } from "@/hooks/usePlaylistSharing";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { Database } from "@/types/supabase";
import { PlaylistDetailsSkeleton } from "@/components/skeletons/PlaylistDetailsSkeleton";
import { cn } from "@/lib/utils";
import { CreatePlaylistModal } from "@/components/playlists/CreatePlaylistModal";
import { useShare } from "@/hooks/useShare";
import { ShareModal } from "@/components/ui/share-modal";

type PlaylistParams = {
  id: string;
};

export default function PlaylistDetailScreen() {
  const [isMounted, setIsMounted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const {
    sharePlaylist: sharePlaylistWithDeepLink,
    sharePlaylistJoin: sharePlaylistJoinWithDeepLink,
  } = useShare();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<PlaylistParams>();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [userPermission, setUserPermission] = useState<"view" | "edit" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const { updatePlaylist } = usePlaylists();
  const { deletePlaylist } = useDeletePlaylist({
    onSuccess: () => {
      router.back();
    },
  });
  const {
    items,
    loading: itemsLoading,
    refreshing,
    removeRestaurant,
    reorderItems,
    handleRefresh,
  } = usePlaylistItems(id);

  const { collaborators, togglePublicAccess, sharePlaylist, copyShareLink } =
    usePlaylistSharing(id);

  // Fetch playlist details and user permission
  const fetchPlaylistDetails = useCallback(async () => {
    try {
      // Fetch playlist details
      const { data: playlistData, error: playlistError } = await supabase
        .from("restaurant_playlists")
        .select(
          `
          *,
          owner:profiles!restaurant_playlists_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("id", id)
        .single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);

      // Check user's collaboration status if not owner
      if (playlistData.user_id !== profile?.id) {
        const { data: collaborationData, error: collaborationError } =
          await supabase
            .from("playlist_collaborators")
            .select("permission, accepted_at")
            .eq("playlist_id", id)
            .eq("user_id", profile?.id)
            .single();

        if (!collaborationError && collaborationData?.accepted_at) {
          setUserPermission(collaborationData.permission);
        } else {
          setUserPermission(null);
        }
      } else {
        setUserPermission("edit"); // Owner has edit permission
      }
    } catch (error) {
      console.error("Error fetching playlist:", error);
      Alert.alert("Error", "Failed to load playlist");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, profile?.id]);

  useEffect(() => {
    fetchPlaylistDetails();
  }, [fetchPlaylistDetails]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    },
    [router],
  );

  const handleAddRestaurants = useCallback(() => {
    router.push({
      pathname: "/playlist/add-restaurants",
      params: { playlistId: id },
    });
  }, [router, id]);

  // Playlist actions
  const handleEditPlaylist = useCallback(
    async (data: { name: string; description: string; emoji: string }) => {
      if (!playlist) return;

      const success = await updatePlaylist(playlist.id, data);
      if (success) {
        setShowEditModal(false);
        fetchPlaylistDetails();
      }
    },
    [playlist, updatePlaylist, fetchPlaylistDetails],
  );

  const handleDeletePlaylist = useCallback(async () => {
    if (!playlist) return;

    Alert.alert(
      "Delete Playlist",
      "Are you sure you want to delete this playlist? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePlaylist(playlist.id, playlist.name);
          },
        },
      ],
    );
  }, [playlist, deletePlaylist, router]);

  const handleSettingsPress = useCallback(() => {
    Alert.alert(
      "Playlist Options",
      "What would you like to do with this playlist?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Edit",
          onPress: () => setShowEditModal(true),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDeletePlaylist,
        },
      ],
    );
  }, [handleDeletePlaylist]);

  const handleTogglePublic = useCallback(async () => {
    if (!playlist) return;

    const { success, shareCode } = await togglePublicAccess(
      !playlist.is_public,
    );
    if (success) {
      fetchPlaylistDetails();
      if (!playlist.is_public && shareCode) {
        Alert.alert("Playlist is now public!", `Share code: ${shareCode}`, [
          { text: "Copy Code", onPress: () => copyShareLink(shareCode) },
          { text: "OK" },
        ]);
      }
    }
  }, [playlist, togglePublicAccess, copyShareLink, fetchPlaylistDetails]);

  const handleShare = useCallback(async () => {
    if (!playlist) return;

    if (!playlist.is_public) {
      Alert.alert(
        "Make playlist public?",
        "Your playlist needs to be public to share it with others.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Make Public",
            onPress: handleTogglePublic,
          },
        ],
      );
      return;
    }

    if (playlist.share_code) {
      await sharePlaylist(playlist.name, playlist.share_code);
    }
  }, [playlist, handleTogglePublic, sharePlaylist]);

  // Render draggable item
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PlaylistItem>) => {
      const canEdit = userPermission === "edit";

      const handleDeleteRestaurant = async (restaurantId: string) => {
        Alert.alert(
          "Remove Restaurant",
          `Are you sure you want to remove "${item.restaurant.name}" from this playlist?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: async () => {
                try {
                  await removeRestaurant(item.id);
                } catch (error) {
                  console.error(
                    "Error removing restaurant from playlist:",
                    error,
                  );
                }
              },
            },
          ],
        );
      };

      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={canEdit ? drag : undefined}
            disabled={isActive || !canEdit}
            className={`mb-3 ${isActive ? "opacity-50" : ""}`}
          >
            <RestaurantSearchCard
              restaurant={item.restaurant}
              onPress={() => handleRestaurantPress(item.restaurant.id)}
              variant="compact"
              showActions={false}
              showDeleteButton={canEdit}
              onDelete={handleDeleteRestaurant}
              isDeleting={false} // You can add state to track individual item deletion if needed
            />
            {item.note && (
              <View className="mt-1 mx-2">
                <Muted className="text-sm italic">"{item.note}"</Muted>
              </View>
            )}
          </Pressable>
        </ScaleDecorator>
      );
    },
    [handleRestaurantPress, userPermission, removeRestaurant],
  );

  // Loading state
  if (loading || !playlist) {
    return <PlaylistDetailsSkeleton />;
  }

  if (!playlist) return null;

  const isOwner = playlist.user_id === profile?.id;
  const canEdit = userPermission === "edit";
  const canView =
    userPermission === "view" || userPermission === "edit" || isOwner;

  // If user doesn't have permission to view this playlist
  if (!canView && !playlist.is_public) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-8">
          <Lock size={64} color="#6b7280" className="mb-4" />
          <H3 className="text-center mb-2">Private Playlist</H3>
          <Muted className="text-center">
            You don't have permission to view this playlist.
          </Muted>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl">{playlist.emoji}</Text>
              <H1 className="text-lg flex-1" numberOfLines={1}>
                {playlist.name}
              </H1>
            </View>
            <Muted>{items.length} restaurants</Muted>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setShowShareModal(true)}
              className="w-10 h-10 items-center justify-center rounded-full bg-muted active:bg-muted/80"
            >
              <Share2
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
            {isOwner && (
              <Pressable
                onPress={handleSettingsPress}
                className="w-10 h-10 items-center justify-center rounded-full bg-muted active:bg-muted/80"
              >
                <Settings
                  size={20}
                  color={colorScheme === "dark" ? "#fff" : "#000"}
                />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Stats Bar */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-muted/30">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            {playlist.is_public ? (
              <Globe size={16} color="#6b7280" />
            ) : (
              <Lock size={16} color="#6b7280" />
            )}
            <Text className="text-sm font-medium">
              {playlist.is_public ? "Public" : "Private"}
            </Text>
          </View>

          {!isOwner && userPermission && (
            <View className="flex-row items-center gap-1">
              {userPermission === "edit" ? (
                <Edit3 size={16} color="#10b981" />
              ) : (
                <Lock size={16} color="#6b7280" />
              )}
              <Text className="text-sm font-medium">
                {userPermission === "edit" ? "Can edit" : "View only"}
              </Text>
            </View>
          )}

          {collaborators.length > 0 && (
            <View className="flex-row items-center gap-1">
              <Users size={16} color="#6b7280" />
              <Text className="text-sm font-medium">
                +{collaborators.length}
              </Text>
            </View>
          )}
        </View>

        {playlist.share_code && (
          <Pressable
            onPress={() => copyShareLink(playlist.share_code!)}
            className="flex-row items-center gap-1"
          >
            <Copy size={16} color="#6b7280" />
            <Text className="text-sm text-muted-foreground">
              {playlist.share_code}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Actions Bar */}

      {/* Content */}
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <H3 className="text-center mb-2">No restaurants yet</H3>
          <Muted className="text-center mb-6">
            {canEdit
              ? "Start adding your favorite restaurants to this playlist"
              : "This playlist doesn't have any restaurants yet"}
          </Muted>
        </View>
      ) : (
        <DraggableFlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onDragEnd={({ data, from, to }) => {
            if (canEdit && from !== to) {
              reorderItems(from, to);
            }
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 220 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colorScheme === "dark" ? "#fff" : "#000"}
            />
          }
        />
      )}

      {/* Edit Modal */}
      <CreatePlaylistModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditPlaylist}
        editingPlaylist={playlist}
      />

      {/* Bottom Action Bar */}
      {canEdit && (
        <View className="absolute bottom-0 left-0 right-0">
          <View className="p-6 border-t border-border bg-background">
            {/* Share and Invite Row */}
            <View className="flex-row gap-3 mb-3">
              <Button
                variant="outline"
                onPress={handleShare}
                className="flex-1 border-primary rounded-lg"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Share2
                    size={16}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                  <Text className="text-foreground font-medium">Share</Text>
                </View>
              </Button>

              {isOwner && (
                <Button
                  variant="outline"
                  onPress={() => router.push(`/playlist/${id}/collaborators`)}
                  className="flex-1 border-primary rounded-lg"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <UserPlus
                      size={16}
                      color={colorScheme === "dark" ? "#fff" : "#000"}
                    />
                    <Text className="text-foreground font-medium">Invite</Text>
                  </View>
                </Button>
              )}
            </View>

            {/* Add Restaurant - Full Width */}
            <Button
              variant="default"
              onPress={handleAddRestaurants}
              className="w-full bg-primary rounded-lg"
            >
              <View className="flex-row items-center justify-center gap-2">
                <Plus
                  size={16}
                  color={colorScheme === "dark" ? "#fff" : "#fff"}
                />
                <Text className="text-primary-foreground font-medium">
                  Add Restaurant
                </Text>
              </View>
            </Button>
          </View>
        </View>
      )}

      {/* More Options Menu */}
      {isOwner && showShareOptions && (
        <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg p-4">
          <Button
            variant="outline"
            onPress={handleTogglePublic}
            className="mb-2 rounded-lg"
          >
            <Text>{playlist.is_public ? "Make Private" : "Make Public"}</Text>
          </Button>

          <Button
            variant="destructive"
            onPress={handleDeletePlaylist}
            className="rounded-lg"
          >
            <Trash2 size={18} color="#fff" className="mr-2" />
            <Text className="text-white">Delete Playlist</Text>
          </Button>
        </View>
      )}

      {/* Share Modal */}
      {playlist && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={`Share ${playlist.name}`}
          description="Share this playlist with your friends"
          shareOptions={{
            url: `https://plate-app.com/playlist/${playlist.id}`,
            title: playlist.name,
            message: `Check out my "${playlist.name}" playlist on Plate! ${playlist.emoji} ${items.length} amazing restaurants curated just for you.`,
            subject: `${playlist.name} - Plate Playlist`,
          }}
          customActions={
            playlist.share_code
              ? [
                  {
                    id: "share-join-code",
                    title: "Share Join Code",
                    description: `Let others join with code: ${playlist.share_code}`,
                    icon: UserPlus,
                    onPress: async () => {
                      await sharePlaylistJoinWithDeepLink(
                        playlist.share_code!,
                        playlist.name,
                      );
                    },
                  },
                ]
              : []
          }
        />
      )}
    </SafeAreaView>
  );
}
