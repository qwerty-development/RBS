// components/playlists/AddToPlaylistModal.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import {
  X,
  Search,
  Plus,
  Check,
  FolderPlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { usePlaylists, Playlist } from "@/hooks/usePlaylists";
import { CreatePlaylistModal } from "./CreatePlaylistModal";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface AddToPlaylistModalProps {
  visible: boolean;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onSuccess?: (playlistName: string) => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  restaurantId,
  restaurantName,
  onClose,
  onSuccess,
}) => {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { playlists, createPlaylist, handleRefresh } = usePlaylists();
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [addingToPlaylists, setAddingToPlaylists] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistStates, setPlaylistStates] = useState<Map<string, boolean>>(new Map());

  // Filter playlists based on search
  const filteredPlaylists = playlists.filter(
    playlist => playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check which playlists already contain this restaurant
  useEffect(() => {
    if (!visible || playlists.length === 0) return;

    const checkPlaylistStates = async () => {
      const states = new Map<string, boolean>();
      
      for (const playlist of playlists) {
        try {
          const { data } = await supabase
            .from('playlist_items')
            .select('id')
            .eq('playlist_id', playlist.id)
            .eq('restaurant_id', restaurantId)
            .single();
          
          states.set(playlist.id, !!data);
        } catch (error) {
          states.set(playlist.id, false);
        }
      }
      
      setPlaylistStates(states);
    };

    checkPlaylistStates();
  }, [visible, playlists, restaurantId]);

  // Toggle playlist selection
  const togglePlaylistSelection = useCallback((playlistId: string) => {
    if (playlistStates.get(playlistId)) return; // Already in playlist
    
    setSelectedPlaylists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId);
      } else {
        newSet.add(playlistId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [playlistStates]);

  // Helper function to add restaurant to a single playlist
  const addRestaurantToPlaylist = async (playlistId: string, restaurantId: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      // Get current max position
      const { data: maxPosData } = await supabase
        .from('playlist_items')
        .select('position')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (maxPosData?.position ?? -1) + 1;

      const { error } = await supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          restaurant_id: restaurantId,
          added_by: profile.id,
          position: nextPosition,
          note: null
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log('Restaurant already in playlist');
          return false;
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error adding restaurant to playlist:', error);
      return false;
    }
  };

  // Add to selected playlists
  const handleAddToPlaylists = useCallback(async () => {
    if (selectedPlaylists.size === 0) return;

    setAddingToPlaylists(true);
    let successCount = 0;
    let addedPlaylistName = "";

    try {
      for (const playlistId of selectedPlaylists) {
        const success = await addRestaurantToPlaylist(playlistId, restaurantId);
        if (success) {
          successCount++;
          const playlist = playlists.find(p => p.id === playlistId);
          if (playlist && !addedPlaylistName) {
            addedPlaylistName = playlist.name;
          }
        }
      }

      if (successCount > 0) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onSuccess) {
          onSuccess(successCount > 1 ? `${successCount} playlists` : addedPlaylistName);
        }
        onClose();
      }
    } catch (error) {
      console.error('Error adding to playlists:', error);
    } finally {
      setAddingToPlaylists(false);
    }
  }, [selectedPlaylists, restaurantId, playlists, onSuccess, onClose, profile?.id]);

  // Handle create new playlist
  const handleCreateNewPlaylist = useCallback(async (data: {
    name: string;
    description: string;
    emoji: string;
  }) => {
    const newPlaylist = await createPlaylist(data.name, data.description, data.emoji);
    if (newPlaylist) {
      setShowCreatePlaylist(false);
      // Automatically select the new playlist
      setSelectedPlaylists(new Set([newPlaylist.id]));
      await handleRefresh();
    }
  }, [createPlaylist, handleRefresh]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedPlaylists(new Set());
      setSearchQuery("");
    }
  }, [visible]);

  // Render playlist item
  const renderPlaylistItem = useCallback(({ item }: { item: Playlist }) => {
    const isSelected = selectedPlaylists.has(item.id);
    const isAlreadyAdded = playlistStates.get(item.id) || false;

    return (
      <Pressable
        onPress={() => togglePlaylistSelection(item.id)}
        disabled={isAlreadyAdded}
        className={`
          flex-row items-center p-4 mb-2 rounded-xl
          ${isAlreadyAdded
            ? "bg-gray-100 dark:bg-gray-800 opacity-50"
            : isSelected
            ? "bg-primary/10 border-2 border-primary"
            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          }
        `}
      >
        <Text className="text-2xl mr-3">{item.emoji}</Text>
        
        <View className="flex-1">
          <Text className="font-semibold text-base">{item.name}</Text>
          {item.description && (
            <Muted className="text-sm mt-0.5" numberOfLines={1}>
              {item.description}
            </Muted>
          )}
          <Muted className="text-xs mt-1">
            {item.item_count || 0} restaurants
          </Muted>
        </View>

        <View className="ml-3">
          {isAlreadyAdded ? (
            <View className="bg-gray-500 rounded-full p-1">
              <Check size={16} color="#fff" />
            </View>
          ) : isSelected ? (
            <View className="bg-primary rounded-full p-1">
              <Check size={16} color="#fff" />
            </View>
          ) : (
            <View className="bg-gray-200 dark:bg-gray-700 rounded-full p-1">
              <Plus size={16} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [selectedPlaylists, playlistStates, togglePlaylistSelection, colorScheme]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <View className="bg-white dark:bg-gray-800 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <View className="flex-row items-center justify-between">
                <H3>Add to Playlist</H3>
                <Pressable
                  onPress={onClose}
                  className="p-2"
                  disabled={addingToPlaylists}
                >
                  <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
                </Pressable>
              </View>
              <Muted className="text-sm mt-1" numberOfLines={1}>
                {restaurantName}
              </Muted>
            </View>

            {/* Search Bar */}
            {playlists.length > 5 && (
              <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2">
                  <Search size={20} color="#6b7280" />
                  <TextInput
                    placeholder="Search playlists..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
                    placeholderTextColor="#6b7280"
                  />
                </View>
              </View>
            )}

            {/* Create New Playlist Button */}
            <Pressable
              onPress={() => setShowCreatePlaylist(true)}
              className="bg-white dark:bg-gray-800 mx-4 mt-4 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex-row items-center justify-center"
            >
              <FolderPlus size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-600 dark:text-gray-400 font-medium">
                Create New Playlist
              </Text>
            </Pressable>

            {/* Playlists List */}
            <FlatList
              data={filteredPlaylists}
              renderItem={renderPlaylistItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <Muted>No playlists found</Muted>
                </View>
              }
            />

            {/* Footer Actions */}
            {selectedPlaylists.size > 0 && (
              <View className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onPress={handleAddToPlaylists}
                  disabled={addingToPlaylists}
                  className="w-full"
                >
                  {addingToPlaylists ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white">
                      Add to {selectedPlaylists.size} Playlist{selectedPlaylists.size > 1 ? 's' : ''}
                    </Text>
                  )}
                </Button>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        visible={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
        onSubmit={handleCreateNewPlaylist}
      />
    </>
  );
};