// app/(protected)/booking/[id].tsx
import React from "react";
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
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P } from "@/components/ui/typography";
import { LoyaltyPointsCard } from "@/components/ui/loyalty-points-card";
import { useColorScheme } from "@/lib/useColorScheme";

// Import new components
import {
  BookingDetailsHeader,
  BookingActionsBar,
  BookingMapSection,
  BookingContactSection,
  BookingSpecialRequests,
  AppliedOfferCard,
} from "@/components/booking";

// Import custom hook
import { useBookingDetails } from "@/hooks/useBookingDetails";

// Import constants
import { BOOKING_STATUS_CONFIG } from "@/constants/bookingConstants";
import BookingDetailsScreenSkeleton from '@/components/skeletons/BookingDetailsScreenSkeleton';

export default function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  // Use custom hook for all booking logic
  const {
    booking,
    loading,
    processing,
    hasReview,
    loyaltyActivity,
    appliedOfferDetails,
    isUpcoming,
    isToday,
    isTomorrow,
    cancelBooking,
    copyOfferCode,
  } = useBookingDetails(params.id || "");

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

  // Share booking
  const shareBooking = async () => {
    if (!booking) return;

    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";
    const pointsText = loyaltyActivity
      ? ` I also earned ${loyaltyActivity.points_earned} loyalty points!`
      : "";

    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${new Date(
      booking.booking_time
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
      booking.party_size
    } people.${offerText}${pointsText} Confirmation code: ${booking.confirmation_code}`;

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
      `Confirmation code ${booking.confirmation_code} copied to clipboard`
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


// ... (rest of the imports)

// ... (rest of the code)

  // Loading state
  if (loading) {
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
        </View>

        {/* Rewards Section */}
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

          {/* Loyalty Points Card */}
          {loyaltyActivity && (
            <LoyaltyPointsCard
              pointsEarned={loyaltyActivity.points_earned}
              userTier={(booking as any).metadata?.userTier || "bronze"}
              tierMultiplier={loyaltyActivity.points_multiplier}
              hasOffer={!!appliedOfferDetails}
            />
          )}
        </View>

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

          {/* Confirmation Code */}
          <View className="bg-card border border-border rounded-lg p-4">
            <Text className="font-medium mb-2">Confirmation Code</Text>
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
              Tap to copy • Show this code at the restaurant
            </Text>
          </View>
        </View>

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
