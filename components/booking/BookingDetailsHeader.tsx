import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight, MapPin, Gift, Award } from "lucide-react-native";

import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";

interface BookingDetailsHeaderProps {
  restaurant: {
    id: string;
    name: string;
    cuisine_type: string;
    address: string;
    main_image_url: string | null;
  };
  appliedOfferDetails?: {
    discount_percentage: number;
  } | null;
  loyaltyActivity?: {
    points_earned: number;
  } | null;
  onPress?: () => void;
}

export const BookingDetailsHeader: React.FC<BookingDetailsHeaderProps> = ({
  restaurant,
  appliedOfferDetails,
  loyaltyActivity,
  onPress,
}) => {
  return (
    <Pressable onPress={onPress} className="bg-card border-b border-border">
      <View className="flex-row p-4">
        <Image
          source={{ uri: restaurant.main_image_url }}
          className="w-24 h-24 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-xl font-bold mb-1">{restaurant.name}</Text>
              <Text className="text-muted-foreground text-sm mb-2">
                {restaurant.cuisine_type}
              </Text>
              <View className="flex-row items-center gap-1 mb-2">
                <MapPin size={14} color="#666" />
                <Text
                  className="text-sm text-muted-foreground"
                  numberOfLines={2}
                >
                  {restaurant.address}
                </Text>
              </View>

              {/* Enhanced info badges */}
              <View className="flex-row items-center gap-2">
                {appliedOfferDetails ? (
                  <View className="bg-green-100 px-2 py-1 rounded-full">
                    <Text className="text-green-700 text-xs font-bold">
                      {`${appliedOfferDetails.discount_percentage}% OFF APPLIED`}
                    </Text>
                  </View>
                ) : null}
                {loyaltyActivity ? (
                  <View className="bg-amber-100 px-2 py-1 rounded-full">
                    <Text className="text-amber-700 text-xs font-bold">
                      {`+${loyaltyActivity.points_earned} PTS`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View className="ml-2">
              <ChevronRight size={20} color="#666" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};
