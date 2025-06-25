// app/(protected)/profile.tsx - Integrated with Rating System
import React from "react";
import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStatusCards } from "@/components/profile/ProfileStatusCards";
import { ProfileStatsGrid } from "@/components/profile/ProfileStatsGrid";
import { ProfileFavoritesInsights } from "@/components/profile/ProfileFavoritesInsights";
import { ProfileRatingInsights } from "@/components/profile/ProfileRatingInsights";
import { useProfileData } from "@/hooks/useProfileData";
import { Text } from "@/components/ui/text";
// Import all icons used in menuSections
import {
  Edit3,
  BarChart3,
  Users,
  Utensils,
  Bell,
  Trophy,
  Gift,
  Star,
  TrendingUp,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react-native";

// Add index signature for iconMap
const iconMap: { [key: string]: any } = {
  Edit3,
  BarChart3,
  Users,
  Utensils,
  Bell,
  Trophy,
  Gift,
  Star,
  TrendingUp,
  HelpCircle,
  Shield,
  LogOut,
};

// Add type for menu item
interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => any;
  showBadge?: boolean;
  badgeText?: string;
  badgeColor?: string;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const {
    profile,
    user,
    stats,
    loading,
    refreshing,
    uploadingAvatar,
    ratingStats,
    ratingLoading,
    currentRating,
    handleAvatarUpload,
    handleRefresh,
    calculateTierProgress,
    LOYALTY_TIERS,
    menuSections,
  } = useProfileData();

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </View>
      </SafeAreaView>
    );
  }

  const tierProgress = calculateTierProgress();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
      >
        <ProfileHeader
          profile={profile}
          user={user}
          stats={stats}
          ratingStats={ratingStats ?? undefined}
          currentRating={currentRating}
          ratingLoading={ratingLoading}
          uploadingAvatar={uploadingAvatar}
          onAvatarUpload={handleAvatarUpload}
        />
        <ProfileStatusCards
          profile={profile}
          loyaltyTiers={LOYALTY_TIERS}
          tierProgress={tierProgress}
          ratingStats={ratingStats ?? undefined}
          currentRating={currentRating}
          ratingLoading={ratingLoading}
        />
        <ProfileStatsGrid
          stats={stats}
          loyaltyPoints={profile?.loyalty_points || 0}
          loyaltyTierColor={
            LOYALTY_TIERS[profile?.membership_tier || "bronze"].color
          }
        />
        <ProfileFavoritesInsights
          mostVisitedCuisine={stats.mostVisitedCuisine}
          mostVisitedRestaurant={stats.mostVisitedRestaurant}
        />
        {ratingStats && (
          <ProfileRatingInsights
            ratingStats={ratingStats}
            currentRating={currentRating}
            onPress={() => router.push("/profile/rating-details")}
          />
        )}
        {/* Menu Sections */}
        {menuSections(router).map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-6">
            {section.title && (
              <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-2">
                {section.title}
              </Text>
            )}
            <View className="bg-card mx-4 rounded-xl overflow-hidden">
              {section.items.map((item: MenuItem, itemIndex: number) => {
                const Icon = iconMap[item.icon] || Edit3;
                return (
                  <Pressable
                    key={item.id}
                    onPress={async () => {
                      await Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      );
                      item.onPress();
                    }}
                    className={`flex-row items-center px-4 py-4 ${itemIndex < section.items.length - 1 ? "border-b border-border" : ""}`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${item.destructive ? "bg-destructive/10" : "bg-muted"}`}
                    >
                      <Icon
                        size={20}
                        color={item.destructive ? "#ef4444" : "#666"}
                      />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className={`font-medium ${item.destructive ? "text-destructive" : ""}`}
                      >
                        {item.title}
                      </Text>
                      {item.subtitle && (
                        <Text className="text-sm text-muted-foreground">
                          {item.subtitle}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {item.showBadge && item.badgeText && (
                        <View
                          className="px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: item.badgeColor || "#3b82f6",
                          }}
                        >
                          <Text className="text-xs text-white font-medium">
                            {item.badgeText}
                          </Text>
                        </View>
                      )}
                      <ChevronRight size={20} color="#666" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {/* Footer */}
        <View className="items-center pb-8">
          <Text className="text-xs text-muted-foreground">Version 1.0.0</Text>
          <Text className="text-xs text-muted-foreground">
            © 2024 TableReserve
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
