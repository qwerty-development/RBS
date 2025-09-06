// app/(protected)/playlist/[id]/collaborators.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  UserPlus,
  Search,
  Shield,
  Eye,
  Edit3,
  Trash2,
  Crown,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { usePlaylistSharing } from "@/hooks/usePlaylistSharing";
import { PlaylistCollaborator } from "@/hooks/usePlaylists";
import { OptimizedList } from "@/components/ui/optimized-list";

type CollaboratorsParams = {
  id: string;
};

interface UserSearchResult {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function PlaylistCollaboratorsScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { id: playlistId } = useLocalSearchParams<CollaboratorsParams>();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const {
    collaborators,
    pendingInvites,
    loading,
    fetchCollaborators,
    inviteCollaborator,
    removeCollaborator,
    updateCollaboratorPermission,
  } = usePlaylistSharing(playlistId);

  // Check if current user is the owner
  useEffect(() => {
    const checkOwnership = async () => {
      const { data } = await supabase
        .from("restaurant_playlists")
        .select("user_id")
        .eq("id", playlistId)
        .single();

      setIsOwner(data?.user_id === profile?.id);
    };

    checkOwnership();
  }, [playlistId, profile?.id]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  // Search for users
  const searchUsers = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .ilike("full_name", `%${query}%`)
          .neq("id", profile?.id)
          .limit(20);

        if (error) throw error;

        // Filter out blocked users on client side
        let filteredData = data || [];
        if (profile?.id) {
          const { getBlockedUserIds } = await import("@/utils/blockingUtils");
          const blockedUserIds = await getBlockedUserIds(profile.id);
          filteredData = filteredData.filter(
            user => !blockedUserIds.includes(user.id)
          );
        }

        // Filter out users who are already collaborators
        const existingUserIds = new Set([
          ...collaborators.map((c) => c.user_id),
          ...pendingInvites.map((p) => p.user_id),
        ]);

        const finalResults = filteredData.filter(
          (user) => !existingUserIds.has(user.id),
        );

        setSearchResults(finalResults);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setSearchLoading(false);
      }
    },
    [profile?.id, collaborators, pendingInvites],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSearch) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, searchUsers]);

  // Handle invite user
  const handleInviteUser = useCallback(
    async (userId: string, permission: "view" | "edit" = "view") => {
      const success = await inviteCollaborator(userId, permission);
      if (success) {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
        await fetchCollaborators();
      }
    },
    [inviteCollaborator, fetchCollaborators],
  );

  // Handle remove collaborator
  const handleRemoveCollaborator = useCallback(
    async (collaboratorId: string, userName: string) => {
      Alert.alert(
        "Remove Collaborator",
        `Are you sure you want to remove ${userName} from this playlist?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await removeCollaborator(collaboratorId);
            },
          },
        ],
      );
    },
    [removeCollaborator],
  );

  // Handle permission change
  const handlePermissionChange = useCallback(
    async (collaboratorId: string, currentPermission: "view" | "edit") => {
      const newPermission = currentPermission === "view" ? "edit" : "view";
      await updateCollaboratorPermission(collaboratorId, newPermission);
      await fetchCollaborators();
    },
    [updateCollaboratorPermission, fetchCollaborators],
  );

  // Render collaborator item
  const renderCollaboratorItem = useCallback(
    ({ item }: { item: PlaylistCollaborator }) => {
      const isPending = !item.accepted_at;

      return (
        <View className="flex-row items-center p-4 bg-white dark:bg-gray-800 mb-2 rounded-xl">
          {/* Avatar */}
          <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 mr-3 overflow-hidden">
            {item.user?.avatar_url ? (
              <Image
                source={{ uri: item.user.avatar_url }}
                className="w-full h-full"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Text className="text-lg font-semibold">
                  {item.user?.full_name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* User Info */}
          <View className="flex-1">
            <Text className="font-semibold">{item.user?.full_name}</Text>
            <View className="flex-row items-center mt-1">
              {isPending ? (
                <Muted className="text-sm">Invitation pending</Muted>
              ) : (
                <>
                  {item.permission === "edit" ? (
                    <View className="flex-row items-center">
                      <Edit3 size={14} color="#6b7280" />
                      <Muted className="text-sm ml-1">Can edit</Muted>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <Eye size={14} color="#6b7280" />
                      <Muted className="text-sm ml-1">Can view</Muted>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Actions */}
          {isOwner && (
            <View className="flex-row items-center gap-2">
              {!isPending && (
                <Pressable
                  onPress={() =>
                    handlePermissionChange(item.id, item.permission)
                  }
                  className="p-2"
                >
                  <Shield
                    size={20}
                    color={colorScheme === "dark" ? "#fff" : "#000"}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() =>
                  handleRemoveCollaborator(
                    item.id,
                    item.user?.full_name || "User",
                  )
                }
                className="p-2"
              >
                <Trash2 size={20} color="#dc2626" />
              </Pressable>
            </View>
          )}
        </View>
      );
    },
    [isOwner, colorScheme, handlePermissionChange, handleRemoveCollaborator],
  );

  // Render search result item
  const renderSearchResultItem = useCallback(
    ({ item }: { item: UserSearchResult }) => {
      return (
        <Pressable
          onPress={() => {
            Alert.alert(
              "Invite User",
              `What permission should ${item.full_name} have?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "View Only",
                  onPress: () => handleInviteUser(item.id, "view"),
                },
                {
                  text: "Can Edit",
                  onPress: () => handleInviteUser(item.id, "edit"),
                },
              ],
            );
          }}
          className="flex-row items-center p-4 bg-white dark:bg-gray-800 mb-2 rounded-xl active:bg-gray-50 dark:active:bg-gray-700"
        >
          {/* Avatar */}
          <View className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 mr-3 overflow-hidden">
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                className="w-full h-full"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Text className="text-lg font-semibold">
                  {item.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* User Info */}
          <View className="flex-1">
            <Text className="font-semibold">{item.full_name}</Text>
          </View>

          <UserPlus size={20} color="#6b7280" />
        </Pressable>
      );
    },
    [handleInviteUser],
  );

  const allCollaborators = [...collaborators, ...pendingInvites];

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft
                size={24}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>

            <H3 className="ml-2">Collaborators</H3>
          </View>

          {isOwner && (
            <Button
              size="sm"
              onPress={() => setShowSearch(!showSearch)}
              variant={showSearch ? "default" : "outline"}
            >
              <UserPlus
                size={16}
                color={
                  showSearch ? "#fff" : colorScheme === "dark" ? "#fff" : "#000"
                }
              />
              <Text className={showSearch ? "text-white ml-1" : "ml-1"}>
                Invite
              </Text>
            </Button>
          )}
        </View>
      </View>

      {/* Search Section */}
      {showSearch && isOwner && (
        <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2">
            <Search size={20} color="#6b7280" />
            <TextInput
              placeholder="Search users by name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
              placeholderTextColor="#6b7280"
              autoFocus
            />
            {searchLoading && <ActivityIndicator size="small" />}
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </View>
      ) : showSearch && searchQuery.length >= 2 ? (
        // Search Results
        <OptimizedList
          data={searchResults}
          renderItem={renderSearchResultItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-8">
              <Muted>No users found</Muted>
            </View>
          }
        />
      ) : (
        // Collaborators List
        <OptimizedList
          data={allCollaborators}
          renderItem={renderCollaboratorItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !showSearch && (
              <View className="items-center justify-center py-8">
                <UserPlus size={48} color="#6b7280" className="mb-4" />
                <H3 className="text-center mb-2">No collaborators yet</H3>
                <Muted className="text-center mb-6">
                  Invite friends to collaborate on this playlist
                </Muted>
                {isOwner && (
                  <Button onPress={() => setShowSearch(true)}>
                    <Text className="text-white">Invite People</Text>
                  </Button>
                )}
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
