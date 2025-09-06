import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Shield, Search } from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { BlockedUserCard } from "@/components/ui/block-button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useBlockUser } from "@/hooks/useBlockUser";
import { useAuth } from "@/context/supabase-provider";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  
  const { 
    blockedUsers, 
    loading, 
    refreshing, 
    refresh 
  } = useBlockUser();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredBlockedUsers = blockedUsers.filter((blocked) =>
    blocked.blocked_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUnblockUser = useCallback(() => {
    // Refresh the list after unblocking
    refresh();
  }, [refresh]);

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text>Please sign in to manage blocked users</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="p-4 border-b border-border flex-row items-center">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
        <H2 className="ml-2">Blocked Users</H2>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {/* Info Section */}
        <View className="p-6 border-b border-border">
          <H3 className="mb-2">Privacy & Safety</H3>
          <P className="text-muted-foreground">
            When you block someone, they won't be able to see your content or 
            interact with you. You also won't see their reviews, playlists, or 
            other content throughout the app.
          </P>
        </View>

        {/* Blocked Users List */}
        <View className="p-6">
          {loading ? (
            <View className="items-center py-8">
              <Text>Loading blocked users...</Text>
            </View>
          ) : blockedUsers.length === 0 ? (
            <View className="items-center py-12">
              <Shield 
                size={48} 
                color={colorScheme === "dark" ? "#666" : "#999"} 
                className="mb-4"
              />
              <H3 className="text-center mb-2">No Blocked Users</H3>
              <P className="text-center text-muted-foreground">
                You haven't blocked anyone yet. When you block someone, 
                they'll appear here and you can manage them.
              </P>
            </View>
          ) : (
            <View className="gap-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-medium">
                  {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {filteredBlockedUsers.map((blockedUser) => (
                <BlockedUserCard
                  key={blockedUser.id}
                  userId={blockedUser.blocked_id}
                  userName={blockedUser.blocked_profile?.full_name || 'Unknown User'}
                  userAvatar={blockedUser.blocked_profile?.avatar_url}
                  blockedAt={blockedUser.blocked_at || ''}
                  reason={blockedUser.reason}
                  onUnblock={handleUnblockUser}
                />
              ))}

              {searchQuery && filteredBlockedUsers.length === 0 && (
                <View className="items-center py-8">
                  <Text className="text-muted-foreground">
                    No blocked users found matching "{searchQuery}"
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Help Section */}
        <View className="p-6 border-t border-border mt-8">
          <H3 className="mb-3">Need Help?</H3>
          <View className="gap-3">
            <Pressable 
              className="p-4 bg-muted rounded-lg"
              onPress={() => Alert.alert(
                "Reporting Users", 
                "If someone is harassing you or violating our terms, you can report them through their profile or contact our support team."
              )}
            >
              <Text className="font-medium mb-1">Report Harassment</Text>
              <Muted className="text-sm">
                Learn how to report users who are bothering you
              </Muted>
            </Pressable>
            
            <Pressable 
              className="p-4 bg-muted rounded-lg"
              onPress={() => Alert.alert(
                "Privacy Controls", 
                "In addition to blocking, you can adjust your privacy settings to control who can see your content and interact with you."
              )}
            >
              <Text className="font-medium mb-1">Privacy Settings</Text>
              <Muted className="text-sm">
                Control who can see your profile and content
              </Muted>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
