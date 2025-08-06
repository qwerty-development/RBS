// app/(protected)/booking/[id].tsx - Updated with restaurant loyalty support
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Share2,
  Copy,
  Calendar,
  Clock,
  Users,
  Timer,
  Bell,
  XCircle,
  RefreshCw,
  Trophy,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P } from "@/components/ui/typography";
import { LoyaltyPointsCard } from "@/components/ui/loyalty-points-card";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";

// Import components
import {
  BookingDetailsHeader,
  BookingActionsBar,
  BookingMapSection,
  BookingContactSection,
  BookingSpecialRequests,
  AppliedOfferCard,
} from "@/components/booking";
import { BookingTableInfo } from "@/components/booking/BookingTableInfo";

// Import custom hook
import { useBookingDetails } from "@/hooks/useBookingDetails";

// Import constants
import { BOOKING_STATUS_CONFIG } from "@/constants/bookingConstants";
import BookingDetailsScreenSkeleton from "@/components/skeletons/BookingDetailsScreenSkeleton";

// Types
interface LoyaltyRuleDetails {
  id: string;
  rule_name: string;
  points_to_award: number;
  restaurant_id: string;
}

// Component to show restaurant loyalty status
const RestaurantLoyaltyStatus: React.FC<{
  booking: any;
  rule: LoyaltyRuleDetails | null;
  wasRefunded: boolean;
}> = ({ booking, rule, wasRefunded }) => {
  if (!rule) return null;

  const isPending = booking.status === "pending";
  const isConfirmed = booking.status === "confirmed";
  const isCancelled =
    booking.status === "cancelled_by_user" ||
    booking.status === "declined_by_restaurant";
  const isCompleted = booking.status === "completed";

  return (
    <View className="mx-4 mb-6">
      <View
        className={`border rounded-xl p-4 ${
          isCancelled
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : isPending
              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
              : "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
        }`}
      >
        <View className="flex-row items-center mb-2">
          <Trophy
            size={20}
            color={isCancelled ? "#dc2626" : isPending ? "#f97316" : "#9333ea"}
          />
          <Text className="font-semibold text-lg ml-2">
            {isPending
              ? "Potential Loyalty Points"
              : isCancelled
                ? "Loyalty Points Status"
                : "Loyalty Points Earned"}
          </Text>
        </View>

        <View className="space-y-2">
          <Text
            className={`text-sm ${
              isCancelled
                ? "text-red-700 dark:text-red-300"
                : isPending
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-purple-700 dark:text-purple-300"
            }`}
          >
            {isPending ? (
              <>
                You'll earn{" "}
                <Text className="font-bold">
                  {booking.expected_loyalty_points || rule.points_to_award}{" "}
                  points
                </Text>{" "}
                from "{rule.rule_name}" if confirmed
              </>
            ) : isCancelled ? (
              wasRefunded ? (
                <>
                  The {booking.loyalty_points_earned || 0} points from "
                  {rule.rule_name}" have been refunded to the restaurant
                </>
              ) : (
                <>No points were awarded for this cancelled booking</>
              )
            ) : (
              <>
                You earned{" "}
                <Text className="font-bold">
                  {booking.loyalty_points_earned} points
                </Text>{" "}
                from "{rule.rule_name}"
              </>
            )}
          </Text>

          {isCancelled && wasRefunded && (
            <View className="flex-row items-start mt-2">
              <AlertCircle size={14} color="#dc2626" className="mt-0.5" />
              <Text className="text-xs text-red-600 dark:text-red-400 ml-2 flex-1">
                Points have been deducted from your account balance
              </Text>
            </View>
          )}

          {isPending && (
            <View className="flex-row items-start mt-2">
              <Timer size={14} color="#f97316" className="mt-0.5" />
              <Text className="text-xs text-orange-600 dark:text-orange-400 ml-2 flex-1">
                Points will be automatically added when your booking is
                confirmed
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default function BookingDetailsScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  // Restaurant loyalty state
  const [restaurantLoyaltyRule, setRestaurantLoyaltyRule] =
    useState<LoyaltyRuleDetails | null>(null);
  const [wasLoyaltyRefunded, setWasLoyaltyRefunded] = useState<boolean>(false);

  // Use custom hook for all booking logic
  const {
    booking,
    loading,
    processing,
    hasReview,
    loyaltyActivity,
    appliedOfferDetails,
    assignedTables,
    isUpcoming,
    isToday,
    isTomorrow,
    cancelBooking,
    copyOfferCode,
    refetch,
  } = useBookingDetails(params.id || "");

  // Fetch restaurant loyalty details
  useEffect(() => {
    const fetchRestaurantLoyaltyDetails = async () => {
      if (!booking?.applied_loyalty_rule_id) return;

      try {
        const { data: ruleData, error } = await supabase
          .from("restaurant_loyalty_rules")
          .select("id, rule_name, points_to_award, restaurant_id")
          .eq("id", booking.applied_loyalty_rule_id)
          .single();

        if (!error && ruleData) {
          setRestaurantLoyaltyRule(ruleData);
        }

        // Check if loyalty was refunded (for cancelled bookings)
        if (
          booking.status === "cancelled_by_user" ||
          booking.status === "declined_by_restaurant"
        ) {
          const { data: refundData } = await supabase
            .from("restaurant_loyalty_transactions")
            .select("*")
            .eq("booking_id", booking.id)
            .eq("transaction_type", "refund")
            .single();

          if (refundData) {
            setWasLoyaltyRefunded(true);
          }
        }
      } catch (err) {
        console.error("Error fetching restaurant loyalty details:", err);
      }
    };

    fetchRestaurantLoyaltyDetails();
  }, [booking?.applied_loyalty_rule_id, booking?.status, booking?.id]);

  // Additional state for pending bookings
  const isPending = booking?.status === "pending";
  const isDeclined = booking?.status === "declined_by_restaurant";
  const isCancelled =
    booking?.status === "cancelled_by_user" ||
    booking?.status === "declined_by_restaurant";
  const timeSinceRequest =
    isPending && booking
      ? Math.floor(
          (Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60),
        )
      : 0;
  const timeRemaining = isPending ? Math.max(0, 120 - timeSinceRequest) : 0;

  // Navigation handlers
  const navigateToReview = () => {
    if (!booking) return;

    router.push({
      pathname: "/review/create",
      params: {
        bookingId: booking.id,
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        earnedPoints: loyaltyActivity?.points_earned?.toString() || "0",
      },
    });
  };

  const navigateToRestaurant = () => {
    if (!booking) return;
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: booking.restaurant_id },
    });
  };

  const navigateToLoyalty = () => {
    router.push("/profile/loyalty");
  };

  const navigateToOffers = () => {
    router.push("/offers");
  };

  const bookAgain = () => {
    if (!booking) return;
    router.push({
      pathname: "/booking/availability",
      params: {
        restaurantId: booking.restaurant_id,
        restaurantName: booking.restaurant.name,
        partySize: booking.party_size.toString(),
      },
    });
  };

  // Enhanced share booking with restaurant loyalty
  const shareBooking = async () => {
    if (!booking) return;

    const statusText = isPending
      ? "I've requested a table"
      : isDeclined
        ? "My booking request was declined"
        : "I have a reservation";

    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";

    const pointsText = (() => {
      if (
        isPending &&
        booking.expected_loyalty_points > 0 &&
        restaurantLoyaltyRule
      ) {
        return ` If confirmed, I'll earn ${booking.expected_loyalty_points} bonus points from "${restaurantLoyaltyRule.rule_name}"!`;
      } else if (
        booking.loyalty_points_earned > 0 &&
        restaurantLoyaltyRule &&
        !isCancelled
      ) {
        return ` I also earned ${booking.loyalty_points_earned} bonus points from "${restaurantLoyaltyRule.rule_name}"!`;
      }
      return "";
    })();

    const shareMessage = `${statusText} at ${booking.restaurant.name} on ${new Date(
      booking.booking_time,
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time,
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
      booking.party_size
    } people.${offerText}${pointsText}${
      booking.confirmation_code && !isPending
        ? ` Confirmation code: ${booking.confirmation_code}`
        : ""
    }`;

    try {
      await Share.share({
        message: shareMessage,
        title: `Booking at ${booking.restaurant.name}`,
      });
    } catch (error) {
      console.error("Error sharing booking:", error);
    }
  };

  // Copy confirmation code
  const copyConfirmationCode = async () => {
    if (!booking?.confirmation_code) return;

    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `${isPending ? "Reference" : "Confirmation"} code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  // Share applied offer
  const shareAppliedOffer = async () => {
    if (!appliedOfferDetails || !booking) return;

    try {
      await Share.share({
        message: `I saved ${appliedOfferDetails.discount_percentage}% at ${booking.restaurant.name} with a special offer! 🎉 Check out the app for more deals.`,
        title: "Great Deal Alert!",
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  };

  // Loading state
  if (loading || !isMounted) {
    return <BookingDetailsScreenSkeleton />;
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Booking not found</H3>
          <P className="text-center text-muted-foreground mb-4">
            The booking you're looking for doesn't exist or has been removed.
          </P>
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = BOOKING_STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;
  const bookingDate = new Date(booking.booking_time);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft size={24} />
        </Pressable>
        <H2>Booking Details</H2>
        <Pressable onPress={shareBooking} className="p-2 -mr-2">
          <Share2 size={24} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Restaurant Header */}
        <BookingDetailsHeader
          restaurant={booking.restaurant}
          appliedOfferDetails={appliedOfferDetails}
          loyaltyActivity={loyaltyActivity}
          onPress={navigateToRestaurant}
        />

        {/* Status Section */}
        <View className="p-4 border-b border-border">
          <View
            className="p-4 rounded-lg"
            style={{ backgroundColor: statusConfig.bgColor }}
          >
            <View className="flex-row items-center gap-3 mb-2">
              <StatusIcon size={24} color={statusConfig.color} />
              <Text
                className="font-bold text-lg"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </Text>
            </View>
            <Text className="text-sm" style={{ color: statusConfig.color }}>
              {statusConfig.description}
            </Text>
          </View>

          {/* Pending Status Extra Info */}
          {isPending && (
            <View className="mt-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Timer size={20} color="#f97316" />
                <Text className="font-semibold text-orange-800 dark:text-orange-200">
                  Response Expected Soon
                </Text>
              </View>
              <Text className="text-sm text-orange-700 dark:text-orange-300">
                The restaurant typically responds within {timeRemaining}{" "}
                minutes. We'll notify you immediately when they confirm.
              </Text>
              <View className="flex-row items-center gap-2 mt-3">
                <Bell size={16} color="#f97316" />
                <Text className="text-xs text-orange-600 dark:text-orange-400">
                  Push notifications enabled
                </Text>
              </View>
            </View>
          )}

          {/* Declined Status Extra Info */}
          {isDeclined && (
            <View className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <Text className="text-sm text-red-700 dark:text-red-300 mb-3">
                The restaurant couldn't accommodate your request at this time.
                This could be due to full capacity or special events.
              </Text>
              <Button
                variant="default"
                size="sm"
                onPress={bookAgain}
                className="w-full"
              >
                <RefreshCw size={16} color="white" />
                <Text className="ml-2 text-white font-medium">
                  Try Different Time
                </Text>
              </Button>
            </View>
          )}
        </View>

        {/* Restaurant Loyalty Status */}
        <RestaurantLoyaltyStatus
          booking={booking}
          rule={restaurantLoyaltyRule}
          wasRefunded={wasLoyaltyRefunded}
        />

        {/* Rewards Section - Only show for confirmed bookings */}
        {booking.status === "confirmed" && (
          <View className="p-4">
            {/* Applied Offer Card */}
            {appliedOfferDetails && (
              <AppliedOfferCard
                offerDetails={appliedOfferDetails}
                onCopyCode={copyOfferCode}
                onViewOffers={navigateToOffers}
                onShareOffer={shareAppliedOffer}
              />
            )}
          </View>
        )}

        {/* Booking Information */}
        <View className="p-4 border-b border-border">
          <H3 className="mb-4">Booking Information</H3>

          <View className="bg-muted/50 rounded-lg p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Calendar size={20} color="#666" />
                <Text className="font-medium text-lg">
                  {isToday
                    ? "Today"
                    : isTomorrow
                      ? "Tomorrow"
                      : bookingDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <Clock size={20} color="#666" />
                <Text className="font-medium text-lg">
                  {bookingDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Users size={20} color="#666" />
                <Text className="font-medium">
                  {booking.party_size}{" "}
                  {booking.party_size === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-card border border-border rounded-lg p-4">
            <Text className="font-medium mb-2">
              {isPending ? "Reference Code" : "Confirmation Code"}
            </Text>
            <Pressable
              onPress={copyConfirmationCode}
              className="flex-row items-center justify-between bg-muted rounded-lg p-3"
            >
              <Text className="font-mono font-bold text-xl tracking-wider">
                {booking.confirmation_code}
              </Text>
              <Copy size={20} color="#666" />
            </Pressable>
            <Text className="text-xs text-muted-foreground mt-2">
              Tap to copy •{" "}
              {isPending
                ? "Use this code to reference your request"
                : "Show this code at the restaurant"}
            </Text>
          </View>
        </View>

        {/* Table Assignment - Only show for confirmed bookings */}
        {booking.status === "confirmed" && (
          <BookingTableInfo
            tables={assignedTables}
            partySize={booking.party_size}
            loading={loading}
          />
        )}

        {/* Special Requests */}
        <BookingSpecialRequests booking={booking} />

        {/* Contact Section */}
        <BookingContactSection
          restaurant={booking.restaurant}
          appliedOfferDetails={appliedOfferDetails}
          loyaltyActivity={loyaltyActivity}
        />

        {/* Map Section */}
        <BookingMapSection restaurant={booking.restaurant} />

        {/* Bottom padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Actions Bar */}
      <BookingActionsBar
        booking={booking}
        appliedOfferDetails={appliedOfferDetails}
        loyaltyActivity={loyaltyActivity}
        hasReview={hasReview}
        isUpcoming={isUpcoming}
        processing={processing}
        onCancel={cancelBooking}
        onReview={navigateToReview}
        onBookAgain={bookAgain}
        onNavigateToLoyalty={navigateToLoyalty}
        onNavigateToOffers={navigateToOffers}
      />
    </SafeAreaView>
  );
}
