// app/(protected)/friends/index.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  UserPlus,
  Search,
  Users,
  User,
  Check,
  X,
  Clock,
  MessageCircle,
  UserCheck,
  ArrowLeft,
  Settings,
  Heart,
  Utensils,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { FriendListSkeleton } from "@/components/skeletons/FriendListSkeleton";

// Type definitions
interface Friend {
  id: string;
  full_name: string;
  avatar_url: string | null;
  friendship_date: string;
  commonRestaurants?: number;
  lastBookingTogether?: string;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  message?: string;
  created_at: string;
  from_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  to_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface SearchResult {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_friend: boolean;
  hasPendingRequest?: boolean;
}

interface FriendSuggestion {
  id: string;
  full_name: string;
  avatar_url: string | null;
  mutual_friends_count: number;
  common_restaurants: number;
}

type TabType = "friends" | "requests" | "discover";

export default function FriendsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  // State management
  const [activeTab, setActiveTab] = useState<TabType>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      switch (activeTab) {
        case "friends":
          await loadFriends();
          break;
        case "requests":
          await loadFriendRequests();
          break;
        case "discover":
          await loadSuggestions();
          break;
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    const { data, error } = await supabase
      .from("friends")
      .select(
        `
        *,
        friend:friend_id(id, full_name, avatar_url)
      `
      )
      .eq("user_id", profile?.id)
      .order("friendship_date", { ascending: false });

    if (!error && data) {
      const formattedFriends = data.map((item) => ({
        id: item.friend.id,
        full_name: item.friend.full_name,
        avatar_url: item.friend.avatar_url,
        friendship_date: item.friendship_date,
      }));
      setFriends(formattedFriends);
    }
  };

  const loadFriendRequests = async () => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        `
        *,
        from_user:from_user_id(id, full_name, avatar_url),
        to_user:to_user_id(id, full_name, avatar_url)
      `
      )
      .or(`to_user_id.eq.${profile?.id},from_user_id.eq.${profile?.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setFriendRequests(data);
    }
  };

  const loadSuggestions = async () => {
    const { data, error } = await supabase.rpc("get_friend_suggestions");

    if (!error && data) {
      setSuggestions(data);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase.rpc("search_users", {
        search_query: query,
      });

      if (!error && data) {
        // Check for pending requests
        const enrichedResults = await Promise.all(
          data.map(async (user: any) => {
            const { data: requestData } = await supabase
              .from("friend_requests")
              .select("id")
              .or(
                `and(from_user_id.eq.${profile?.id},to_user_id.eq.${user.id}),and(from_user_id.eq.${user.id},to_user_id.eq.${profile?.id})`
              )
              .eq("status", "pending")
              .single();

            return {
              ...user,
              hasPendingRequest: !!requestData,
            };
          })
        );

        setSearchResults(enrichedResults);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (userId: string, message?: string) => {
    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      const { error } = await supabase.from("friend_requests").insert({
        from_user_id: profile?.id,
        to_user_id: userId,
        message,
      });

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Friend request sent!");

      // Refresh search results
      if (searchQuery) {
        await handleSearch(searchQuery);
      }

      // Refresh suggestions
      if (activeTab === "discover") {
        await loadSuggestions();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send friend request");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleFriendRequest = async (
    requestId: string,
    action: "accept" | "reject"
  ) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({
          status: action === "accept" ? "accepted" : "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Refresh requests
      await loadFriendRequests();

      if (action === "accept") {
        Alert.alert("Success", "Friend request accepted!");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to process friend request");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const removeFriend = async (friendId: string) => {
    Alert.alert(
      "Remove Friend",
      "Are you sure you want to remove this friend?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("friends")
                .delete()
                .or(
                  `and(user_id.eq.${profile?.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile?.id})`
                );

              if (error) throw error;

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              await loadFriends();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove friend");
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Render functions
  const renderFriend = ({ item }: { item: Friend }) => (
    <Pressable
      onPress={() => router.push(`/(protected)/friends/${item.id}` as any)}
      className="flex-row items-center justify-between p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center flex-1">
        <Image
          source={{
            uri:
              item.avatar_url ||
              `https://ui-avatars.com/api/?name=${item.full_name}`,
          }}
          className="w-14 h-14 rounded-full bg-gray-100"
        />
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-base">{item.full_name}</Text>
          <Muted className="text-sm">
            Friends since {new Date(item.friendship_date).toLocaleDateString()}
          </Muted>
        </View>
      </View>

      <ChevronRight
        size={20}
        color={colorScheme === "dark" ? "#9ca3af" : "#6b7280"}
      />
    </Pressable>
  );

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => {
    const isReceived = item.to_user_id === profile?.id;
    const otherUser = isReceived ? item.from_user : item.to_user;

    return (
      <View
        className="p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Image
              source={{
                uri:
                  otherUser?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${otherUser?.full_name}`,
              }}
              className="w-14 h-14 rounded-full bg-gray-100"
            />
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-base">
                {otherUser?.full_name}
              </Text>
              <Muted className="text-sm">
                {isReceived ? "Sent you a friend request" : "Request sent"}
              </Muted>
              {item.message && (
                <Text className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                  "{item.message}"
                </Text>
              )}
            </View>
          </View>
        </View>

        {isReceived && (
          <View className="flex-row mt-3 gap-2">
            <Button
              variant="default"
              size="sm"
              onPress={() => handleFriendRequest(item.id, "accept")}
              disabled={processingIds.has(item.id)}
              className="flex-1"
            >
              {processingIds.has(item.id) ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <Check size={16} color="white" />
                  <Text className="text-white">Accept</Text>
                </View>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onPress={() => handleFriendRequest(item.id, "reject")}
              disabled={processingIds.has(item.id)}
              className="flex-1"
            >
              <View className="flex-row items-center justify-center gap-2">
                <X
                  size={16}
                  color={colorScheme === "dark" ? "white" : "black"}
                />
                <Text>Decline</Text>
              </View>
            </Button>
          </View>
        )}
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <View
      className="flex-row items-center justify-between p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center flex-1">
        <Image
          source={{
            uri:
              item.avatar_url ||
              `https://ui-avatars.com/api/?name=${item.full_name}`,
          }}
          className="w-14 h-14 rounded-full bg-gray-100"
        />
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-base">{item.full_name}</Text>
          {item.is_friend && (
            <View className="flex-row items-center mt-1">
              <UserCheck size={14} color="#10b981" />
              <Muted className="text-sm ml-1">Already friends</Muted>
            </View>
          )}
        </View>
      </View>

      {!item.is_friend && !item.hasPendingRequest && (
        <Button
          size="sm"
          onPress={() => sendFriendRequest(item.id)}
          disabled={processingIds.has(item.id)}
        >
          {processingIds.has(item.id) ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View className="flex-row items-center justify-center gap-2">
              <UserPlus size={16} color="white" />
              <Text className="text-white">Add</Text>
            </View>
          )}
        </Button>
      )}

      {item.hasPendingRequest && (
        <View className="flex-row items-center">
          <Clock size={16} color="#f59e0b" />
          <Muted className="ml-1">Pending</Muted>
        </View>
      )}
    </View>
  );

  const renderSuggestion = ({ item }: { item: FriendSuggestion }) => (
    <View
      className="p-4 mb-2 bg-white dark:bg-gray-800 rounded-2xl"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Image
            source={{
              uri:
                item.avatar_url ||
                `https://ui-avatars.com/api/?name=${item.full_name}`,
            }}
            className="w-14 h-14 rounded-full bg-gray-100"
          />
          <View className="ml-3 flex-1">
            <Text className="font-semibold text-base">{item.full_name}</Text>
            <View className="flex-row items-center mt-1 gap-3">
              {item.mutual_friends_count > 0 && (
                <View className="flex-row items-center">
                  <Users size={12} color="#6b7280" />
                  <Muted className="text-xs ml-1">
                    {item.mutual_friends_count} mutual
                  </Muted>
                </View>
              )}
              <View className="flex-row items-center">
                <Utensils size={12} color="#6b7280" />
                <Muted className="text-xs ml-1">
                  {item.common_restaurants} common spots
                </Muted>
              </View>
            </View>
          </View>
        </View>

        <Button
          size="sm"
          onPress={() => sendFriendRequest(item.id)}
          disabled={processingIds.has(item.id)}
        >
          {processingIds.has(item.id) ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View className="flex-row items-center justify-center gap-2">
              <UserPlus size={16} color="white" />
              <Text className="text-white">Add</Text>
            </View>
          )}
        </Button>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2">
            <ArrowLeft
              size={24}
              color={colorScheme === "dark" ? "white" : "black"}
            />
          </Pressable>

          <H2>Friends</H2>

          <View className="p-2">{/* Settings placeholder */}</View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "friends", label: "My Friends", icon: Users },
          { id: "requests", label: "Requests", icon: UserPlus },
          { id: "discover", label: "Discover", icon: Search },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              activeTab === tab.id ? "bg-gray-100 dark:bg-gray-700" : ""
            }`}
          >
            <tab.icon
              size={18}
              color={
                activeTab === tab.id
                  ? "#dc2626"
                  : colorScheme === "dark"
                    ? "#9ca3af"
                    : "#6b7280"
              }
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === tab.id
                  ? "text-red-600"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {tab.label}
            </Text>
            {tab.id === "requests" && friendRequests.length > 0 && (
              <View className="ml-2 bg-red-600 rounded-full px-2 py-0.5">
                <Text className="text-white text-xs font-semibold">
                  {friendRequests.length}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* Search Bar (for friends and discover tabs) */}
      {(activeTab === "friends" || activeTab === "discover") && (
        <View className="px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2">
            <Search size={20} color="#6b7280" />
            <TextInput
              placeholder={
                activeTab === "friends"
                  ? "Search friends..."
                  : "Search users..."
              }
              value={searchQuery}
              onChangeText={handleSearch}
              className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
              placeholderTextColor="#6b7280"
            />
            {searchLoading && <ActivityIndicator size="small" />}
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <FriendListSkeleton />
      ) : (
        <FlatList
          data={
            searchQuery && (activeTab === "friends" || activeTab === "discover")
              ? (searchResults as any[])
              : activeTab === "friends"
                ? (friends as any[])
                : activeTab === "requests"
                  ? (friendRequests as any[])
                  : (suggestions as any[])
          }
          renderItem={
            searchQuery && (activeTab === "friends" || activeTab === "discover")
              ? (renderSearchResult as any)
              : activeTab === "friends"
                ? (renderFriend as any)
                : activeTab === "requests"
                  ? (renderFriendRequest as any)
                  : (renderSuggestion as any)
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-8">
              {activeTab === "friends" && !searchQuery && (
                <>
                  <Users size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                    No friends yet. Start connecting!
                  </Text>
                  <Button
                    className="mt-4"
                    onPress={() => setActiveTab("discover")}
                  >
                    <Text className="text-white">Discover Friends</Text>
                  </Button>
                </>
              )}
              {activeTab === "requests" && (
                <>
                  <UserPlus size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                    No pending friend requests
                  </Text>
                </>
              )}
              {activeTab === "discover" && !searchQuery && (
                <>
                  <Search size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                    No suggestions available right now
                  </Text>
                </>
              )}
              {searchQuery && searchResults.length === 0 && (
                <>
                  <Search size={48} color="#9ca3af" />
                  <Text className="text-gray-500 dark:text-gray-400 mt-4 text-center">
                    No results found for "{searchQuery}"
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
