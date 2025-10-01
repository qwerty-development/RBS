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
  MapPin,
  RefreshCw,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";

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
  const { colorScheme } = useColorScheme();
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

    // Clean phone number: remove all non-numeric characters
    const cleanedNumber = booking.restaurant.whatsapp_number.replace(
      /[^\d]/g,
      "",
    );

    // Use https://wa.me/ format which works without URL scheme whitelisting
    const waUrl = `https://wa.me/${cleanedNumber}?text=${message}`;
    // Fallback to whatsapp:// scheme
    const whatsappUrl = `whatsapp://send?phone=${cleanedNumber}&text=${message}`;

    try {
      // Try wa.me URL first (works on both platforms without configuration)
      const canOpenWa = await Linking.canOpenURL(waUrl);
      if (canOpenWa) {
        await Linking.openURL(waUrl);
        return;
      }

      // Fallback to whatsapp:// scheme
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
        return;
      }

      Alert.alert("Error", "WhatsApp is not installed");
    } catch (error) {
      console.error("Error opening WhatsApp:", error);
      Alert.alert(
        "Error",
        "Unable to open WhatsApp. Please check if it's installed.",
      );
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
    <View className="p-6 border-t border-border bg-background">
      {/* Primary Actions for Upcoming Bookings */}
      {isUpcoming &&
        (booking.status === "pending" || booking.status === "confirmed") && (
          <View className="mb-3">
            {/* Main action buttons - Call and Directions */}
            <View className="flex-row gap-3 mb-3">
              {booking.restaurant.phone_number && (
                <Button
                  variant="default"
                  onPress={callRestaurant}
                  className="flex-1 bg-primary h-12 rounded-lg"
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Phone
                      size={16}
                      color={colors[colorScheme].primaryForeground}
                    />
                    <Text className="text-primary-foreground font-medium">
                      Call
                    </Text>
                  </View>
                </Button>
              )}

              <Button
                variant="default"
                onPress={() => {
                  // Handle directions navigation
                  if (
                    booking.restaurant.coordinates?.latitude &&
                    booking.restaurant.coordinates?.longitude
                  ) {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.restaurant.coordinates.latitude},${booking.restaurant.coordinates.longitude}`;
                    Linking.openURL(url);
                  }
                }}
                className="flex-1 bg-primary h-12 rounded-lg"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <MapPin
                    size={16}
                    color={colors[colorScheme].primaryForeground}
                  />
                  <Text className="text-primary-foreground font-medium">
                    Directions
                  </Text>
                </View>
              </Button>
            </View>

            {/* Cancel button - light red styling */}
            <Button
              variant="ghost"
              onPress={onCancel}
              disabled={processing}
              className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <View className="flex-row items-center justify-center gap-2">
                <XCircle size={16} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400">Cancel</Text>
              </View>
            </Button>
          </View>
        )}

      {/* Review Button for Completed Bookings */}
      {booking.status === "completed" && !hasReview && (
        <Button
          variant="default"
          onPress={onReview}
          className="w-full mb-3 rounded-lg"
        >
          <View className="flex-row items-center gap-2">
            <Star size={16} />
            <Text>Rate Your Experience</Text>
          </View>
        </Button>
      )}

      {/* Try Different Time for Declined Bookings */}
      {booking.status === "declined_by_restaurant" && (
        <Button
          variant="default"
          onPress={onBookAgain}
          className="w-full mb-3 bg-primary rounded-lg"
        >
          <View className="flex-row items-center gap-2">
            <RefreshCw
              size={16}
              color={colors[colorScheme].primaryForeground}
            />
            <Text className="text-primary-foreground font-medium">
              Try Different Time
            </Text>
          </View>
        </Button>
      )}

      {/* Quick Actions Row */}
      <View className="flex-row gap-3">
        {/* Book Again for Completed/Cancelled */}
        {(booking.status === "completed" ||
          booking.status === "cancelled_by_user") && (
          <Button
            variant="default"
            onPress={onBookAgain}
            className="flex-1 bg-primary rounded-lg"
          >
            <View className="flex-row items-center gap-2">
              <Calendar
                size={16}
                color={colors[colorScheme].primaryForeground}
              />
              <Text className="text-primary-foreground">Book Again</Text>
            </View>
          </Button>
        )}

        {/* Loyalty Button */}
        {loyaltyActivity && (
          <Button
            variant="outline"
            onPress={onNavigateToLoyalty}
            className="flex-none px-4 rounded-lg"
          >
            <Trophy size={16} color="#f59e0b" />
          </Button>
        )}

        {/* Offers Button */}
        {appliedOfferDetails && (
          <Button
            variant="outline"
            onPress={onNavigateToOffers}
            className="flex-none px-4 rounded-lg"
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
