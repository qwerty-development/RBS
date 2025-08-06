import React from "react";
import { View, Alert, Linking, Platform, Share } from "react-native";
import {
  Phone,
  MessageCircle,
  Navigation,
  Share2,
  Copy,
  Edit3,
  XCircle,
  Star,
  Calendar,
  Trophy,
  Tag,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";

interface BookingActionsBarProps {
  booking: {
    id: string;
    status: string;
    confirmation_code: string;
    booking_time: string;
    party_size: number;
    restaurant: {
      id: string;
      name: string;
      phone_number?: string | null;
      whatsapp_number?: string | null;
      location: any;
      staticCoordinates?: { lat: number; lng: number };
      coordinates?: { latitude: number; longitude: number };
    };
  };
  appliedOfferDetails?: {
    discount_percentage: number;
    redemption_code: string;
  } | null;
  loyaltyActivity?: {
    points_earned: number;
  } | null;
  hasReview?: boolean;
  isUpcoming?: boolean;
  processing?: boolean;
  onCancel?: () => void;
  onReview?: () => void;
  onBookAgain?: () => void;
  onNavigateToLoyalty?: () => void;
  onNavigateToOffers?: () => void;
  onEdit?: () => void;
}

export const BookingActionsBar: React.FC<BookingActionsBarProps> = ({
  booking,
  appliedOfferDetails,
  loyaltyActivity,
  hasReview,
  isUpcoming,
  processing,
  onCancel,
  onReview,
  onBookAgain,
  onNavigateToLoyalty,
  onNavigateToOffers,
  onEdit,
}) => {
  const callRestaurant = async () => {
    if (!booking.restaurant.phone_number) return;

    const url = `tel:${booking.restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  };

  const messageRestaurant = async () => {
    if (!booking.restaurant.whatsapp_number) return;

    const offerText = appliedOfferDetails
      ? ` I have a ${appliedOfferDetails.discount_percentage}% discount offer applied (Code: ${appliedOfferDetails.redemption_code.slice(-6).toUpperCase()}).`
      : "";
    const loyaltyText = loyaltyActivity
      ? ` I'm a loyalty member with ${loyaltyActivity.points_earned} points earned from this booking.`
      : "";

    const message = encodeURIComponent(
      `Hi! I have a booking at ${booking.restaurant.name} on ${new Date(
        booking.booking_time,
      ).toLocaleDateString()} at ${new Date(
        booking.booking_time,
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} for ${
        booking.party_size
      } people. Confirmation code: ${booking.confirmation_code}${offerText}${loyaltyText}`,
    );

    const url = `whatsapp://send?phone=${booking.restaurant.whatsapp_number}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  };

  const shareBooking = async () => {
    const offerText = appliedOfferDetails
      ? ` Plus I saved ${appliedOfferDetails.discount_percentage}% with a special offer!`
      : "";
    const pointsText = loyaltyActivity
      ? ` I also earned ${loyaltyActivity.points_earned} loyalty points!`
      : "";

    const shareMessage = `I have a reservation at ${booking.restaurant.name} on ${new Date(
      booking.booking_time,
    ).toLocaleDateString()} at ${new Date(
      booking.booking_time,
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

  const copyConfirmationCode = async () => {
    await Clipboard.setStringAsync(booking.confirmation_code);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Copied!",
      `Confirmation code ${booking.confirmation_code} copied to clipboard`,
    );
  };

  return (
    <View className="p-4 border-t border-border bg-background">
      {/* Primary Actions for Upcoming Bookings */}
      {isUpcoming &&
        (booking.status === "pending" || booking.status === "confirmed") && (
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <DirectionsButton
                restaurant={booking.restaurant}
                variant="button"
                size="sm"
                backgroundColor="bg-background"
                borderColor="border-border"
                iconColor="#3b82f6"
                textColor="text-primary"
                className="w-full h-10 justify-center"
              />
            </View>

            <Button
              variant="destructive"
              onPress={onCancel}
              disabled={processing}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <XCircle size={16} />
                <Text>Cancel</Text>
              </View>
            </Button>
          </View>
        )}

      {/* Review Button for Completed Bookings */}
      {booking.status === "completed" && !hasReview && (
        <Button variant="default" onPress={onReview} className="w-full mb-3">
          <View className="flex-row items-center gap-2">
            <Star size={16} />
            <Text>Rate Your Experience</Text>
          </View>
        </Button>
      )}

      {/* Quick Actions Row */}
      <View className="flex-row gap-3">
        {/* Book Again for Completed/Cancelled */}
        {(booking.status === "completed" ||
          booking.status === "cancelled_by_user") && (
          <Button variant="secondary" onPress={onBookAgain} className="flex-1">
            <View className="flex-row items-center gap-2">
              <Calendar size={16} />
              <Text>Book Again</Text>
            </View>
          </Button>
        )}

        {/* Loyalty Button */}
        {loyaltyActivity && (
          <Button
            variant="outline"
            onPress={onNavigateToLoyalty}
            className="flex-none px-4"
          >
            <Trophy size={16} color="#f59e0b" />
          </Button>
        )}

        {/* Offers Button */}
        {appliedOfferDetails && (
          <Button
            variant="outline"
            onPress={onNavigateToOffers}
            className="flex-none px-4"
          >
            <Tag size={16} color="#16a34a" />
          </Button>
        )}
      </View>

      {/* Enhanced bottom message */}
      {(appliedOfferDetails || loyaltyActivity) && (
        <Text className="text-center text-xs text-muted-foreground mt-3">
          {appliedOfferDetails && loyaltyActivity
            ? `🎉 You saved ${appliedOfferDetails.discount_percentage}% and earned ${loyaltyActivity.points_earned} points!`
            : appliedOfferDetails
              ? `💰 You saved ${appliedOfferDetails.discount_percentage}% with your special offer`
              : `⭐ You earned ${loyaltyActivity?.points_earned} loyalty points`}
        </Text>
      )}
    </View>
  );
};
