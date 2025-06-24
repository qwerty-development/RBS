import React from "react";
import { View, Pressable } from "react-native";
import { Calendar, Clock, Users, Tag, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { formatBookingDate, formatBookingTime } from "@/lib/bookingUtils";

interface Restaurant {
  id: string;
  name: string;
  main_image_url: string;
}

interface UserProfile {
  full_name?: string;
  phone_number?: string;
}

interface AppliedOffer {
  id: string;
  special_offer: {
    title: string;
    discount_percentage: number;
  };
}

interface BookingSummaryCardProps {
  restaurant: Restaurant;
  date: Date;
  time: string;
  partySize: number;
  invitedFriendsCount: number;
  userProfile: UserProfile;
  appliedOffer?: AppliedOffer | null;
  onRemoveOffer?: () => void;
  className?: string;
}

export const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  restaurant,
  date,
  time,
  partySize,
  invitedFriendsCount,
  userProfile,
  appliedOffer,
  onRemoveOffer,
  className = "",
}) => {
  const totalPartySize = partySize + invitedFriendsCount;

  return (
    <View
      className={`p-4 bg-card rounded-xl border border-border ${className}`}
    >
      {/* Restaurant and Booking Info */}
      <View className="flex-row items-center gap-3 mb-3">
        <Image
          source={{ uri: restaurant.main_image_url }}
          className="w-16 h-16 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="font-semibold text-lg">{restaurant.name}</Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Calendar size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Clock size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {formatBookingTime(time)}
            </Text>
            <Users size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {totalPartySize} {totalPartySize === 1 ? "Guest" : "Guests"}
              {invitedFriendsCount > 0 &&
                ` (${invitedFriendsCount} friends invited)`}
            </Text>
          </View>
        </View>
      </View>

      {/* User Info */}
      <View className="border-t border-border pt-3">
        <Text className="text-sm text-muted-foreground">Booking for:</Text>
        <Text className="font-medium">{userProfile.full_name || "User"}</Text>
        {userProfile.phone_number && (
          <Text className="text-sm text-muted-foreground">
            {userProfile.phone_number}
          </Text>
        )}
      </View>

      {/* Applied Offer */}
      {appliedOffer && (
        <View className="border-t border-border pt-3 mt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Tag size={16} color="#10b981" />
              <Text className="text-sm font-medium">
                {appliedOffer.special_offer.title} (
                {appliedOffer.special_offer.discount_percentage}% OFF)
              </Text>
            </View>
            {onRemoveOffer && (
              <Pressable onPress={onRemoveOffer}>
                <X size={16} color="#666" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
};
