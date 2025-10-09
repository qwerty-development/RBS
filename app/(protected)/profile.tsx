// app/(protected)/profile.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
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
  Bot,
  KeyRound,
  User, // Added for guest view
  Heart,
  ChevronLeft, // Added for guest view
  Camera, // Added for my posts
  ClockIcon, // Added for waitlist
  CheckCircle, // Added for phone verification
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useUserRating } from "@/hooks/useUserRating";
import ProfileScreenSkeleton from "@/components/skeletons/ProfileScreenSkeleton";
import { PhoneVerificationModal } from "@/components/auth/PhoneVerificationModal";

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
  ClockIcon,
  CreditCard,
  UserPlus,
  MessageCircle,
  Award,
  Bot,
  KeyRound,
  User,
  Heart,
  Camera,
};

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  showBadge?: boolean;
  badgeText?: string;
  badgeColor?: string;
  destructive?: boolean;
}

export default function ProfileScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const { profile, signOut, initialized, isGuest, convertGuestToUser, refreshProfile } =
    useAuth();

  // --- Guest View ---
  // If the user is a guest, display a call-to-action screen.
  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="p-4">
          <H2>Profile</H2>
        </View>

        <View className="flex-1 items-center justify-center px-6 -mt-10">
          <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
            <User size={48} className="text-primary" />
          </View>

          <H2 className="text-center mb-2">Create Your Profile</H2>
          <P className="text-center text-muted-foreground mb-8">
            Sign up to unlock personalized recommendations, save your favorites,
            earn loyalty points, and much more!
          </P>

          <View className="w-full max-w-sm">
            <Button onPress={convertGuestToUser} size="lg">
              <UserPlus size={20} color="#fff" />
              <Text className="ml-2 font-bold text-white">Sign Up Now</Text>
            </Button>

            <View className="mt-8 gap-4">
              <View className="flex-row items-center">
                <Heart size={20} className="text-red-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Save your favorite restaurants
                </Text>
              </View>
              <View className="flex-row items-center">
                <Trophy size={20} className="text-yellow-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Earn loyalty points & rewards
                </Text>
              </View>
              <View className="flex-row items-center">
                <Clock size={20} className="text-blue-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Quick & easy reservations
                </Text>
              </View>
              <View className="flex-row items-center">
                <Bell size={20} className="text-green-500" />
                <Text className="ml-3 flex-1 text-muted-foreground">
                  Get exclusive offers & updates
                </Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Authenticated User View ---
  // The rest of the logic is for authenticated users.
  const userRating = useUserRating();
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await userRating.refresh();
    setRefreshing(false);
  }, [userRating]);

  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  }, [signOut, router]);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingAvatar(true);
      try {
        const image = result.assets[0];
        const fileExt = image.uri.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const formData = new FormData();
        formData.append("file", {
          uri: image.uri,
          type: `image/${fileExt}`,
          name: fileName,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, formData);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", profile?.id);
        if (updateError) throw updateError;

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch (error) {
        console.error("Error uploading avatar:", error);
        Alert.alert("Error", "Failed to upload avatar");
      } finally {
        setUploadingAvatar(false);
      }
    }
  }, [profile?.id]);

  const menuSections: { title: string; items: MenuItem[] }[] = [
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
          id: "phone-verification",
          title: profile?.phone_verified ? "Phone Verified" : "Verify Phone Number",
          subtitle: profile?.phone_verified
            ? profile.phone_number || "Verified"
            : "Required for bookings",
          icon: "Shield",
          onPress: () => {
            if (!profile?.phone_verified) {
              setShowPhoneVerification(true);
            }
          },
          showBadge: !profile?.phone_verified,
          badgeText: "Required",
          badgeColor: "#eab308",
        },
        {
          id: "notifications",
          title: "Notifications",
          subtitle: "Manage your notification preferences",
          icon: "Bell",
          onPress: () => router.push("/profile/notifications"),
        },
        {
          id: "preferences",
          title: "Preferences",
          subtitle: "Customize your experience",
          icon: "Star",
          onPress: () => router.push("/profile/preferences"),
        },

        {
          id: "reset-password",
          title: "Reset Password",
          subtitle: "Update your password",
          icon: "KeyRound",
          onPress: () =>
            router.push({
              pathname: "/password-reset",
              params: { from: "profile" },
            }),
        },
      ],
    },
    {
      title: "Activity",
      items: [
        {
          id: "insights",
          title: "My Insights",
          subtitle: "View your dining analytics",
          icon: "BarChart3",
          onPress: () => router.push("/profile/insights"),
        },
        {
          id: "reviews",
          title: "My Reviews",
          subtitle: "Reviews you've written",
          icon: "MessageCircle",
          onPress: () => router.push("/profile/reviews"),
        },
        {
          id: "waitlist",
          title: "My Waitlist",
          subtitle: "View your restaurant waitlist entries",
          icon: "ClockIcon",
          onPress: () => router.push("/(protected)/waitlist"),
        },
        {
          id: "loyalty",
          title: "Loyalty & Rewards",
          subtitle: `${profile?.loyalty_points || 0} points available`,
          icon: "Trophy",
          onPress: () => router.push("/profile/loyalty"),
        },
      ],
    },
    {
      title: "Social",
      items: [
        {
          id: "friends",
          title: "Friends",
          subtitle: "Manage your connections",
          icon: "Users",
          onPress: () => router.push("/friends"),
        },

        {
          id: "blocked-users",
          title: "Blocked Users",
          subtitle: "Manage blocked accounts",
          icon: "Shield",
          onPress: () => router.push("/profile/blocked-users"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          id: "help",
          title: "Help & Support",
          subtitle: "Get help when you need it",
          icon: "HelpCircle",
          onPress: () => router.push("/profile/help"),
        },
        {
          id: "privacy",
          title: "Privacy & Security",
          subtitle: "Privacy settings, data management & account deletion",
          icon: "Shield",
          onPress: () => router.push("/profile/privacy"),
        },
      ],
    },
    {
      title: "Account Actions",
      items: [
        {
          id: "sign-out",
          title: "Sign Out",
          icon: "LogOut",
          onPress: handleSignOut,
          destructive: true,
        },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    const IconComponent = iconMap[item.icon];
    return (
      <Pressable
        key={item.id}
        onPress={item.onPress}
        className={`flex-row items-center justify-between p-4 bg-card border-b border-border/50 ${
          item.destructive ? "bg-red-50 dark:bg-red-950/20" : ""
        }`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              item.destructive ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
            }`}
          >
            <IconComponent
              size={20}
              color={
                item.destructive
                  ? "#ef4444"
                  : colorScheme === "dark"
                    ? "#fff"
                    : "#000"
              }
            />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className={`font-medium ${
                  item.destructive ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {item.title}
              </Text>
              {item.showBadge && (
                <View
                  style={{ backgroundColor: item.badgeColor || "#eab308" }}
                  className="px-2 py-0.5 rounded-full"
                >
                  <Text className="text-xs font-bold text-white">
                    {item.badgeText || "New"}
                  </Text>
                </View>
              )}
            </View>
            {item.subtitle && (
              <Muted className="text-sm mt-0.5">{item.subtitle}</Muted>
            )}
          </View>
        </View>
        {!item.destructive && profile?.phone_verified && item.id === "phone-verification" && (
          <CheckCircle size={20} color="#22c55e" />
        )}
        {!item.destructive && item.id !== "phone-verification" && (
          <ChevronRight size={20} color="#666" />
        )}
      </Pressable>
    );
  };

  if (!initialized || userRating.loading) {
    return <ProfileScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Spacer to avoid overlap with floating back button */}

      {/* Floating Back Button (consistent with other pages) */}
      <View className="absolute top-0 left-0 right-0 z-50">
        <SafeAreaView edges={["top"]}>
          <View className="p-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
      >
        <View className="items-center py-8 px-4 bg-card border-b border-border">
          <Pressable onPress={pickImage} disabled={uploadingAvatar}>
            <View className="relative">
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require("@/assets/default-avatar.jpeg")
                }
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 3,
                  borderColor: colorScheme === "dark" ? "#333" : "#e5e5e5",
                }}
                contentFit="cover"
              />
              {uploadingAvatar && (
                <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                  <Text className="text-white text-xs">Uploading...</Text>
                </View>
              )}
              <View className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-background">
                <Edit3 size={16} color="white" />
              </View>
            </View>
          </Pressable>
          <H2 className="mt-4 text-center">
            {profile?.full_name || "Loading..."}
          </H2>
          <View className="flex-row items-center mt-3 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text className="ml-1 font-medium text-yellow-700 dark:text-yellow-300">
              {userRating.currentRating.toFixed(1)} Rating
            </Text>
          </View>
          <Text className="text-center mt-2 text-sm text-muted-foreground">
            {profile?.loyalty_points || 0} loyalty points
          </Text>
        </View>

        {menuSections.map((section) => (
          <View key={section.title} className="mt-6">
            <H3 className="px-4 mb-3 text-lg font-semibold">{section.title}</H3>
            <View className="bg-card border-t border-b border-border">
              {section.items.map(renderMenuItem)}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        visible={showPhoneVerification}
        onClose={() => setShowPhoneVerification(false)}
        onVerified={async () => {
          await refreshProfile();
          setShowPhoneVerification(false);
        }}
        canSkip={false}
        title="Verify Your Phone Number"
        description="Your phone number is required for making restaurant bookings. Once verified, you cannot change it."
        initialPhoneNumber={profile?.phone_number}
      />
    </SafeAreaView>
  );
}
