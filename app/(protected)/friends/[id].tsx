import React, { useState, useEffect } from "react";
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
  Star,
  MapPin,
  Users,
  Calendar,
  Award,
  Utensils,
  AlertTriangle,
  Shield,
  MessageCircle,
  UserMinus,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { FriendProfileSkeleton } from "@/components/skeletons/FriendProfileSkeleton";

interface FriendProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  favorite_cuisines: string[] | null;
  dietary_restrictions: string[] | null;
  allergies: string[] | null;
  preferred_party_size: number | null;
  loyalty_points: number;
  membership_tier: string;
  user_rating: number | null;
  total_bookings: number;
  completed_bookings: number;
  created_at: string;
  privacy_settings: any;
}

interface FriendshipInfo {
  friendship_date: string;
  mutual_friends_count: number;
  common_restaurants: number;
}

export default function FriendProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(
    null,
  );
  const [friendshipInfo, setFriendshipInfo] = useState<FriendshipInfo | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [removingFriend, setRemovingFriend] = useState(false);

  useEffect(() => {
    if (id) {
      loadFriendProfile();
      loadFriendshipInfo();
    }
  }, [id]);

  const loadFriendProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          avatar_url,
          favorite_cuisines,
          dietary_restrictions,
          allergies,
          preferred_party_size,
          loyalty_points,
          membership_tier,
          user_rating,
          total_bookings,
          completed_bookings,
          created_at,
          privacy_settings
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      setFriendProfile(data);
    } catch (error) {
      console.error("Error loading friend profile:", error);
      Alert.alert("Error", "Failed to load friend profile");
    } finally {
      setLoading(false);
    }
  };

  const loadFriendshipInfo = async () => {
    try {
      // Load friendship date
      const { data: friendshipData } = await supabase
        .from("friends")
        .select("friendship_date")
        .or(
          `and(user_id.eq.${profile?.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${profile?.id})`,
        )
        .single();

      // Get mutual friends count (simplified - would need proper RPC function)
      const { count: mutualCount } = await supabase
        .from("friends")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id);

      setFriendshipInfo({
        friendship_date: friendshipData?.friendship_date || "",
        mutual_friends_count: mutualCount || 0,
        common_restaurants: 0, // Would need proper calculation
      });
    } catch (error) {
      console.error("Error loading friendship info:", error);
    }
  };

  const removeFriend = async () => {
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friendProfile?.full_name} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingFriend(true);
              const { error } = await supabase
                .from("friends")
                .delete()
                .or(
                  `and(user_id.eq.${profile?.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${profile?.id})`,
                );

              if (error) throw error;

              Alert.alert("Success", "Friend removed successfully");
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove friend");
            } finally {
              setRemovingFriend(false);
            }
          },
        },
      ],
    );
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "platinum":
        return "#e5e7eb";
      case "gold":
        return "#fbbf24";
      case "silver":
        return "#9ca3af";
      default:
        return "#6b7280";
    }
  };

  const getTierIcon = (tier: string) => {
    return <Award size={16} color={getTierColor(tier)} />;
  };

  if (loading) {
    return <FriendProfileSkeleton />;
  }

  if (!friendProfile) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Text>Profile not found</Text>
          <Button onPress={() => router.back()} className="mt-4">
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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

          <H2>Friend Profile</H2>

          <Pressable
            onPress={removeFriend}
            className="p-2"
            disabled={removingFriend}
          >
            {removingFriend ? (
              <ActivityIndicator size="small" />
            ) : (
              <UserMinus size={24} color="#ef4444" />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Profile Header */}
        <View className="bg-white dark:bg-gray-800 p-6 items-center border-b border-gray-200 dark:border-gray-700">
          <Image
            source={{
              uri:
                friendProfile.avatar_url ||
                `https://ui-avatars.com/api/?name=${friendProfile.full_name}`,
            }}
            className="w-24 h-24 rounded-full bg-gray-100 mb-4"
          />

          <H2 className="text-center mb-2">{friendProfile.full_name}</H2>

          {friendProfile.user_rating && (
            <View className="flex-row items-center mb-2">
              <Star size={16} color="#fbbf24" fill="#fbbf24" />
              <Text className="ml-1 font-semibold">
                {friendProfile.user_rating.toFixed(1)}
              </Text>
              <Muted className="ml-1">rating</Muted>
            </View>
          )}

          {/* Membership Tier */}
          <View className="flex-row items-center mb-4">
            {getTierIcon(friendProfile.membership_tier)}
            <Text className="ml-2 font-medium capitalize">
              {friendProfile.membership_tier} Member
            </Text>
            <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {friendProfile.loyalty_points} points
            </Text>
          </View>

          {/* Friendship Info */}
          {friendshipInfo && (
            <View className="flex-row items-center gap-4">
              <View className="items-center">
                <Calendar size={16} color="#6b7280" />
                <Muted className="text-xs mt-1">
                  Friends since{" "}
                  {new Date(friendshipInfo.friendship_date).getFullYear()}
                </Muted>
              </View>
              <View className="items-center">
                <Users size={16} color="#6b7280" />
                <Muted className="text-xs mt-1">
                  {friendshipInfo.mutual_friends_count} mutual
                </Muted>
              </View>
            </View>
          )}
        </View>

        {/* Stats Section */}
        <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-2xl">
          <H3 className="mb-4">Dining Stats</H3>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-red-600">
                {friendProfile.total_bookings}
              </Text>
              <Muted className="text-xs">Total Bookings</Muted>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-green-600">
                {friendProfile.completed_bookings}
              </Text>
              <Muted className="text-xs">Completed</Muted>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-blue-600">
                {friendProfile.preferred_party_size || 2}
              </Text>
              <Muted className="text-xs">Preferred Size</Muted>
            </View>
          </View>
        </View>

        {/* Dining Preferences */}
        <View className="bg-white dark:bg-gray-800 m-4 p-4 rounded-2xl">
          <H3 className="mb-4">Dining Preferences</H3>

          {/* Favorite Cuisines */}
          {friendProfile.favorite_cuisines &&
            friendProfile.favorite_cuisines.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Utensils size={16} color="#6b7280" />
                  <Text className="ml-2 font-medium">Favorite Cuisines</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {friendProfile.favorite_cuisines.map((cuisine, index) => (
                    <View
                      key={index}
                      className="bg-red-100 dark:bg-red-900 px-3 py-1 rounded-full"
                    >
                      <Text className="text-red-800 dark:text-red-200 text-sm">
                        {cuisine}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

          {/* Dietary Restrictions */}
          {friendProfile.dietary_restrictions &&
            friendProfile.dietary_restrictions.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Shield size={16} color="#6b7280" />
                  <Text className="ml-2 font-medium">Dietary Restrictions</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {friendProfile.dietary_restrictions.map(
                    (restriction, index) => (
                      <View
                        key={index}
                        className="bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full"
                      >
                        <Text className="text-blue-800 dark:text-blue-200 text-sm">
                          {restriction}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}

          {/* Allergies */}
          {friendProfile.allergies && friendProfile.allergies.length > 0 && (
            <View>
              <View className="flex-row items-center mb-2">
                <AlertTriangle size={16} color="#ef4444" />
                <Text className="ml-2 font-medium">Allergies</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {friendProfile.allergies.map((allergy, index) => (
                  <View
                    key={index}
                    className="bg-red-100 dark:bg-red-900 px-3 py-1 rounded-full"
                  >
                    <Text className="text-red-800 dark:text-red-200 text-sm">
                      {allergy}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!friendProfile.favorite_cuisines?.length &&
            !friendProfile.dietary_restrictions?.length &&
            !friendProfile.allergies?.length && (
              <Muted className="text-center py-4">
                No dining preferences shared
              </Muted>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
