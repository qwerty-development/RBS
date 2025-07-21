// app/(protected)/booking/success.tsx
import React, { useEffect } from "react";
import { View, ScrollView, Share, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  CheckCircle,
  Clock,
  Home,
  MapPin,
  Share2,
  Users,
  Gift,
  Trophy,
  Sparkles,
  TableIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Confetti from "react-native-confetti";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { LoyaltyPointsCard } from "@/components/ui/loyalty-points-card";
import { useColorScheme } from "@/lib/useColorScheme";

interface BookingSuccessParams {
  bookingId: string;
  restaurantName: string;
  confirmationCode: string;
  earnedPoints?: string;
  appliedOffer?: string;
  invitedFriends?: string;
  isGroupBooking?: string;
  userTier?: string;
  offerTitle?: string;
  offerDiscount?: string;
  tableInfo?: string; // NEW: "single" or "combined"
}

export default function BookingSuccessScreen() {
  const params = useLocalSearchParams<BookingSuccessParams>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const confettiRef = React.useRef<any>(null);

  const earnedPoints = params.earnedPoints ? parseInt(params.earnedPoints) : 0;
  const hasOffer = params.appliedOffer === "true";
  const invitedFriendsCount = params.invitedFriends
    ? parseInt(params.invitedFriends)
    : 0;
  const isGroupBooking = params.isGroupBooking === "true";
  const offerDiscount = params.offerDiscount
    ? parseInt(params.offerDiscount)
    : 0;
  const tableInfo = params.tableInfo || "single";

  useEffect(() => {
    // Trigger confetti animation
    if (confettiRef.current) {
      confettiRef.current.startConfetti();
    }

    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Stop confetti after 3 seconds
    const timeout = setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.stopConfetti();
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  const handleShare = async () => {
    try {
      const message = `I just booked a table at ${params.restaurantName}! 🎉\nConfirmation: ${params.confirmationCode}${
        hasOffer ? `\nSaved ${offerDiscount}% with a special offer!` : ""
      }${
        isGroupBooking
          ? `\nDining with ${invitedFriendsCount} friend${invitedFriendsCount > 1 ? "s" : ""}`
          : ""
      }`;

      await Share.share({
        message,
        title: `Booking at ${params.restaurantName}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const navigateToBookingDetails = () => {
    router.replace({
      pathname: "/booking/[id]",
      params: { id: params.bookingId },
    });
  };

  const navigateToHome = () => {
    router.replace("/(protected)/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Confetti ref={confettiRef} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          {/* Success Animation Area */}
          <View className="items-center mb-8">
            <View className="bg-green-100 dark:bg-green-900/30 rounded-full p-6 mb-6">
              <CheckCircle size={80} color="#10b981" strokeWidth={2} />
            </View>

            <H1 className="text-3xl font-bold text-center mb-2">
              Booking Confirmed!
            </H1>
            <P className="text-center text-muted-foreground text-lg">
              Your table at {params.restaurantName} is reserved
            </P>
          </View>

          {/* Confirmation Code Card */}
          <View className="bg-card border-2 border-green-500 rounded-2xl p-6 mb-6">
            <View className="items-center">
              <Muted className="text-sm mb-2">Confirmation Code</Muted>
              <Text className="text-3xl font-bold tracking-wider text-green-600 dark:text-green-400">
                {params.confirmationCode}
              </Text>
              <Muted className="text-xs mt-2">
                Show this code at the restaurant
              </Muted>
            </View>
          </View>

          {/* Table Information Card - NEW */}
          {tableInfo && (
            <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3">
                <TableIcon size={24} color="#3b82f6" />
                <View className="flex-1">
                  <Text className="font-semibold text-blue-800 dark:text-blue-200">
                    Table Assignment
                  </Text>
                  <Text className="text-sm text-blue-700 dark:text-blue-300">
                    {tableInfo === "combined"
                      ? "Multiple tables will be combined for your party"
                      : "Single table reserved for your party"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Special Offer Applied Card */}
          {hasOffer && params.offerTitle && (
            <View className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-300 dark:border-green-700 rounded-xl p-4 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Gift size={20} color="#10b981" />
                  <Text className="font-semibold text-green-800 dark:text-green-200">
                    Special Offer Applied!
                  </Text>
                </View>
                <View className="bg-green-600 rounded-full px-3 py-1">
                  <Text className="text-white font-bold text-sm">
                    {offerDiscount}% OFF
                  </Text>
                </View>
              </View>
              <Text className="text-green-700 dark:text-green-300 text-sm">
                {params.offerTitle}
              </Text>
            </View>
          )}

          {/* Group Booking Info */}
          {isGroupBooking && (
            <View className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3">
                <Users size={24} color="#8b5cf6" />
                <View className="flex-1">
                  <Text className="font-semibold text-purple-800 dark:text-purple-200">
                    Group Booking Created
                  </Text>
                  <Text className="text-sm text-purple-700 dark:text-purple-300">
                    {invitedFriendsCount} friend
                    {invitedFriendsCount > 1 ? "s have" : " has"} been invited
                    to join you
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Loyalty Points Card */}
          {earnedPoints > 0 && (
            <LoyaltyPointsCard
              pointsEarned={earnedPoints}
              userTier={params.userTier || "bronze"}
              hasOffer={hasOffer}
            />
          )}

          {/* What's Next Section */}
          <View className="mt-8 mb-6">
            <H3 className="mb-4">What's Next?</H3>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <Calendar size={20} color="#6b7280" className="mt-1" />
                <View className="flex-1">
                  <Text className="font-medium">
                    We'll send you a reminder
                  </Text>
                  <Muted className="text-sm">
                    You'll receive a notification 2 hours before your
                    reservation
                  </Muted>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <MapPin size={20} color="#6b7280" className="mt-1" />
                <View className="flex-1">
                  <Text className="font-medium">Get directions</Text>
                  <Muted className="text-sm">
                    Check the booking details for maps and contact info
                  </Muted>
                </View>
              </View>

              {tableInfo === "combined" && (
                <View className="flex-row items-start gap-3">
                  <TableIcon size={20} color="#6b7280" className="mt-1" />
                  <View className="flex-1">
                    <Text className="font-medium">Table arrangement</Text>
                    <Muted className="text-sm">
                      The restaurant will prepare combined tables for your large party
                    </Muted>
                  </View>
                </View>
              )}

              {isGroupBooking && (
                <View className="flex-row items-start gap-3">
                  <Users size={20} color="#6b7280" className="mt-1" />
                  <View className="flex-1">
                    <Text className="font-medium">
                      Manage your group booking
                    </Text>
                    <Muted className="text-sm">
                      Track who's coming in the booking details
                    </Muted>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View className="p-6 border-t border-border">
        <Button
          onPress={navigateToBookingDetails}
          size="lg"
          className="w-full mb-3"
        >
          <Text className="text-white font-bold">View Booking Details</Text>
        </Button>

        <View className="flex-row gap-3">
          <Button
            variant="outline"
            onPress={navigateToHome}
            className="flex-1"
          >
            <Home size={20} />
            <Text className="ml-2">Home</Text>
          </Button>

          <Button variant="outline" onPress={handleShare} className="flex-1">
            <Share2 size={20} />
            <Text className="ml-2">Share</Text>
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}