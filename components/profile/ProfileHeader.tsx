import React from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Edit3, Calendar } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H2, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { UserRatingBadge } from "@/components/rating/UserRatingBadge";

interface ProfileHeaderProps {
  profile: any;
  user: any;
  stats: {
    memberSince: string;
  };
  ratingStats?: {
    current_rating: number;
    rating_trend: string;
  };
  currentRating: number;
  ratingLoading: boolean;
  uploadingAvatar: boolean;
  onAvatarUpload: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  user,
  stats,
  ratingStats,
  currentRating,
  ratingLoading,
  uploadingAvatar,
  onAvatarUpload,
}) => {
  return (
    <View className="items-center pt-6 pb-4">
      <Pressable onPress={onAvatarUpload} disabled={uploadingAvatar}>
        <View className="relative">
          <Image
            source={
              profile?.avatar_url
                ? { uri: profile.avatar_url }
                : {
                    uri: `https://ui-avatars.com/api/?name=${profile?.full_name || "User"}&background=dc2626&color=fff`,
                  }
            }
            className="w-24 h-24 rounded-full"
            contentFit="cover"
          />
          {uploadingAvatar && (
            <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
              <ActivityIndicator size="small" color="white" />
            </View>
          )}
          <View className="absolute bottom-0 right-0 bg-primary rounded-full p-2">
            <Edit3 size={16} color="white" />
          </View>
        </View>
      </Pressable>

      <H2 className="mt-3">{profile?.full_name}</H2>
      <Muted>{user?.email}</Muted>
      {profile?.date_of_birth && (
        <Muted className="text-xs">
          Born{" "}
          {new Date(profile.date_of_birth).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Muted>
      )}

      {/* Member Since Badge with Rating */}
      <View className="flex-row items-center gap-3 mt-3">
        <View className="flex-row items-center gap-2 bg-muted px-3 py-1 rounded-full">
          <Calendar size={14} color="#666" />
          <Text className="text-sm text-muted-foreground">
            Member since{" "}
            {new Date(stats.memberSince).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* User Rating Badge */}
        {!ratingLoading && ratingStats && (
          <UserRatingBadge
            rating={currentRating}
            trend={ratingStats.rating_trend.toLowerCase() as any}
            compact={true}
          />
        )}
      </View>
    </View>
  );
};
