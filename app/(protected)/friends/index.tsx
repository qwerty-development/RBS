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
  UserMinus,
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
import { BackHeader } from "@/components/ui/back-header";
import { OptimizedList } from "@/components/ui/optimized-list";

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
  email?: string; // Returned by search_users RPC function
  phone_number?: string; // Returned by search_users RPC function
  hasPendingRequest?: boolean;
  pendingRequest?: {
    id: string;
    from_user_id: string;
    to_user_id: string;
  } | null;
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
    if (activeTab !== "discover") {
      loadData();
    }
    // Clear search state when switching tabs to avoid leaking queries/results across tabs
    setSearchQuery("");
    setSearchResults([]);
    setSearchLoading(false);
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
          // Only load suggestions if explicitly searching
          if (searchQuery.length >= 2) {
            await executeSearch();
          }
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
      `,
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
      `,
      )
      .or(`to_user_id.eq.${profile?.id},from_user_id.eq.${profile?.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setFriendRequests(data);
    }
  };

  // This function is now only used when a search is performed
  const loadSuggestions = async () => {
    // We don't automatically load suggestions anymore
    // Only search results will be shown in discover tab
    setSuggestions([]);
  };

  const handleSearchInputChange = (query: string) => {
    setSearchQuery(query);

    // For Friends tab only: filter existing friends locally for fast, accurate navigation
    if (activeTab === "friends" && query.length >= 2) {
      const loweredQuery = query.toLowerCase();
      const filteredFriends = friends
        .filter((friend) =>
          friend.full_name.toLowerCase().includes(loweredQuery),
        )
        .map((friend) => ({
          id: friend.id,
          full_name: friend.full_name,
          avatar_url: friend.avatar_url,
          is_friend: true,
          hasPendingRequest: false,
        }));

      setSearchResults(filteredFriends);
    } else if (activeTab === "friends" && query.length < 2) {
      setSearchResults([]);
    } else if (activeTab === "discover") {
      // For discover tab, clear old results while typing - wait for button press to search
      setSearchResults([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const executeSearch = async () => {
    if (searchQuery.length < 2) {
      Alert.alert(
        "Search Error",
        "Please enter at least 2 characters to search",
      );
      return;
    }

    // For discover tab: global user search via RPC
    if (activeTab === "discover") {
      setSearchLoading(true);
      try {
        // Search users by name (partial match), email (partial match), or phone number (exact match, min 8 digits)
        // Function now returns: id, full_name, avatar_url, is_friend, email, phone_number
        const { data, error } = await supabase.rpc("search_users", {
          search_query: searchQuery,
        });

        if (!error && data) {
          // Check for pending requests
          const enrichedResults = await Promise.all(
            data.map(async (user: any) => {
              const { data: requestData } = await supabase
                .from("friend_requests")
                .select("id, from_user_id, to_user_id")
                .or(
                  `and(from_user_id.eq.${profile?.id},to_user_id.eq.${user.id}),and(from_user_id.eq.${user.id},to_user_id.eq.${profile?.id})`,
                )
                .eq("status", "pending")
                .single();

              return {
                ...user,
                hasPendingRequest: !!requestData,
                pendingRequest: requestData
                  ? {
                      id: requestData.id,
                      from_user_id: requestData.from_user_id,
                      to_user_id: requestData.to_user_id,
                    }
                  : null,
              };
            }),
          );

          setSearchResults(enrichedResults);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearchLoading(false);
      }
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
      if (searchQuery && activeTab === "friends") {
        handleSearchInputChange(searchQuery);
      } else if (searchQuery && activeTab === "discover") {
        await executeSearch();
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
    action: "accept" | "reject",
  ) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    try {
      if (action === "accept") {
        const { error } = await supabase
          .from("friend_requests")
          .update({
            status: "accepted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("friend_requests")
          .delete()
          .eq("id", requestId);

        if (error) throw error;
      }

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

  const removeFriendRequest = async (requestId: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Friend request removed.");

      // Refresh requests + search
      await loadFriendRequests();
      if (searchQuery) {
        await executeSearch();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to remove friend request");
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
                  `and(user_id.eq.${profile?.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile?.id})`,
                );

              if (error) throw error;

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              await loadFriends();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove friend");
            }
          },
        },
      ],
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // For the discover tab, only refresh if there's a search query
    if (activeTab === "discover" && !searchQuery) {
      setRefreshing(false);
      return;
    }
    await loadData();
    setRefreshing(false);
  };

  // Render functions
  const renderFriend = ({ item }: { item: Friend }) => (
    <Pressable
      onPress={() => router.push(`/(protected)/friends/${item.id}` as any)}
      className="flex-row items-center justify-between p-4 mb-2 bg-card rounded-2xl"
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
    const isSent = item.from_user_id === profile?.id;
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
        <Pressable
          onPress={() => {
            router.push(`/(protected)/social/profile/${otherUser?.id}` as any);
          }}
          className="flex-row items-center justify-between"
        >
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
                  &quot;{item.message}&quot;
                </Text>
              )}
            </View>
          </View>
        </Pressable>

        {/* Buttons */}
        <View className="flex-row mt-3 gap-2">
          {isReceived && (
            <>
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
            </>
          )}

          {isSent && (
            <Button
              size="sm"
              onPress={() => removeFriendRequest(item.id)}
              disabled={processingIds.has(item.id)}
              className="flex-1"
            >
              {processingIds.has(item.id) ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <View className="flex-row items-center justify-center gap-2">
                  <UserMinus size={16} color="white" />
                  <Text className="text-white">Remove Friend Request</Text>
                </View>
              )}
            </Button>
          )}
        </View>
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      onPress={() => {
        if (activeTab === "friends" || item.is_friend) {
          router.push(`/(protected)/friends/${item.id}` as any);
        } else if (activeTab === "discover" || !item.is_friend) {
          router.push(`/(protected)/social/profile/${item.id}` as any);
        }
      }}
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
          {activeTab === "discover" && item.is_friend && (
            <View className="flex-row items-center mt-1">
              <UserCheck size={14} color="#10b981" />
              <Muted className="text-sm ml-1">Already friends</Muted>
            </View>
          )}
        </View>
      </View>

      {activeTab === "discover" &&
        !item.is_friend &&
        !item.hasPendingRequest && (
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

      {activeTab === "discover" &&
        item.hasPendingRequest &&
        item.pendingRequest?.to_user_id === profile?.id && (
          <Button
            size="sm"
            onPress={() =>
              handleFriendRequest(item.pendingRequest!.id, "accept")
            }
            disabled={processingIds.has(item.pendingRequest!.id)}
          >
            {processingIds.has(item.pendingRequest!.id) ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <UserCheck size={16} color="white" />
                <Text className="text-white">Accept friend request</Text>
              </View>
            )}
          </Button>
        )}

      {activeTab === "discover" &&
        item.hasPendingRequest &&
        item.pendingRequest?.from_user_id === profile?.id && (
          <Button
            size="sm"
            onPress={() => removeFriendRequest(item.pendingRequest!.id)}
            disabled={processingIds.has(item.pendingRequest!.id)}
          >
            {processingIds.has(item.pendingRequest!.id) ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center justify-center gap-2">
                <UserMinus size={16} color="white" />
                <Text className="text-white">Remove friend request</Text>
              </View>
            )}
          </Button>
        )}
    </Pressable>
  );

  const renderSuggestion = ({ item }: { item: FriendSuggestion }) => (
    <Pressable
      onPress={() => {
        router.push(`/(protected)/social/profile/${item.id}` as any);
      }}
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
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <BackHeader title="Friends" />

      {/* Tabs */}
      <View className="flex-row bg-background px-4 py-2 border-b border-border">
        {[
          { id: "friends", label: "My Friends", icon: Users },
          { id: "requests", label: "Requests", icon: UserPlus },
          { id: "discover", label: "Discover", icon: Search },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
              activeTab === tab.id ? "bg-secondary" : ""
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
                activeTab === tab.id ? "text-red-600" : "text-muted-foreground"
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
        <View className="px-4 py-3 bg-background border-b border-border">
          <View className="flex-row items-center bg-input rounded-xl px-4 py-2">
            <Search size={20} color="#6b7280" />
            <TextInput
              placeholder={
                activeTab === "friends"
                  ? "Search friends..."
                  : "Search users..."
              }
              value={searchQuery}
              onChangeText={handleSearchInputChange}
              className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
              placeholderTextColor="#6b7280"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={clearSearch} className="ml-2 p-1">
                <X size={18} color="#6b7280" />
              </Pressable>
            )}
            {activeTab === "discover" && (
              <Pressable
                onPress={executeSearch}
                className="ml-2 bg-primary px-3 py-1.5 rounded-lg"
                disabled={searchLoading}
              >
                <Text className="text-white font-medium">
                  {searchLoading ? "Searching..." : "Search"}
                </Text>
              </Pressable>
            )}
            {searchLoading && (
              <ActivityIndicator size="small" className="ml-2" />
            )}
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <FriendListSkeleton />
      ) : (
        (() => {
          const listData =
            searchQuery && (activeTab === "friends" || activeTab === "discover")
              ? (searchResults as any[])
              : activeTab === "friends"
                ? (friends as any[])
                : activeTab === "requests"
                  ? (friendRequests as any[])
                  : (suggestions as any[]);

          const listRenderItem =
            searchQuery && (activeTab === "friends" || activeTab === "discover")
              ? (renderSearchResult as any)
              : activeTab === "friends"
                ? (renderFriend as any)
                : activeTab === "requests"
                  ? (renderFriendRequest as any)
                  : (renderSuggestion as any);

          if (listData.length === 0) {
            return (
              <View className="items-center justify-center py-8">
                {activeTab === "friends" && !searchQuery && (
                  <>
                    <Users size={48} color="#9ca3af" />
                    <Text className="text-muted-foreground mt-4 text-center">
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
                    <Text className="text-muted-foreground mt-4 text-center">
                      No pending friend requests
                    </Text>
                  </>
                )}
                {activeTab === "discover" && !searchQuery && (
                  <>
                    <Search size={48} color="#9ca3af" />
                    <Text className="text-muted-foreground mt-4 text-center">
                      Search for users by name, email or full phone number
                    </Text>
                    <Muted className="text-xs mt-2 text-center px-6">
                      Phone search requires full number (min 8 digits)
                    </Muted>
                  </>
                )}
                {searchQuery && listData.length === 0 && (
                  <>
                    <Search size={48} color="#9ca3af" />
                    <Text className="text-muted-foreground mt-4 text-center">
                      No results found for &quot;{searchQuery}&quot;
                    </Text>
                  </>
                )}
              </View>
            );
          }

          return (
            <View style={{ padding: 16, paddingBottom: 80 }}>
              <OptimizedList
                data={listData}
                renderItem={listRenderItem}
                keyExtractor={(item) => item.id}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            </View>
          );
        })()
      )}
    </SafeAreaView>
  );
}
