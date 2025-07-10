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

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const { profile: currentUser } = useAuth();
  const { colorScheme } = useColorScheme();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);

  const fetchUserProfile = useCallback(async () => {
    if (!userId || !currentUser?.id) return;

    try {
      // Check if viewing own profile
      if (userId === currentUser.id) {
        setIsCurrentUser(true);
        router.replace("/profile");
        return;
      }

      // Fetch user profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Get user stats (this would require proper database views/functions)
      // For now, using placeholder data
      const userProfileData: UserProfile = {
        ...profileData,
        posts_count: 0,
        friends_count: 0,
        reviews_count: 0,
        avg_rating: null,
      };

      setUserProfile(userProfileData);

      // Check friendship status
      const { data: friendshipData } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`
        )
        .eq("status", "accepted")
        .single();

      setIsFriend(!!friendshipData);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      Alert.alert("Error", "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser?.id, router]);

  const handleSendFriendRequest = async () => {
    if (!currentUser?.id || !userId) return;

    try {
      const { error } = await supabase.from("friends").insert({
        user_id: currentUser.id,
        friend_id: userId,
        status: "pending",
      });

      if (error) throw error;

      Alert.alert("Success", "Friend request sent!");
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "Failed to send friend request");
    }
  };

  const handleSendMessage = () => {
    Alert.alert("Coming Soon", "Direct messaging feature coming soon!");
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
        {/* Profile Section */}
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
            {!isFriend ? (
              <Button onPress={handleSendFriendRequest}>
                <View className="flex-row items-center justify-center gap-2">
                  <Users size={20} color="white" />
                  <Text>Add Friend</Text>
                </View>
              </Button>
            ) : (
              <Button variant="outline">
                <View className="flex-row items-center justify-center gap-2">
                  <Users size={20} color="#666" />
                  <Text>Friends</Text>
                </View>
              </Button>
            )}
            <Button variant="outline" onPress={handleSendMessage}>
              <View className="flex-row items-center justify-center gap-2">
                <MessageCircle size={20} color="#666" />
                <Text>Message</Text>
              </View>
            </Button>
          </View>
        )}

        {/* Recent Activity Placeholder */}
        <View className="p-6">
          <H3 className="mb-4">Recent Activity</H3>
          <View className="bg-card rounded-lg p-6 items-center">
            <Muted className="text-center">
              This user's recent posts and reviews will appear here
            </Muted>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
