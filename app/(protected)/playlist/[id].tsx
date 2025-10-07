// app/(protected)/playlist/[id].tsx
import React, { useState, useCallback, useEffect } from "react";
import { View, Pressable, Alert, RefreshControl, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Settings,
  Globe,
  Lock,
  Plus,
  Copy,
  Edit3,
  UserPlus,
  Eye,
} from "lucide-react-native";
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from "react-native-draggable-flatlist";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, Muted } from "@/components/ui/typography";

import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { usePlaylists, Playlist, PlaylistItem } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { useDeletePlaylist } from "@/hooks/useDeletePlaylist";

import { usePlaylistSharing } from "@/hooks/usePlaylistSharing";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { PlaylistDetailsSkeleton } from "@/components/skeletons/PlaylistDetailsSkeleton";
import { CreatePlaylistModal } from "@/components/playlists/CreatePlaylistModal";
// TEMP DISABLED: Share functionality requires deeplink
// import { useShare } from "@/hooks/useShare";
// import { ShareModal } from "@/components/ui/share-modal";

type PlaylistParams = {
  id: string;
};

export default function PlaylistDetailScreen() {
  // TEMP DISABLED: Share functionality requires deeplink
  // const [showShareModal, setShowShareModal] = useState(false);

  // TEMP DISABLED: Share functionality requires deeplink
  // const { sharePlaylistJoin: sharePlaylistJoinWithDeepLink } = useShare();

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

  const { updatePlaylist } = usePlaylists();
  const { deletePlaylist } = useDeletePlaylist({
    onSuccess: () => {
      router.back();
    },
  });
  const { items, refreshing, removeRestaurant, reorderItems, handleRefresh } =
    usePlaylistItems(id);

  const {
    collaborators,
    togglePublicAccess,
    sharePlaylist,
    copyShareLink,
    leavePlaylist,
  } = usePlaylistSharing(id);

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
        // TEMP DISABLED: Share functionality requires deeplink
        // {
        //   text: "Share",
        //   onPress: () => setShowShareModal(true),
        // },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDeletePlaylist,
        },
      ],
    );
  }, [handleDeletePlaylist]);

  const handleLeavePlaylist = useCallback(async () => {
    if (!playlist) return;

    Alert.alert(
      "Leave Playlist",
      `Are you sure you want to leave "${playlist.name}"? You'll lose access to this playlist unless you're invited again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            const success = await leavePlaylist(playlist.name);
            if (success) {
              router.back();
            }
          },
        },
      ],
    );
  }, [playlist, leavePlaylist, router]);

  const handleCollaboratorOptionsPress = useCallback(() => {
    Alert.alert("Playlist Options", "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave Playlist",
        style: "destructive",
        onPress: handleLeavePlaylist,
      },
    ]);
  }, [handleLeavePlaylist]);

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

  // Render draggable item
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PlaylistItem>) => {
      const canEdit = userPermission === "edit";

      const handleDeleteRestaurant = async () => {
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
            <View className="bg-card rounded-xl overflow-hidden border border-border">
              <RestaurantSearchCard
                restaurant={item.restaurant}
                onPress={() => handleRestaurantPress(item.restaurant.id)}
                variant="compact"
                showActions={false}
                showDeleteButton={canEdit}
                onDelete={handleDeleteRestaurant}
                isDeleting={false}
              />
              {(item.note || item.added_by_user) && (
                <View className="px-3 pb-3 pt-1 bg-muted/20">
                  {item.note && (
                    <View className="mb-1">
                      <Muted className="text-sm italic">"{item.note}"</Muted>
                    </View>
                  )}
                  {item.added_by_user && (
                    <View className="flex-row items-center gap-1">
                      <UserPlus size={12} color="#6b7280" />
                      <Muted className="text-xs">
                        Added by {item.added_by_user.full_name}
                      </Muted>
                    </View>
                  )}
                </View>
              )}
            </View>
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
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable
            onPress={handleBack}
            className="w-10 h-10 items-center justify-center rounded-full bg-muted active:bg-muted/80"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          {isOwner ? (
            <Pressable
              onPress={handleSettingsPress}
              className="w-10 h-10 items-center justify-center rounded-full bg-muted active:bg-muted/80"
            >
              <Settings
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
          ) : userPermission ? (
            <Pressable
              onPress={handleCollaboratorOptionsPress}
              className="w-10 h-10 items-center justify-center rounded-full bg-muted active:bg-muted/80"
            >
              <Settings
                size={20}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Playlist Title and Description */}
        <View className="mb-3">
          <View className="flex-row items-center gap-3 mb-2">
            <Text className="text-4xl">{playlist.emoji}</Text>
            <View className="flex-1">
              <H1 className="text-2xl font-bold" numberOfLines={2}>
                {playlist.name}
              </H1>
              {playlist.description && (
                <Text
                  className="text-sm text-muted-foreground mt-1"
                  numberOfLines={2}
                >
                  {playlist.description}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Compact Info Bar */}
      <View className="mx-4 mt-3 mb-3">
        {/* Stats Row with Toggle */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Text className="text-lg font-bold text-foreground">
                {items.length}
              </Text>
              <Muted className="text-xs">places</Muted>
            </View>
            <Text className="text-muted-foreground">•</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-lg font-bold text-foreground">
                {collaborators.length}
              </Text>
              <Muted className="text-xs">people</Muted>
            </View>
            {playlist.view_count > 0 && (
              <>
                <Text className="text-muted-foreground">•</Text>
                <View className="flex-row items-center gap-1">
                  <Eye size={14} color="#6b7280" />
                  <Text className="text-sm text-muted-foreground">
                    {playlist.view_count}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Public/Private Toggle - Only for Owner */}
          {isOwner && (
            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-1">
                {playlist.is_public ? (
                  <Globe
                    size={16}
                    color={colorScheme === "dark" ? "#10b981" : "#059669"}
                  />
                ) : (
                  <Lock size={16} color="#6b7280" />
                )}
                <Text className="text-xs font-medium text-muted-foreground">
                  {playlist.is_public ? "Public" : "Private"}
                </Text>
              </View>
              <Switch
                value={playlist.is_public}
                onValueChange={handleTogglePublic}
                trackColor={{
                  false: colorScheme === "dark" ? "#374151" : "#d1d5db",
                  true: colorScheme === "dark" ? "#10b981" : "#059669",
                }}
                thumbColor={playlist.is_public ? "#fff" : "#f4f4f5"}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          )}
        </View>

        {/* Share Code & Permission Badge in one line */}
        <View className="flex-row items-center justify-between">
          {playlist.share_code ? (
            <Pressable
              onPress={() => copyShareLink(playlist.share_code!)}
              className="flex-row items-center gap-2 py-1.5 px-3 bg-muted/30 rounded-lg active:bg-muted/50"
            >
              <Copy size={14} color="#6b7280" />
              <Text className="font-mono font-semibold text-sm text-foreground">
                {playlist.share_code}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          {!isOwner && userPermission && (
            <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-muted/30 rounded-lg">
              {userPermission === "edit" ? (
                <Edit3 size={14} color="#10b981" />
              ) : (
                <Eye size={14} color="#6b7280" />
              )}
              <Text className="font-medium text-xs text-muted-foreground">
                {userPermission === "edit" ? "Can edit" : "View only"}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions Bar */}

      {/* Content */}
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 items-center justify-center rounded-full bg-muted/50 mb-4">
            <Plus size={40} color="#6b7280" />
          </View>
          <H2 className="text-center mb-2">No restaurants yet</H2>
          <Muted className="text-center text-base mb-6">
            {canEdit
              ? "Start building your collection by adding restaurants you love"
              : "This playlist doesn't have any restaurants yet"}
          </Muted>
          {canEdit && (
            <Button
              variant="default"
              onPress={handleAddRestaurants}
              className="bg-primary rounded-xl px-6"
            >
              <View className="flex-row items-center gap-2">
                <Plus size={18} color="#fff" />
                <Text className="text-primary-foreground font-semibold">
                  Add Your First Restaurant
                </Text>
              </View>
            </Button>
          )}
        </View>
      ) : (
        <DraggableFlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onDragEnd={({ from, to }) => {
            if (canEdit && from !== to) {
              reorderItems(from, to);
            }
          }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: canEdit ? 100 : 20,
          }}
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
          <View className="p-4 border-t border-border bg-background">
            <View className="flex-row gap-3">
              {/* Add Restaurant Button */}
              <Button
                variant="default"
                onPress={handleAddRestaurants}
                className="flex-1 bg-primary rounded-xl py-3"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <Plus size={20} color="#fff" />
                  <Text className="text-primary-foreground font-semibold text-base">
                    Add Restaurants
                  </Text>
                </View>
              </Button>

              {/* Invite Collaborators - Only for Owner */}
              {isOwner && (
                <Button
                  variant="outline"
                  onPress={() => router.push(`/playlist/${id}/collaborators`)}
                  className="border-primary rounded-xl py-3 px-4"
                >
                  <UserPlus
                    size={20}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Button>
              )}
            </View>
          </View>
        </View>
      )}

      {/* TEMP DISABLED: Share Modal requires deeplink functionality */}
      {/* {playlist && (
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
      )} */}
    </SafeAreaView>
  );
}
