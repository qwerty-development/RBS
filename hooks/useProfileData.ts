import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useUserRating } from "@/hooks/useUserRating";

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

export const useProfileData = () => {
  const { profile, user, signOut, updateProfile } = useAuth();
  const {
    stats: ratingStats,
    loading: ratingLoading,
    currentRating,
    refresh: refreshRating,
  } = useUserRating();

  const [stats, setStats] = useState({
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
    totalFriends: 0,
    pendingFriendRequests: 0,
    recentFriendActivity: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Stats fetching
  const fetchProfileStats = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [
        bookingsResult,
        favoritesResult,
        reviewsResult,
        friendsResult,
        friendRequestsResult,
        recentActivityResult,
      ] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, restaurant:restaurants(cuisine_type, name)")
          .eq("user_id", profile.id),
        supabase
          .from("favorites")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        supabase
          .from("friends")
          .select("*", { count: "exact", head: true })
       .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`),
       
        supabase
          .from("social_connections")
          .select("*", { count: "exact", head: true })
          .eq("friend_id", profile.id)
     ,
        supabase
          .from("social_connections")
          .select("*", { count: "exact", head: true })
          .eq("friend_id", profile.id)
          .eq("status", "accepted")
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
      ]);
      const bookings = bookingsResult.data || [];
      const totalBookings = bookings.length;
      const completedBookings = bookings.filter(
        (b: any) => b.status === "completed"
      ).length;
      const cancelledBookings = bookings.filter(
        (b: any) => b.status === "cancelled_by_user"
      ).length;
      const upcomingBookings = bookings.filter(
        (b: any) =>
          ["pending", "confirmed"].includes(b.status) &&
          new Date(b.booking_time) > new Date()
      ).length;
      const cuisineCounts: Record<string, number> = {};
      bookings.forEach((booking: any) => {
        if (booking.restaurant?.cuisine_type) {
          cuisineCounts[booking.restaurant.cuisine_type] =
            (cuisineCounts[booking.restaurant.cuisine_type] || 0) + 1;
        }
      });
      const mostVisitedCuisine =
        Object.entries(cuisineCounts).sort(
          ([, a], [, b]) => (b as number) - (a as number)
        )[0]?.[0] || "Not available";
      const restaurantCounts: Record<string, { name: string; visits: number }> =
        {};
      bookings.forEach((booking: any) => {
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
      const streakWeeks = calculateDiningStreak(bookings);
      setStats({
        totalBookings,
        completedBookings,
        cancelledBookings,
        upcomingBookings,
        favoriteRestaurants: favoritesResult.count || 0,
        totalReviews: reviewsResult.count || 0,
        averageSpending: 0,
        mostVisitedCuisine,
        mostVisitedRestaurant,
        diningStreak: streakWeeks,
        memberSince: profile.created_at || new Date().toISOString(),
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

  // Avatar upload
  const handleAvatarUpload = useCallback(async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload a profile picture."
      );
      return;
    }
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
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
        });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
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

  // Dining streak
  const calculateDiningStreak = (bookings: any[]) => {
    const sortedBookings = bookings
      .filter((b: any) => b.status === "completed")
      .sort(
        (a: any, b: any) =>
          new Date(b.booking_time).getTime() -
          new Date(a.booking_time).getTime()
      );
    if (sortedBookings.length === 0) return 0;
    let streak = 1;
    let currentWeek = getWeekNumber(new Date(sortedBookings[0].booking_time));
    for (let i = 1; i < sortedBookings.length; i++) {
      const bookingWeek = getWeekNumber(
        new Date(sortedBookings[i].booking_time)
      );
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
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Tier progress
  const calculateTierProgress = () => {
    const currentPoints = profile?.loyalty_points || 0;
    const currentTier = profile?.membership_tier || "bronze";
    const tiers = ["bronze", "silver", "gold", "platinum"] as const;
    const currentIndex = tiers.indexOf(currentTier as any);
    if (currentIndex === tiers.length - 1) {
      return { progress: 1, pointsToNext: 0, nextTier: null };
    }
    const nextTier = tiers[currentIndex + 1];
    const currentMin =
      LOYALTY_TIERS[currentTier as keyof typeof LOYALTY_TIERS].minPoints;
    const nextMin =
      LOYALTY_TIERS[nextTier as keyof typeof LOYALTY_TIERS].minPoints;
    const progress = (currentPoints - currentMin) / (nextMin - currentMin);
    const pointsToNext = nextMin - currentPoints;
    return { progress, pointsToNext, nextTier };
  };

  // Menu config
  const menuSections = (router: any) => [
    {
      title: "Account",
      items: [
        {
          id: "edit-profile",
          title: "Edit Profile",
          subtitle: "Update your personal information",
          icon: "Edit3",
          onPress: () => router.push("/profile/edit"),
        },
        {
          id: "rating-details",
          title: "Reliability Score",
          subtitle: ratingStats
            ? `${ratingStats.current_rating.toFixed(1)} stars • ${ratingStats.reliability_score}`
            : "View your booking reliability",
          icon: "BarChart3",
          onPress: () => router.push("/profile/rating-details"),
        },
        {
          id: "friends",
          title: "Friends",
          subtitle: `${stats.totalFriends} friends`,
          icon: "Users",
          onPress: () => router.push("/friends"),
          showBadge: stats.pendingFriendRequests > 0,
          badgeText: stats.pendingFriendRequests.toString(),
          badgeColor: "#dc2626",
        },
        {
          id: "preferences",
          title: "Dining Preferences",
          subtitle: "Allergies, dietary restrictions",
          icon: "Utensils",
          onPress: () => router.push("/profile/preferences"),
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "Manage your notification settings",
          icon: "Bell",
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
          icon: "Trophy",
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
          icon: "Gift",
          onPress: () => router.push("/profile/offers"),
        },
        {
          id: "reviews",
          title: "My Reviews",
          subtitle: `${stats.totalReviews} reviews written`,
          icon: "Star",
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
          icon: "TrendingUp",
          onPress: () => router.push("/profile/insights"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          title: "Help & Support",
          subtitle: "FAQs and contact support",
          icon: "HelpCircle",
          onPress: () => router.push("/profile/help"),
        },
        {
          id: "privacy",
          title: "Privacy & Security",
          subtitle: "Privacy policy and data settings",
          icon: "Shield",
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
          icon: "LogOut",
          onPress: async () => {
            Alert.alert("Sign Out", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Sign Out",
                style: "destructive",
                onPress: async () => {
                  try {
                    await Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Medium
                    );
                    await signOut();
                  } catch (error) {
                    Alert.alert("Error", "Failed to sign out");
                  }
                },
              },
            ]);
          },
          destructive: true,
        },
      ],
    },
  ];

  useEffect(() => {
    if (profile) {
      fetchProfileStats();
    }
  }, [profile, fetchProfileStats]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchProfileStats(), refreshRating()]);
  }, [fetchProfileStats, refreshRating]);

  return {
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
  };
};
