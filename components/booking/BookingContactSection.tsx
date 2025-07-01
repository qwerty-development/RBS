import React from "react";
import { View, Alert, Linking } from "react-native";
import { Phone, MessageCircle, Info } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";

interface BookingContactSectionProps {
  restaurant: {
    name: string;
    phone_number?: string | null;
    whatsapp_number?: string | null;
  };
  appliedOfferDetails?: {
    discount_percentage: number;
  } | null;
  loyaltyActivity?: {
    points_earned: number;
  } | null;
}

export const BookingContactSection: React.FC<BookingContactSectionProps> = ({
  restaurant,
  appliedOfferDetails,
  loyaltyActivity,
}) => {
  const callRestaurant = async () => {
    if (!restaurant.phone_number) return;

    const url = `tel:${restaurant.phone_number}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to make phone call");
    }
  };

  const messageRestaurant = async () => {
    if (!restaurant.whatsapp_number) return;

    const offerText = appliedOfferDetails
      ? ` I have a ${appliedOfferDetails.discount_percentage}% discount offer applied.`
      : "";
    const loyaltyText = loyaltyActivity
      ? ` I'm a loyalty member with ${loyaltyActivity.points_earned} points earned from this booking.`
      : "";

    const message = encodeURIComponent(
      `Hi! I have a booking at ${restaurant.name}.${offerText}${loyaltyText}`
    );

    const url = `whatsapp://send?phone=${restaurant.whatsapp_number}&text=${message}`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "WhatsApp is not installed");
    }
  };

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Contact Restaurant</H3>
      <View className="gap-2">
        {restaurant.phone_number && (
          <Button variant="outline" onPress={callRestaurant} className="w-full">
            <View className="flex-row items-center gap-2">
              <Phone size={20} color="#10b981" />
              <Text>Call Restaurant</Text>
            </View>
          </Button>
        )}

        {restaurant.whatsapp_number && (
          <Button
            variant="outline"
            onPress={messageRestaurant}
            className="w-full"
          >
            <View className="flex-row items-center gap-2">
              <MessageCircle size={20} color="#25D366" />
              <Text>WhatsApp</Text>
            </View>
          </Button>
        )}
      </View>

      {(appliedOfferDetails || loyaltyActivity) && (
        <View className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <Info size={16} color="#3b82f6" />
            <Text className="text-sm text-blue-800 dark:text-blue-200 flex-1">
              Your {appliedOfferDetails ? "discount offer and " : ""}loyalty
              status will be mentioned when contacting the restaurant.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};
