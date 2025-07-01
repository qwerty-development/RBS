// app/(protected)/profile.tsx - Integrated with Rating System
import React from "react";
import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { ProfileSocialStats } from "@/components/profile/ProfileSocialStats";
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
  MapPin,
  Clock,
  CreditCard,
  UserPlus,
  MessageCircle,
  Award,
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
  MapPin,
  Clock,
  CreditCard,
  UserPlus,
  MessageCircle,
  Award,
  Bot,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// Rating System Components
import { UserRating } from "@/components/rating/UserRating";
import { UserRatingBadge } from "@/components/rating/UserRatingBadge";
import { useUserRating } from "@/hooks/useUserRating";

// 1. Enhanced Type Definitions for Profile Analytics
interface ProfileStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  upcomingBookings: number;
  favoriteRestaurants: number;
  totalReviews: number;
  averageSpending: number;
  mostVisitedCuisine: string;
  mostVisitedRestaurant: {
    id: string;
    name: string;
    visits: number;
  } | null;
  diningStreak: number;
  memberSince: string;
  // Enhanced: Friends functionality
  totalFriends: number;
  pendingFriendRequests: number;
  recentFriendActivity: number;
}

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
    refresh: refreshRating 
  } = useUserRating();

  // 4. Enhanced Profile Statistics Calculation with Friends
  const fetchProfileStats = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // 4.1 Fetch all data in parallel for performance
      const [
        bookingsResult,
        favoritesResult,
        reviewsResult,
        friendsResult,
        friendRequestsResult,
        recentActivityResult,
      ] = await Promise.all([
        // Bookings with restaurant info
        supabase
          .from("bookings")
          .select("*, restaurant:restaurants(cuisine_type, name)")
          .eq("user_id", profile.id),
        
        // Favorites count
        supabase
          .from("favorites")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        
        // Reviews count
        supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        
        // Friends count (Note: Replace with actual table names if different)
        supabase
          .from("social_connections")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "accepted"),
        
        // Pending friend requests (Note: Replace with actual table names if different)
        supabase
          .from("social_connections")
          .select("*", { count: "exact", head: true })
          .eq("friend_id", profile.id)
          .eq("status", "pending"),
        
        // Recent friend activity (last 7 days)
        supabase
          .from("social_connections")
          .select("*", { count: "exact", head: true })
          .eq("friend_id", profile.id)
          .eq("status", "accepted")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const bookings = bookingsResult.data || [];

      // 4.2 Calculate booking statistics
      const totalBookings = bookings.length;
      const completedBookings = bookings.filter((b) => b.status === "completed").length;
      const cancelledBookings = bookings.filter((b) => b.status === "cancelled_by_user").length;
      const upcomingBookings = bookings.filter((b) => 
        ["pending", "confirmed"].includes(b.status) && 
        new Date(b.booking_time) > new Date()
      ).length;

      // 4.3 Calculate most visited cuisine
      const cuisineCounts: Record<string, number> = {};
      bookings.forEach((booking) => {
        if (booking.restaurant?.cuisine_type) {
          cuisineCounts[booking.restaurant.cuisine_type] =
            (cuisineCounts[booking.restaurant.cuisine_type] || 0) + 1;
        }
      });

      const mostVisitedCuisine =
        Object.entries(cuisineCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        "Not available";

      // 4.4 Calculate most visited restaurant
      const restaurantCounts: Record<string, { name: string; visits: number }> = {};
      bookings.forEach((booking) => {
        if (booking.restaurant_id) {
          if (!restaurantCounts[booking.restaurant_id]) {
            restaurantCounts[booking.restaurant_id] = {
              name: booking.restaurant?.name || "Unknown",
              visits: 0,
            };
          }
          restaurantCounts[booking.restaurant_id].visits++;
        }
      });

      const mostVisitedEntry = Object.entries(restaurantCounts).sort(
        ([, a], [, b]) => b.visits - a.visits
      )[0];

      const mostVisitedRestaurant = mostVisitedEntry
        ? {
            id: mostVisitedEntry[0],
            name: mostVisitedEntry[1].name,
            visits: mostVisitedEntry[1].visits,
          }
        : null;

      // 4.5 Calculate dining streak
      const streakWeeks = calculateDiningStreak(bookings);

      // 4.6 Update state with comprehensive stats
      setStats({
        totalBookings,
        completedBookings,
        cancelledBookings,
        upcomingBookings,
        favoriteRestaurants: favoritesResult.count || 0,
        totalReviews: reviewsResult.count || 0,
        averageSpending: 0, // Placeholder for future implementation
        mostVisitedCuisine,
        mostVisitedRestaurant,
        diningStreak: streakWeeks,
        memberSince: profile.created_at || new Date().toISOString(),
        // Friends statistics
        totalFriends: friendsResult.count || 0,
        pendingFriendRequests: friendRequestsResult.count || 0,
        recentFriendActivity: recentActivityResult.count || 0,
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      Alert.alert("Error", "Failed to load profile statistics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // 5. Avatar Upload Implementation
  const handleAvatarUpload = useCallback(async () => {
    // 5.1 Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload a profile picture."
      );
      return;
    }

    // 5.2 Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);

    try {
      const file = result.assets[0];
      const fileExt = file.uri.split(".").pop();
      const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 5.3 Upload to Supabase Storage
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      // 5.4 Get public URL
      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // 5.5 Update profile
      await updateProfile({ avatar_url: publicUrl.publicUrl });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", "Failed to upload profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile?.id, updateProfile]);

  // 6. Dining Streak Calculation Helper
  const calculateDiningStreak = (bookings: any[]) => {
    const sortedBookings = bookings
      .filter((b) => b.status === "completed")
      .sort((a, b) => new Date(b.booking_time).getTime() - new Date(a.booking_time).getTime());

    if (sortedBookings.length === 0) return 0;

    let streak = 1;
    let currentWeek = getWeekNumber(new Date(sortedBookings[0].booking_time));

    for (let i = 1; i < sortedBookings.length; i++) {
      const bookingWeek = getWeekNumber(new Date(sortedBookings[i].booking_time));
      if (currentWeek - bookingWeek === 1) {
        streak++;
        currentWeek = bookingWeek;
      } else if (currentWeek - bookingWeek > 1) {
        break;
      }
    }

    return streak;
  };

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // 7. Navigation Handlers
  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          } catch (error) {
            Alert.alert("Error", "Failed to sign out");
          }
        },
      },
    ]);
  }, [signOut]);

  // 8. Lifecycle Management
  useEffect(() => {
    if (profile) {
      fetchProfileStats();
    }
  }, [profile, fetchProfileStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchProfileStats(), refreshRating()]);
  }, [fetchProfileStats, refreshRating]);

  // 9. Enhanced Menu Items Configuration with Rating and Friends
  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        {
          id: "edit-profile",
          title: "Edit Profile",
          subtitle: "Update your personal information",
          icon: Edit3,
          onPress: () => router.push("/profile/edit"),
        },
        {
          id: "rating-details",
          title: "Reliability Score",
          subtitle: ratingStats ? `${ratingStats.current_rating.toFixed(1)} stars • ${ratingStats.reliability_score}` : "View your booking reliability",
          icon: BarChart3,
          onPress: () => router.push("/profile/rating-details"),
        },
        {
          id: "friends",
          title: "Friends",
          subtitle: `${stats.totalFriends} friends`,
          icon: Users,
          onPress: () => router.push("/friends"),
          showBadge: stats.pendingFriendRequests > 0,
          badgeText: stats.pendingFriendRequests.toString(),
          badgeColor: "#dc2626",
        },
        {
          id: "preferences",
          title: "Dining Preferences",
          subtitle: "Allergies, dietary restrictions",
          icon: Utensils,
          onPress: () => router.push("/profile/preferences"),
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "Manage your notification settings",
          icon: Bell,
          onPress: () => router.push("/profile/notifications"),
          showBadge: true,
          badgeText: "2",
          badgeColor: "#3b82f6",
        },
      ],
    },
    {
      title: "Rewards & History",
      items: [
        {
          id: "loyalty",
          title: "Loyalty Program",
          subtitle: `${profile?.loyalty_points || 0} points • ${LOYALTY_TIERS[profile?.membership_tier || "bronze"].name}`,
          icon: Trophy,
          onPress: () =>
            router.push({
              pathname: "/profile/loyalty",
              params: { points: profile?.loyalty_points || 0 },
            }),
        },
        {
          id: "offers",
          title: "Special Offers",
          subtitle: "Exclusive deals and discounts",
          icon: Gift,
          onPress: () => router.push("/profile/offers"),
        },
        {
          id: "reviews",
          title: "My Reviews",
          subtitle: `${stats.totalReviews} reviews written`,
          icon: Star,
          onPress: () =>
            router.push({
              pathname: "/profile/reviews",
              params: { id: user?.id },
            }),
        },
        {
          id: "insights",
          title: "Dining Insights",
          subtitle: "Your dining patterns and statistics",
          icon: TrendingUp,
          onPress: () => router.push("/profile/insights"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "chat-test-py",
          title: "🐍 Test Flask Chat",
          subtitle: "Test the Python-powered AI assistant",
          icon: Bot,
          onPress: () => router.push("./chat_test_py" as any),
          showBadge: true,
          badgeText: "NEW",
          badgeColor: "#22c55e",
        },
        {
          id: "help",
          title: "Help & Support",
          subtitle: "FAQs and contact support",
          icon: HelpCircle,
          onPress: () => router.push("/profile/help"),
        },
        {
          id: "privacy",
          title: "Privacy & Security",
          subtitle: "Privacy policy and data settings",
          icon: Shield,
          onPress: () => router.push("/profile/privacy"),
        },
      ],
    },
    {
      title: "",
      items: [
        {
          id: "signout",
          title: "Sign Out",
          icon: LogOut,
          onPress: handleSignOut,
          destructive: true,
        },
      ],
    },
  ];

  // 10. Progress to Next Tier Calculation
  const calculateTierProgress = () => {
    const currentPoints = profile?.loyalty_points || 0;
    const currentTier = profile?.membership_tier || "bronze";
    const tiers = ["bronze", "silver", "gold", "platinum"];
    const currentIndex = tiers.indexOf(currentTier);

    if (currentIndex === tiers.length - 1) {
      return { progress: 1, pointsToNext: 0, nextTier: null };
    }

    const nextTier = tiers[currentIndex + 1] as keyof typeof LOYALTY_TIERS;
    const currentMin = LOYALTY_TIERS[currentTier].minPoints;
    const nextMin = LOYALTY_TIERS[nextTier].minPoints;

    const progress = (currentPoints - currentMin) / (nextMin - currentMin);
    const pointsToNext = nextMin - currentPoints;

    return { progress, pointsToNext, nextTier };
  };

  // 11. Main Render
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

    <ProfileSocialStats />
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
