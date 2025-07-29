// app/(protected)/playlist/invitations.tsx
import React, { useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Mail,
  Users,
  Check,
  X,
  FolderPlus,
  Eye,
  Edit3,
  Clock,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  usePlaylistInvitations,
  PlaylistInvitation,
} from "@/hooks/usePlaylistInvitations";
import { PlaylistInvitationSkeleton } from "@/components/skeletons/PlaylistInvitationSkeleton";
import { OptimizedList } from "@/components/ui/optimized-list";

export default function PlaylistInvitationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const {
    invitations,
    loading,
    refreshing,
    acceptInvitation,
    rejectInvitation,
    handleRefresh,
  } = usePlaylistInvitations();

  // Handle accept invitation
  const handleAcceptInvitation = useCallback(
    async (invitation: PlaylistInvitation) => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const success = await acceptInvitation(invitation.id);
      if (success) {
        Alert.alert(
          "Invitation Accepted!",
          `You now have access to "${invitation.playlist.name}"`,
          [
            {
              text: "View Playlist",
              onPress: () =>
                router.push({
                  pathname: "/playlist/[id]",
                  params: { id: invitation.playlist_id },
                }),
            },
            { text: "OK" },
          ],
        );
      }
    },
    [acceptInvitation, router],
  );

  // Handle reject invitation
  const handleRejectInvitation = useCallback(
    async (invitation: PlaylistInvitation) => {
      Alert.alert(
        "Reject Invitation",
        `Are you sure you want to reject the invitation to "${invitation.playlist.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: async () => {
              await rejectInvitation(invitation.id);
            },
          },
        ],
      );
    },
    [rejectInvitation],
  );

  // Render invitation item
  const renderInvitationItem = useCallback(
    ({ item }: { item: PlaylistInvitation }) => {
      const permissionIcon = item.permission === "edit" ? Edit3 : Eye;
      const permissionText =
        item.permission === "edit" ? "Can edit" : "Can view";
      const timeAgo = new Date(item.invited_at).toLocaleDateString();

      return (
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Text className="text-2xl mr-2">{item.playlist.emoji}</Text>
                <H3 className="flex-1" numberOfLines={1}>
                  {item.playlist.name}
                </H3>
              </View>

              {item.playlist.description && (
                <Muted className="text-sm mb-2" numberOfLines={2}>
                  {item.playlist.description}
                </Muted>
              )}

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <FolderPlus size={14} color="#6b7280" />
                  <Muted className="text-sm ml-1">
                    {item.playlist.item_count} restaurant
                    {item.playlist.item_count !== 1 ? "s" : ""}
                  </Muted>
                </View>

                <View className="flex-row items-center">
                  {React.createElement(permissionIcon, {
                    size: 14,
                    color: "#6b7280",
                  })}
                  <Muted className="text-sm ml-1">{permissionText}</Muted>
                </View>
              </View>
            </View>
          </View>

          {/* Inviter Info */}
          <View className="flex-row items-center mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <View className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 mr-3 overflow-hidden">
              {item.invited_by_user.avatar_url ? (
                <Image
                  source={{ uri: item.invited_by_user.avatar_url }}
                  className="w-full h-full"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Text className="font-semibold text-sm">
                    {item.invited_by_user.full_name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text className="font-medium text-sm">
                Invited by {item.invited_by_user.full_name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Clock size={12} color="#6b7280" />
                <Muted className="text-xs ml-1">{timeAgo}</Muted>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => handleRejectInvitation(item)}
            >
              <View className="flex-row items-center justify-center gap-2">
                <X size={16} color={colorScheme === "dark" ? "#fff" : "#000"} />
                <Text>Decline</Text>
              </View>
            </Button>

            <Button
              className="flex-1"
              onPress={() => handleAcceptInvitation(item)}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Check size={16} color="#fff" />
                <Text className="text-white">Accept</Text>
              </View>
            </Button>
          </View>
        </View>
      );
    },
    [handleAcceptInvitation, handleRejectInvitation, colorScheme],
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <PlaylistInvitationSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-gray-200 dark:border-gray-700">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>

        <View className="flex-1 ml-2">
          <H2>Playlist Invitations</H2>
          <Muted className="text-sm">
            {invitations.length} pending invitation
            {invitations.length !== 1 ? "s" : ""}
          </Muted>
        </View>
      </View>

      {/* Content */}
      {invitations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Mail size={64} color="#6b7280" className="mb-4" />
          <H3 className="text-center mb-2">No Pending Invitations</H3>
          <Muted className="text-center mb-6">
            When someone invites you to collaborate on their playlist, you'll
            see the invitation here.
          </Muted>

          <Button
            variant="outline"
            onPress={() => router.push("/playlist/join")}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Users
                size={16}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
              <Text>Join with Code Instead</Text>
            </View>
          </Button>
        </View>
      ) : (
        <OptimizedList
          data={invitations}
          renderItem={renderInvitationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
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
    </SafeAreaView>
  );
}
