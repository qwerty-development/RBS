// app/(protected)/profile.tsx - Integrated with Rating System
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Settings,
  Heart,
  Calendar,
  Trophy,
  Bell,
  LogOut,
  ChevronRight,
  Edit3,
  Shield,
  HelpCircle,
  Star,
  TrendingUp,
  Utensils,
  MapPin,
  Clock,
  CreditCard,
  Users,
  UserPlus,
  MessageCircle,
  Gift,
  BarChart3,
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
  icon: any;
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  badgeColor?: string;
  destructive?: boolean;
}

// 2. Loyalty Tier Configuration
const LOYALTY_TIERS = {
  bronze: {
    name: "Bronze",
    color: "#CD7F32",
    minPoints: 0,
    perks: ["Birthday rewards", "Early access to events"],
  },
  silver: {
    name: "Silver",
    color: "#C0C0C0",
    minPoints: 500,
    perks: ["All Bronze perks", "5% bonus points", "Priority support"],
  },
  gold: {
    name: "Gold",
    color: "#FFD700",
    minPoints: 1500,
    perks: [
      "All Silver perks",
      "10% bonus points",
      "Exclusive offers",
      "VIP events",
    ],
  },
  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    minPoints: 3000,
    perks: [
      "All Gold perks",
      "20% bonus points",
      "Personal concierge",
      "Premium experiences",
    ],
  },
};

export default function ProfileScreen() {
  // 3. State Management Architecture
  const { profile, user, signOut, updateProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // 3.1 Enhanced Profile Statistics State
  const [stats, setStats] = useState<ProfileStats>({
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    upcomingBookings: 0,
    favoriteRestaurants: 0,
    totalReviews: 0,
    averageSpending: 0,
    mostVisitedCuisine: "Not available",
    mostVisitedRestaurant: null,
    diningStreak: 0,
    memberSince: new Date().toISOString(),
    // Friends data
    totalFriends: 0,
    pendingFriendRequests: 0,
    recentFriendActivity: 0,
  });

  // 3.2 UI State Management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 3.3 User Rating Hook
  const { 
    stats: ratingStats, 
    loading: ratingLoading, 
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
        {/* 11.1 Enhanced Profile Header with Rating */}
        <View className="items-center pt-6 pb-4">
          <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
            <View className="relative">
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : { 
                        uri: `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=dc2626&color=fff`
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

          {/* 11.2 Enhanced Member Since Badge with Rating */}
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

        {/* 11.3 Enhanced Loyalty & Rating Status Cards */}
        <View className="flex-row mx-4 mb-6 gap-3">
          {/* Loyalty Status Card */}
          <View className="flex-1 p-4 bg-card rounded-xl shadow-sm">
            <View className="flex-row items-center gap-2 mb-2">
              <Trophy
                size={20}
                color={LOYALTY_TIERS[profile?.membership_tier || "bronze"].color}
              />
              <Text className="font-bold text-sm">
                {LOYALTY_TIERS[profile?.membership_tier || "bronze"].name}
              </Text>
            </View>
            <Text className="text-lg font-bold text-primary">
              {profile?.loyalty_points || 0}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Loyalty Points
            </Text>
            
            {/* Progress Bar for Loyalty */}
            {tierProgress.nextTier && (
              <>
                <View className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <View
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, tierProgress.progress * 100))}%` }}
                  />
                </View>
                <Text className="text-xs text-muted-foreground mt-1">
                  {tierProgress.pointsToNext} to {LOYALTY_TIERS[tierProgress.nextTier].name}
                </Text>
              </>
            )}
          </View>

          {/* Reliability Score Card */}
          <View className="flex-1 p-4 bg-card rounded-xl shadow-sm">
            <View className="flex-row items-center gap-2 mb-2">
              <Award size={20} color="#FFD700" />
              <Text className="font-bold text-sm">Reliability</Text>
            </View>
            {!ratingLoading && ratingStats ? (
              <>
                <UserRating 
                  rating={currentRating} 
                  size="sm" 
                  showNumber={false}
                />
                <Text className="text-lg font-bold text-primary mt-1">
                  {currentRating.toFixed(1)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {ratingStats.completion_rate.toFixed(0)}% completion rate
                </Text>
              </>
            ) : (
              <View className="py-2">
                <ActivityIndicator size="small" />
                <Text className="text-xs text-muted-foreground mt-1">Loading...</Text>
              </View>
            )}
          </View>
        </View>

        {/* 11.4 Enhanced Quick Stats Grid with Rating Stats */}
        <View className="mx-4 mb-6">
          <H3 className="mb-3">Your Dining Journey</H3>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <Calendar size={20} color="#3b82f6" />
                <Text className="font-bold text-2xl">{stats.totalBookings}</Text>
              </View>
              <Muted className="text-sm">Total Bookings</Muted>
              {stats.upcomingBookings > 0 && (
                <Text className="text-xs text-primary mt-1">
                  {stats.upcomingBookings} upcoming
                </Text>
              )}
            </View>

            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <Users size={20} color="#10b981" />
                <Text className="font-bold text-2xl">{stats.totalFriends}</Text>
              </View>
              <Muted className="text-sm">Friends</Muted>
              {stats.pendingFriendRequests > 0 && (
                <Text className="text-xs text-red-600 mt-1">
                  {stats.pendingFriendRequests} pending
                </Text>
              )}
            </View>

            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <Heart size={20} color="#ef4444" />
                <Text className="font-bold text-2xl">{stats.favoriteRestaurants}</Text>
              </View>
              <Muted className="text-sm">Favorites</Muted>
            </View>

            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <Star size={20} color="#f59e0b" />
                <Text className="font-bold text-2xl">{stats.totalReviews}</Text>
              </View>
              <Muted className="text-sm">Reviews</Muted>
            </View>

            {/* Enhanced with Rating-specific Stats */}
            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <TrendingUp size={20} color="#8b5cf6" />
                <Text className="font-bold text-2xl">{stats.diningStreak}w</Text>
              </View>
              <Muted className="text-sm">Dining Streak</Muted>
            </View>

            <View className="flex-1 min-w-[45%] bg-card p-4 rounded-lg">
              <View className="flex-row items-center gap-2 mb-1">
                <Trophy size={20} color={LOYALTY_TIERS[profile?.membership_tier || "bronze"].color} />
                <Text className="font-bold text-2xl">{profile?.loyalty_points || 0}</Text>
              </View>
              <Muted className="text-sm">Loyalty Points</Muted>
            </View>
          </View>
        </View>

        {/* 11.5 Enhanced Favorite Insights */}
        {(stats.mostVisitedCuisine !== "Not available" || stats.mostVisitedRestaurant) && (
          <View className="mx-4 mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <Text className="font-semibold mb-2">Your Favorites</Text>
            {stats.mostVisitedCuisine !== "Not available" && (
              <View className="flex-row items-center gap-2 mb-1">
                <Utensils size={16} color="#666" />
                <Text className="text-sm">
                  Favorite cuisine:{" "}
                  <Text className="font-medium">{stats.mostVisitedCuisine}</Text>
                </Text>
              </View>
            )}
            {stats.mostVisitedRestaurant && (
              <View className="flex-row items-center gap-2">
                <MapPin size={16} color="#666" />
                <Text className="text-sm">
                  Most visited:{" "}
                  <Text className="font-medium">{stats.mostVisitedRestaurant.name}</Text>{" "}
                  ({stats.mostVisitedRestaurant.visits} visits)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 11.6 Rating Insights Card */}
        {ratingStats && ratingStats.total_bookings > 0 && (
          <Pressable 
            onPress={() => router.push("/profile/rating-details")}
            className="mx-4 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-semibold text-blue-800">Reliability Insights</Text>
              <ChevronRight size={16} color="#2563eb" />
            </View>
            <View className="flex-row items-center gap-4">
              <View className="flex-1">
                <Text className="text-blue-700 text-sm">
                  Completion Rate: <Text className="font-medium">{ratingStats.completion_rate.toFixed(0)}%</Text>
                </Text>
                <Text className="text-blue-700 text-sm">
                  Rating Trend: <Text className="font-medium">{ratingStats.rating_trend}</Text>
                </Text>
              </View>
              <UserRating 
                rating={currentRating}
                size="md"
                showNumber={true}
              />
            </View>
          </Pressable>
        )}

        {/* 11.7 Enhanced Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-6">
            {section.title && (
              <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-2">
                {section.title}
              </Text>
            )}
            <View className="bg-card mx-4 rounded-xl overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <Pressable
                  key={item.id}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    item.onPress();
                  }}
                  className={`flex-row items-center px-4 py-4 ${
                    itemIndex < section.items.length - 1 ? "border-b border-border" : ""
                  }`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      item.destructive ? "bg-destructive/10" : "bg-muted"
                    }`}
                  >
                    <item.icon
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
                    {item.subtitle && <Muted className="text-sm">{item.subtitle}</Muted>}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {item.showBadge && item.badgeText && (
                      <View 
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: item.badgeColor || "#3b82f6" }}
                      >
                        <Text className="text-xs text-white font-medium">
                          {item.badgeText}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={20} color="#666" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* 11.8 App Version Footer */}
        <View className="items-center pb-8">
          <Muted className="text-xs">Version 1.0.0</Muted>
          <Muted className="text-xs">© 2024 TableReserve</Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}