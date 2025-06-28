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
import { H2, H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { usePlaylists, Playlist } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { PlaylistItem } from "@/hooks/usePlaylists"

import { usePlaylistSharing } from "@/hooks/usePlaylistSharing";
import { CreatePlaylistModal } from "@/components/playlists/CreatePlaylistModal";

type PlaylistParams = {
  id: string;
};

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<PlaylistParams>();
  
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  
  const { updatePlaylist, deletePlaylist } = usePlaylists();
  const {
    items,
    loading: itemsLoading,
    refreshing,
    removeRestaurant,
    reorderItems,
    handleRefresh,
  } = usePlaylistItems(id);
  
  const {
    collaborators,
    togglePublicAccess,
    sharePlaylist,
    copyShareLink,
  } = usePlaylistSharing(id);

  // Fetch playlist details
  const fetchPlaylistDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_playlists')
        .select(`
          *,
          owner:profiles!restaurant_playlists_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setPlaylist(data);
    } catch (error) {
      console.error('Error fetching playlist:', error);
      Alert.alert('Error', 'Failed to load playlist');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchPlaylistDetails();
  }, [fetchPlaylistDetails]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRestaurantPress = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurantId },
    });
  }, [router]);

  const handleAddRestaurants = useCallback(() => {
    router.push({
      pathname: "/playlist/add-restaurants",
      params: { playlistId: id },
    });
  }, [router, id]);

  // Playlist actions
  const handleEditPlaylist = useCallback(async (data: {
    name: string;
    description: string;
    emoji: string;
  }) => {
    if (!playlist) return;

    const success = await updatePlaylist(playlist.id, data);
    if (success) {
      setShowEditModal(false);
      fetchPlaylistDetails();
    }
  }, [playlist, updatePlaylist, fetchPlaylistDetails]);

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
            const success = await deletePlaylist(playlist.id);
            if (success) {
              router.back();
            }
          },
        },
      ]
    );
  }, [playlist, deletePlaylist, router]);

  const handleTogglePublic = useCallback(async () => {
    if (!playlist) return;

    const { success, shareCode } = await togglePublicAccess(!playlist.is_public);
    if (success) {
      fetchPlaylistDetails();
      if (!playlist.is_public && shareCode) {
        Alert.alert(
          "Playlist is now public!",
          `Share code: ${shareCode}`,
          [
            { text: "Copy Code", onPress: () => copyShareLink(shareCode) },
            { text: "OK" },
          ]
        );
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
        ]
      );
      return;
    }

    if (playlist.share_code) {
      await sharePlaylist(playlist.name, playlist.share_code);
    }
  }, [playlist, handleTogglePublic, sharePlaylist]);

  // Render draggable item
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<PlaylistItem>) => {
    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          className={`mb-3 ${isActive ? "opacity-50" : ""}`}
        >
          <RestaurantSearchCard
            restaurant={item.restaurant}
            onPress={() => handleRestaurantPress(item.restaurant.id)}
            variant="compact"
            showActions={false}
          />
          {item.note && (
            <View className="mt-1 mx-2">
              <Muted className="text-sm italic">"{item.note}"</Muted>
            </View>
          )}
        </Pressable>
      </ScaleDecorator>
    );
  }, [handleRestaurantPress]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  if (!playlist) return null;

  const isOwner = playlist.user_id === profile?.id;
  const canEdit = isOwner || collaborators.some(
    c => c.user_id === profile?.id && c.permission === 'edit'
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center">
          <Pressable onPress={handleBack} className="p-2 -ml-2">
            <ArrowLeft size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
          
          <Text className="text-3xl mx-3">{playlist.emoji}</Text>
          
          <View className="flex-1">
            <H3 numberOfLines={1}>{playlist.name}</H3>
            {playlist.description && (
              <Muted className="text-sm" numberOfLines={1}>
                {playlist.description}
              </Muted>
            )}
          </View>

          {isOwner && (
            <Pressable onPress={() => setShowEditModal(true)} className="p-2">
              <Settings size={22} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
          )}
        </View>

        {/* Stats */}
        <View className="flex-row items-center mt-3 gap-4">
          <View className="flex-row items-center">
            {playlist.is_public ? (
              <Globe size={14} color="#6b7280" className="mr-1" />
            ) : (
              <Lock size={14} color="#6b7280" className="mr-1" />
            )}
            <Muted className="text-sm">
              {playlist.is_public ? "Public" : "Private"}
            </Muted>
          </View>
          
          {playlist.share_code && (
            <Pressable
              onPress={() => copyShareLink(playlist.share_code!)}
              className="flex-row items-center"
            >
              <Copy size={14} color="#6b7280" className="mr-1" />
              <Muted className="text-sm">{playlist.share_code}</Muted>
            </Pressable>
          )}
          
          {collaborators.length > 0 && (
            <View className="flex-row items-center">
              <Users size={14} color="#6b7280" className="mr-1" />
              <Muted className="text-sm">+{collaborators.length}</Muted>
            </View>
          )}
        </View>
      </View>

      {/* Actions Bar */}
      {canEdit && (
        <View className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex-row gap-2">
          <Button
            size="sm"
            onPress={handleAddRestaurants}
            className="flex-row items-center"
          >
            <Plus size={16} color="#fff" className="mr-1" />
            <Text className="text-white text-sm">Add Restaurants</Text>
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onPress={handleShare}
            className="flex-row items-center"
          >
            <Share2 size={16} color={colorScheme === "dark" ? "#fff" : "#000"} />
            <Text className="text-sm ml-1">Share</Text>
          </Button>
          
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push(`/playlist/${id}/collaborators`)}
              className="flex-row items-center"
            >
              <UserPlus size={16} color={colorScheme === "dark" ? "#fff" : "#000"} />
              <Text className="text-sm ml-1">Invite</Text>
            </Button>
          )}
        </View>
      )}

      {/* Content */}
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <H3 className="text-center mb-2">No restaurants yet</H3>
          <Muted className="text-center mb-6">
            Start adding your favorite restaurants to this playlist
          </Muted>
          {canEdit && (
            <Button onPress={handleAddRestaurants}>
              <Text className="text-white">Add Restaurants</Text>
            </Button>
          )}
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
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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

      {/* More Options Menu */}
      {isOwner && showShareOptions && (
        <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg p-4">
          <Button
            variant="outline"
            onPress={handleTogglePublic}
            className="mb-2"
          >
            <Text>
              {playlist.is_public ? "Make Private" : "Make Public"}
            </Text>
          </Button>
          
          <Button
            variant="destructive"
            onPress={handleDeletePlaylist}
          >
            <Trash2 size={18} color="#fff" className="mr-2" />
            <Text className="text-white">Delete Playlist</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
};