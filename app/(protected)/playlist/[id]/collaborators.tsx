// app/(protected)/playlist/[id]/collaborators.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Image as RNImage,
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
            (user) => !blockedUserIds.includes(user.id),
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
      // No need to fetchCollaborators() as the state is updated locally in updateCollaboratorPermission
    },
    [updateCollaboratorPermission],
  );

  // Render collaborator item
  const renderCollaboratorItem = useCallback(
    ({ item, index }: { item: PlaylistCollaborator; index: number }) => {
      const isPending = !item.accepted_at;
      const positionInRow = index % 3;

      return (
        <View
          style={{
            width: "31%",
            marginBottom: 8,
            marginRight: positionInRow === 2 ? 0 : "3.5%",
          }}
        >
          <View className="bg-card rounded-xl p-3 shadow-sm border border-border">
            {/* Avatar */}
            <View className="w-full items-center mb-2">
              <View className="w-16 h-16 rounded-full bg-muted overflow-hidden">
                {item.user?.avatar_url ? (
                  <RNImage
                    source={{ uri: item.user.avatar_url }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Text className="text-lg font-semibold">
                      {item.user?.full_name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* User Info */}
            <View className="items-center mb-2">
              <Text
                className="font-semibold text-center text-sm"
                numberOfLines={1}
              >
                {item.user?.full_name}
              </Text>
              <View className="flex-row items-center justify-center mt-1">
                {isPending ? (
                  <Muted className="text-xs">Pending</Muted>
                ) : (
                  <>
                    {item.permission === "edit" ? (
                      <View className="flex-row items-center">
                        <Edit3 size={10} color="#6b7280" />
                        <Muted className="text-xs ml-1">Can edit</Muted>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Eye size={10} color="#6b7280" />
                        <Muted className="text-xs ml-1">View only</Muted>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Actions */}
            {isOwner && (
              <View className="flex-row items-center justify-center gap-2 pt-2 border-t border-border">
                {!isPending && (
                  <Pressable
                    onPress={() =>
                      handlePermissionChange(item.id, item.permission)
                    }
                    className="flex-1 items-center justify-center py-1.5 rounded-lg bg-muted active:bg-muted/80"
                  >
                    <Shield
                      size={16}
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
                  className="flex-1 items-center justify-center py-1.5 rounded-lg bg-destructive/10 active:bg-destructive/20"
                >
                  <Trash2 size={16} color="#dc2626" />
                </Pressable>
              </View>
            )}
          </View>
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
          className="flex-row items-center p-4 bg-card mb-2 rounded-xl active:bg-muted"
        >
          {/* Avatar */}
          <View className="w-12 h-12 rounded-full bg-muted mr-3 overflow-hidden">
            {item.avatar_url ? (
              <RNImage
                source={{ uri: item.avatar_url }}
                style={{ width: "100%", height: "100%" }}
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
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-background px-4 py-3 border-b border-border">
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
              size="icon"
              onPress={() => setShowSearch(!showSearch)}
              variant={showSearch ? "default" : "outline"}
              className="w-8 h-8"
            >
              <UserPlus
                size={18}
                color={
                  showSearch ? "#fff" : colorScheme === "dark" ? "#fff" : "#000"
                }
              />
            </Button>
          )}
        </View>
      </View>

      {/* Search Section */}
      {showSearch && isOwner && (
        <View className="bg-background px-4 py-3 border-b border-border">
          <View className="flex-row items-center bg-muted rounded-xl px-4 py-2">
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
        <FlatList
          key="search-results-list"
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
        <FlatList
          key="collaborators-grid"
          data={allCollaborators}
          renderItem={renderCollaboratorItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: "2%", paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          numColumns={3}
          ListEmptyComponent={
            !showSearch ? (
              <View className="items-center  justify-center py-8">
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
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
