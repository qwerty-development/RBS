// app/(protected)/booking/success.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  TableIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Confetti from "react-native-confetti";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3, P, Muted } from "@/components/ui/typography";
import { LoyaltyPointsCard } from "@/components/ui/loyalty-points-card";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { LoyaltyRuleDetails } from "@/hooks/useRestaurantLoyalty";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";

interface BookingSuccessParams {
  bookingId: string;
  restaurantName: string;
  restaurantId?: string;
  confirmationCode: string;
  earnedPoints?: string;
  appliedOffer?: string;
  invitedFriends?: string;
  isGroupBooking?: string;
  userTier?: string;
  offerTitle?: string;
  offerDiscount?: string;
  tableInfo?: string; // "single" or "combined"
  bookingDate?: string;
  bookingTime?: string;
  // Restaurant loyalty parameters
  restaurantLoyaltyPoints?: string;
  loyaltyRuleId?: string;
  loyaltyRuleName?: string;
}

// Restaurant Loyalty Notification Component
const RestaurantLoyaltyNotification: React.FC<{
  points: number;
  ruleName: string;
  restaurantName: string;
}> = ({ points, ruleName, restaurantName }) => {
  if (!points || points <= 0) return null;

  return (
    <View className="mb-6">
      <View className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-0.5">
        <View className="bg-background rounded-xl p-4">
          <View className="flex-row items-center mb-3">
            <View className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-2">
              <Trophy size={24} color="#9333ea" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-bold text-lg">
                {points} Bonus Points Earned!
              </Text>
              <Text className="text-sm text-muted-foreground">
                From &quot;{ruleName}&quot;
              </Text>
            </View>
            <View className="bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-full">
              <Text className="text-green-700 dark:text-green-300 font-semibold">
                +{points}
              </Text>
            </View>
          </View>

          <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <Text className="text-sm text-purple-900 dark:text-purple-100">
              🎉 These bonus points were awarded by {restaurantName} for booking
              during their special promotion time!
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function BookingSuccessScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<any>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const confettiRef = React.useRef<any>(null);

  // State
  const [appliedLoyaltyRule, setAppliedLoyaltyRule] =
    useState<LoyaltyRuleDetails | null>(null);
  const [restaurantLoyaltyPoints, setRestaurantLoyaltyPoints] =
    useState<number>(0);
  const [offerDetails, setOfferDetails] = useState<{
    estimatedSavings: number;
    title: string;
  } | null>(null);
  const [loyaltyDataFetched, setLoyaltyDataFetched] = useState(false);
  const [restaurantData, setRestaurantData] = useState<any>(null);

  // Parse params once
  const parsedParams = useMemo(
    () => ({
      earnedPoints: params.earnedPoints ? parseInt(params.earnedPoints) : 0,
      hasOffer: params.appliedOffer === "true",
      invitedFriendsCount: params.invitedFriends
        ? parseInt(params.invitedFriends)
        : 0,
      isGroupBooking: params.isGroupBooking === "true",
      offerDiscount: params.offerDiscount ? parseInt(params.offerDiscount) : 0,
      tableInfo: params.tableInfo || "single",
    }),
    [params],
  );

  // Initialize restaurant loyalty points from params
  useEffect(() => {
    let loyaltyPoints = 0;
    if (params.restaurantLoyaltyPoints) {
      const points = parseInt(params.restaurantLoyaltyPoints);
      if (!isNaN(points)) {
        loyaltyPoints = points;
      }
    }
    setRestaurantLoyaltyPoints(loyaltyPoints);

    // Set loyalty rule if provided in params
    if (params.loyaltyRuleId && params.loyaltyRuleName) {
      setAppliedLoyaltyRule({
        id: params.loyaltyRuleId,
        rule_name: params.loyaltyRuleName,
        points_to_award: loyaltyPoints,
        restaurant_id: "",
      });
      setLoyaltyDataFetched(true);
    }
  }, [
    params.restaurantLoyaltyPoints,
    params.loyaltyRuleId,
    params.loyaltyRuleName,
  ]);

  // Fetch restaurant data for directions
  useEffect(() => {
    if (!params.bookingId) return;

    const fetchRestaurantData = async () => {
      try {
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(
            `
            restaurant_id,
            restaurant:restaurants (
              id,
              name,
              address,
              location,
              staticCoordinates,
              coordinates
            )
          `,
          )
          .eq("id", params.bookingId)
          .single();

        if (!bookingError && bookingData?.restaurant) {
          setRestaurantData(bookingData.restaurant);
        }
      } catch (err) {
        console.error("Error fetching restaurant data:", err);
      }
    };

    fetchRestaurantData();
  }, [params.bookingId]);

  // Fetch detailed loyalty rule information if not provided in params
  useEffect(() => {
    if (!params.bookingId || loyaltyDataFetched) return;

    const fetchLoyaltyRuleDetails = async () => {
      try {
        // Fetch booking details to get loyalty rule info
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select("applied_loyalty_rule_id, loyalty_points_earned")
          .eq("id", params.bookingId)
          .single();

        if (bookingError || !bookingData?.applied_loyalty_rule_id) {
          setLoyaltyDataFetched(true);
          return;
        }

        // Fetch loyalty rule details
        const { data: ruleData, error: ruleError } = await supabase
          .from("restaurant_loyalty_rules")
          .select("id, rule_name, points_to_award, restaurant_id")
          .eq("id", bookingData.applied_loyalty_rule_id)
          .single();

        if (!ruleError && ruleData) {
          setAppliedLoyaltyRule(ruleData);
          setRestaurantLoyaltyPoints(bookingData.loyalty_points_earned || 0);
        }

        setLoyaltyDataFetched(true);
      } catch (err) {
        console.error("Error fetching loyalty rule details:", err);
        setLoyaltyDataFetched(true);
      }
    };

    fetchLoyaltyRuleDetails();
  }, [params.bookingId, loyaltyDataFetched]);

  // Calculate offer details for value summary
  useEffect(() => {
    if (parsedParams.hasOffer && params.offerTitle) {
      // Estimate savings based on party size and discount
      const partySize = parsedParams.invitedFriendsCount + 1;
      const estimatedMealCost = partySize * 30; // Rough estimate $30 per person
      const estimatedSavings =
        (estimatedMealCost * parsedParams.offerDiscount) / 100;

      setOfferDetails({
        estimatedSavings,
        title: params.offerTitle,
      });
    }
  }, [
    parsedParams.hasOffer,
    params.offerTitle,
    parsedParams.offerDiscount,
    parsedParams.invitedFriendsCount,
  ]);

  // Confetti and haptic effects
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

  // Enhanced share message with restaurant loyalty
  const shareMessage = useMemo(() => {
    let message = `I just booked a table at ${params.restaurantName}! 🎉\nConfirmation: ${params.confirmationCode}`;

    if (parsedParams.hasOffer) {
      message += `\nSaved ${parsedParams.offerDiscount}% with a special offer!`;
    }

    if (parsedParams.isGroupBooking) {
      message += `\nDining with ${parsedParams.invitedFriendsCount} friend${parsedParams.invitedFriendsCount > 1 ? "s" : ""}`;
    }

    if (parsedParams.earnedPoints > 0) {
      message += `\nEarned ${parsedParams.earnedPoints} platform points!`;
    }

    if (restaurantLoyaltyPoints > 0 && appliedLoyaltyRule) {
      message += `\nPlus ${restaurantLoyaltyPoints} bonus points from "${appliedLoyaltyRule.rule_name}"!`;
    }

    return message;
  }, [
    params.restaurantName,
    params.confirmationCode,
    parsedParams.hasOffer,
    parsedParams.offerDiscount,
    parsedParams.isGroupBooking,
    parsedParams.invitedFriendsCount,
    parsedParams.earnedPoints,
    restaurantLoyaltyPoints,
    appliedLoyaltyRule,
  ]);

  // Navigation handlers
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${params.restaurantName}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [shareMessage, params.restaurantName]);

  const navigateToBookingDetails = useCallback(() => {
    router.replace({
      pathname: "/booking/[id]",
      params: { id: params.bookingId },
    });
  }, [router, params.bookingId]);

  const navigateToHome = useCallback(() => {
    router.replace("/(protected)/(tabs)");
  }, [router]);

  if (!isMounted) {
    return null;
  }

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

          {/* Prominent Date and Time Display */}
          <View className="bg-card rounded-2xl p-6 mb-6 border border-border">
            <View className="items-center">
              <Muted className="text-sm mb-2">YOUR RESERVATION</Muted>
              <View className="flex-row items-center justify-center gap-2 mb-2">
                <Calendar
                  size={18}
                  color={colorScheme === "dark" ? "#9ca3af" : "#6b7280"}
                />
                <Text className="text-xl font-bold">
                  {new Date(params.bookingDate || "").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    },
                  )}
                </Text>
              </View>
              <View className="flex-row items-center justify-center gap-2">
                <Clock
                  size={18}
                  color={colorScheme === "dark" ? "#9ca3af" : "#6b7280"}
                />
                <Text className="text-3xl font-extrabold text-primary">
                  {params.bookingTime}
                </Text>
              </View>
            </View>
          </View>

          {/* Table Information Card */}
          {parsedParams.tableInfo && (
            <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3">
                <TableIcon size={24} color="#3b82f6" />
                <View className="flex-1">
                  <Text className="font-semibold text-blue-800 dark:text-blue-200">
                    Table Assignment
                  </Text>
                  <Text className="text-sm text-blue-700 dark:text-blue-300">
                    {parsedParams.tableInfo === "combined"
                      ? "Multiple tables will be combined for your party"
                      : "Single table reserved for your party"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Special Offer Applied Card */}
          {parsedParams.hasOffer && params.offerTitle && (
            <View className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-300 dark:border-700 rounded-xl p-4 mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <Gift size={20} color="#10b981" />
                  <Text className="font-semibold text-green-800 dark:text-green-200">
                    Special Offer Applied!
                  </Text>
                </View>
                <View className="bg-green-600 rounded-full px-3 py-1">
                  <Text className="text-white font-bold text-sm">
                    {parsedParams.offerDiscount}% OFF
                  </Text>
                </View>
              </View>
              <Text className="text-green-700 dark:text-green-300 text-sm">
                {params.offerTitle}
              </Text>
            </View>
          )}

          {/* Group Booking Info */}
          {parsedParams.isGroupBooking && (
            <View className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3">
                <Users size={24} color="#8b5cf6" />
                <View className="flex-1">
                  <Text className="font-semibold text-purple-800 dark:text-purple-200">
                    Group Booking Created
                  </Text>
                  <Text className="text-sm text-purple-700 dark:text-purple-300">
                    {parsedParams.invitedFriendsCount} friend
                    {parsedParams.invitedFriendsCount > 1
                      ? "s have"
                      : " has"}{" "}
                    been invited to join you
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Restaurant Loyalty Notification */}
          {appliedLoyaltyRule && restaurantLoyaltyPoints > 0 && (
            <RestaurantLoyaltyNotification
              points={restaurantLoyaltyPoints}
              ruleName={appliedLoyaltyRule.rule_name}
              restaurantName={params.restaurantName}
            />
          )}

          {/* Platform Loyalty Points Card */}
          {parsedParams.earnedPoints > 0 && (
            <LoyaltyPointsCard
              pointsEarned={parsedParams.earnedPoints}
              userTier={params.userTier || "bronze"}
              hasOffer={parsedParams.hasOffer}
            />
          )}

          {/* Enhanced Value Summary */}

          {/* What's Next Section */}
          <View className="mt-8 mb-6">
            <H3 className="mb-4">What's Next?</H3>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <Calendar size={20} color="#6b7280" className="mt-1" />
                <View className="flex-1">
                  <Text className="font-medium">
                    We&apos;ll send you a reminder
                  </Text>
                  <Muted className="text-sm">
                    You&apos;ll receive a notification 2 hours before your
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
                  {restaurantData && (
                    <View className="mt-2">
                      <DirectionsButton
                        restaurant={restaurantData}
                        variant="button"
                        size="sm"
                        backgroundColor="bg-primary/10"
                        borderColor="border-primary/20"
                        iconColor="#3b82f6"
                        textColor="text-primary"
                        className="w-fit"
                      />
                    </View>
                  )}
                </View>
              </View>

              {parsedParams.tableInfo === "combined" && (
                <View className="flex-row items-start gap-3">
                  <TableIcon size={20} color="#6b7280" className="mt-1" />
                  <View className="flex-1">
                    <Text className="font-medium">Table arrangement</Text>
                    <Muted className="text-sm">
                      The restaurant will prepare combined tables for your large
                      party
                    </Muted>
                  </View>
                </View>
              )}

              {parsedParams.isGroupBooking && (
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

              {/* Restaurant loyalty next steps */}
              {restaurantLoyaltyPoints > 0 && (
                <View className="flex-row items-start gap-3">
                  <Trophy size={20} color="#6b7280" className="mt-1" />
                  <View className="flex-1">
                    <Text className="font-medium">Use your bonus points</Text>
                    <Muted className="text-sm">
                      Your restaurant loyalty points can be used for future
                      bookings at {params.restaurantName}
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
          <Button variant="outline" onPress={navigateToHome} className="flex-1">
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
