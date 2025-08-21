import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Star,
  MessageCircle,
  Check,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  created_at: string;
  posts_count: number;
  friends_count: number;
  reviews_count: number;
  avg_rating: number | null;
}

interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { profile: currentUser } = useAuth();
  const { colorScheme } = useColorScheme();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<FriendRequest | null>(
    null
  );
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchUserProfile = useCallback(async () => {
    if (!userId || !currentUser?.id) return;

    try {
      if (userId === currentUser.id) {
        setIsCurrentUser(true);
        router.replace("/profile");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      const userProfileData: UserProfile = {
        ...profileData,
        posts_count: 0,
        friends_count: 0,
        reviews_count: 0,
        avg_rating: null,
      };

      setUserProfile(userProfileData);

      const { data: friendshipData } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`
        )
        .eq("status", "accepted")
        .single();

      setIsFriend(!!friendshipData);

      // Check pending friend request FROM this user TO current user
      const { data: requestData } = await supabase
        .from("friend_requests")
        .select("*")
        .or(
          `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${currentUser.id})`
        )
        .eq("status", "pending")
        .single();

      setPendingRequest(requestData || null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      Alert.alert("Error", "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser?.id, router]);

  const sendFriendRequest = async () => {
    if (!currentUser?.id || !userId) return;

    setProcessingIds((prev) => new Set(prev).add(userId));

    try {
      // Check if a request already exists in either direction
      const { data: existing, error: checkError } = await supabase
        .from("friend_requests")
        .select("*")
        .or(
          `and(from_user_id.eq.${currentUser.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${currentUser.id})`
        )
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // If a row exists, update it to pending
        const { error: updateError } = await supabase
          .from("friend_requests")
          .update({
            status: "pending",
            from_user_id: currentUser.id,
            to_user_id: userId,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Otherwise create a new one
        const { error: insertError } = await supabase
          .from("friend_requests")
          .insert({
            from_user_id: currentUser.id,
            to_user_id: userId,
            status: "pending",
          });

        if (insertError) throw insertError;
      }

      Alert.alert("Success", "Friend request sent!");
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "Failed to send friend request");

      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleFriendRequest = async (requestId: string, action: "accept") => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) throw error;

      Alert.alert("Success", "Friend request accepted!");
      setPendingRequest(null);
      setIsFriend(true);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "Failed to accept friend request");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const removeFriendRequest = async () => {
    if (!pendingRequest) return;

    setProcessingIds((prev) => new Set(prev).add(pendingRequest.id));

    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", pendingRequest.id);

      if (error) throw error;

      Alert.alert("Success", "Friend request removed");
      setPendingRequest(null); // Remove pending request from state
    } catch (error: any) {
      console.error("Error removing friend request:", error);
      Alert.alert("Error", error.message || "Failed to remove friend request");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(pendingRequest.id);
        return newSet;
      });
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="p-4 border-b border-border flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft
              size={24}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <H2 className="ml-2">Profile</H2>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text>User not found</Text>
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
        <H2 className="ml-2">{userProfile.full_name}</H2>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Info */}
        <View className="p-6 items-center">
          <Image
            source={{
              uri:
                userProfile.avatar_url ||
                "https://via.placeholder.com/120x120?text=User",
            }}
            className="w-24 h-24 rounded-full mb-4"
          />
          <H2 className="text-center">{userProfile.full_name}</H2>
          {userProfile.bio && (
            <P className="text-center mt-2 text-muted-foreground">
              {userProfile.bio}
            </P>
          )}
          {userProfile.location && (
            <View className="flex-row items-center mt-2">
              <MapPin size={16} color="#666" />
              <Muted className="ml-1">{userProfile.location}</Muted>
            </View>
          )}
          <View className="flex-row items-center mt-2">
            <Calendar size={16} color="#666" />
            <Muted className="ml-1">
              Joined {new Date(userProfile.created_at).toLocaleDateString()}
            </Muted>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row justify-around py-6 border-y border-border mx-6">
          <View className="items-center">
            <Text className="text-xl font-bold">{userProfile.posts_count}</Text>
            <Muted className="text-sm">Posts</Muted>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold">
              {userProfile.friends_count}
            </Text>
            <Muted className="text-sm">Friends</Muted>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold">
              {userProfile.reviews_count}
            </Text>
            <Muted className="text-sm">Reviews</Muted>
          </View>
          {userProfile.avg_rating && (
            <View className="items-center">
              <View className="flex-row items-center">
                <Text className="text-xl font-bold">
                  {userProfile.avg_rating.toFixed(1)}
                </Text>
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
              </View>
              <Muted className="text-sm">Rating</Muted>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {!isCurrentUser && (
          <View className="p-6 gap-3">
            {pendingRequest ? (
              currentUser?.id === pendingRequest.from_user_id ? (
                // If current user sent the request → show remove button
                <Button
                  onPress={removeFriendRequest}
                  disabled={processingIds.has(pendingRequest.id)}
                >
                  {processingIds.has(pendingRequest.id) ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View className="flex-row items-center justify-center gap-2">
                      <Users size={20} color="white" />
                      <Text>Remove Friend Request</Text>
                    </View>
                  )}
                </Button>
              ) : (
                <Button
                  onPress={() =>
                    handleFriendRequest(pendingRequest.id, "accept")
                  }
                  disabled={processingIds.has(pendingRequest.id)}
                >
                  {processingIds.has(pendingRequest.id) ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View className="flex-row items-center justify-center gap-2">
                      <Check size={16} color="white" />
                      <Text className="text-white">Accept Friend Request</Text>
                    </View>
                  )}
                </Button>
              )
            ) : !isFriend ? (
              <Button
                onPress={sendFriendRequest}
                disabled={processingIds.has(userId!)}
              >
                {processingIds.has(userId!) ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View className="flex-row items-center justify-center gap-2">
                    <Users size={20} color="white" />
                    <Text>Add Friend</Text>
                  </View>
                )}
              </Button>
            ) : (
              <Button variant="outline">
                <View className="flex-row items-center justify-center gap-2">
                  <Users size={20} color="#666" />
                  <Text>Friends</Text>
                </View>
              </Button>
            )}

            <Button
              variant="outline"
              onPress={() => Alert.alert("Coming Soon")}
            >
              <View className="flex-row items-center justify-center gap-2">
                <MessageCircle size={20} color="#666" />
                <Text>Message</Text>
              </View>
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
