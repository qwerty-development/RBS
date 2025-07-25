// app/(protected)/booking/request-sent.tsx
import React, { useEffect, useState } from "react";
import { View, ScrollView, Share, Alert, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  CheckCircle,
  Home,
  Share2,
  Bell,
  Calendar,
  Users,
  Timer,
  Info,
  Copy,
  Trophy,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

interface RequestSentParams {
  bookingId: string;
  restaurantName: string;
  bookingTime: string;
  bookingDate: string;
  partySize: string;
  confirmationCode: string;
}

type Booking = Database["public"]["Tables"]["bookings"]["Row"] & {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
};

interface LoyaltyRuleDetails {
  id: string;
  rule_name: string;
  points_to_award: number;
  restaurant_id: string;
}

// Component to show potential loyalty points
const PotentialLoyaltyPointsCard: React.FC<{
  expectedPoints: number;
  ruleName?: string;
}> = ({ expectedPoints, ruleName }) => {
  if (!expectedPoints || expectedPoints <= 0) return null;

  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-6">
      <View className="flex-row items-center mb-3">
        <Trophy size={20} color="#9333ea" />
        <Text className="font-semibold text-lg ml-2">Potential Rewards</Text>
      </View>
      
      <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
        <Text className="text-sm text-purple-900 dark:text-purple-100">
          If your booking is confirmed, you'll earn <Text className="font-bold">{expectedPoints} bonus points</Text>
          {ruleName && <Text> from "{ruleName}"</Text>}!
        </Text>
      </View>
      
      <View className="flex-row items-start mt-3">
        <Info size={14} color="#666" className="mt-0.5" />
        <Text className="text-xs text-muted-foreground ml-2 flex-1">
          Points will be added to your account automatically once the restaurant confirms your booking.
        </Text>
      </View>
    </View>
  );
};

export default function RequestSentScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<RequestSentParams>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  // State for booking data and loyalty details
  const [booking, setBooking] = useState<Booking | null>(null);
  const [expectedLoyaltyRule, setExpectedLoyaltyRule] = useState<LoyaltyRuleDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const bookingDate = new Date(params.bookingDate);
  const formattedDate = bookingDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Fetch booking data and loyalty details
  useEffect(() => {
    const fetchBookingData = async () => {
      if (!params.bookingId) return;

      try {
        setLoading(true);

        // Fetch booking with restaurant data
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(`
            *,
            restaurant:restaurants (*)
          `)
          .eq("id", params.bookingId)
          .single();

        if (bookingError) throw bookingError;
        setBooking(bookingData);

        // Fetch loyalty rule details if applicable
        if (bookingData?.applied_loyalty_rule_id && bookingData?.expected_loyalty_points) {
          const { data: ruleData, error: ruleError } = await supabase
            .from('restaurant_loyalty_rules')
            .select('id, rule_name, points_to_award, restaurant_id')
            .eq('id', bookingData.applied_loyalty_rule_id)
            .single();

          if (!ruleError && ruleData) {
            setExpectedLoyaltyRule(ruleData);
          }
        }
      } catch (error) {
        console.error('Error fetching booking data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingData();
  }, [params.bookingId]);

  useEffect(() => {
    // Success haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleShare = async () => {
    try {
      let message = `I've requested a table at ${params.restaurantName} for ${
        params.partySize
      } ${parseInt(params.partySize) === 1 ? "person" : "people"} on ${formattedDate} at ${
        params.bookingTime
      }. Awaiting confirmation! 🤞`;

      // Add loyalty points info if available
      if (booking?.expected_loyalty_points && booking.expected_loyalty_points > 0 && expectedLoyaltyRule) {
        message += ` If confirmed, I'll earn ${booking.expected_loyalty_points} bonus points from "${expectedLoyaltyRule.rule_name}"!`;
      }

      await Share.share({
        message,
        title: `Booking Request at ${params.restaurantName}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const copyConfirmationCode = async () => {
    await Clipboard.setStringAsync(params.confirmationCode);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `Reference code ${params.confirmationCode} copied to clipboard`,
    );
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
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 py-8">
          {/* Success Animation Area */}
          <View className="items-center mb-8">
            <View className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-6 mb-6">
              <Clock size={80} color="#f97316" strokeWidth={2} />
            </View>

            <H1 className="text-3xl font-bold text-center mb-2">
              Request Sent!
            </H1>
            <P className="text-center text-muted-foreground text-lg">
              Your booking request has been sent to {params.restaurantName}
            </P>
          </View>

          {/* Reference Code Card */}
          <View className="bg-card border-2 border-orange-500 rounded-2xl p-6 mb-6">
            <View className="items-center">
              <Muted className="text-sm mb-2">Reference Code</Muted>
              <Text className="text-3xl font-bold tracking-wider text-orange-600 dark:text-orange-400">
                {params.confirmationCode}
              </Text>
              <Pressable
                onPress={copyConfirmationCode}
                className="flex-row items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg"
              >
                <Copy size={16} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  Tap to copy
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Response Time Info */}
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
            <View className="flex-row items-center gap-3 mb-2">
              <Timer size={24} color="#3b82f6" />
              <Text className="font-semibold text-blue-800 dark:text-blue-200">
                Response Within 2 Hours
              </Text>
            </View>
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              The restaurant will review your request and confirm availability. 
              You'll receive a notification with their response.
            </Text>
          </View>

          {/* Booking Details */}
          <View className="bg-muted/30 rounded-xl p-4 mb-6">
            <H3 className="mb-3">Request Details</H3>
            
            <View className="space-y-3">
              <View className="flex-row items-center gap-3">
                <Calendar size={20} color="#666" />
                <View>
                  <Text className="font-medium">{formattedDate}</Text>
                  <Text className="text-sm text-muted-foreground">
                    at {params.bookingTime}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <Users size={20} color="#666" />
                <Text className="font-medium">
                  {params.partySize} {parseInt(params.partySize) === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
            </View>
          </View>

          {/* What Happens Next */}
          <View className="mb-6">
            <H3 className="mb-4">What Happens Next?</H3>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Restaurant Reviews</Text>
                  <Muted className="text-sm">
                    The restaurant will check availability and review your request
                  </Muted>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">You'll Be Notified</Text>
                  <Muted className="text-sm">
                    We'll send you a push notification and update your bookings
                  </Muted>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center">
                  <Text className="text-primary font-bold">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-medium">Confirmation or Alternative</Text>
                  <Muted className="text-sm">
                    If confirmed, you're all set! If not, try booking another time
                  </Muted>
                </View>
              </View>
            </View>
          </View>

          {/* Potential Loyalty Points Card */}
          {!loading && booking?.expected_loyalty_points && booking.expected_loyalty_points > 0 && (
            <PotentialLoyaltyPointsCard
              expectedPoints={booking.expected_loyalty_points}
              ruleName={expectedLoyaltyRule?.rule_name}
            />
          )}

          {/* Tips */}
          <View className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6">
            <View className="flex-row items-start gap-2">
              <Info size={20} color="#f59e0b" className="mt-0.5" />
              <View className="flex-1">
                <Text className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Pro Tip
                </Text>
                <Text className="text-sm text-amber-700 dark:text-amber-300">
                  Enable push notifications to get instant updates about your booking request
                  {booking?.expected_loyalty_points && booking.expected_loyalty_points > 0 && 
                    " and earn your bonus loyalty points when confirmed"
                  }
                </Text>
              </View>
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
          <Text className="text-white font-bold">View Request Details</Text>
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

        <View className="flex-row items-center justify-center gap-2 mt-4">
          <Bell size={16} color="#666" />
          <Text className="text-sm text-muted-foreground text-center">
            We'll notify you as soon as the restaurant responds
            {booking?.expected_loyalty_points && booking.expected_loyalty_points > 0 && 
              " and award your bonus points"
            }
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}