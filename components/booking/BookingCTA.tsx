import React, { useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { CheckCircle } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

interface BookingCTAProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
  bookingPolicy: "instant" | "approval";
  invitedFriendsCount?: number;
  selectedOfferDiscount?: number;
  earnablePoints: number;
  userTier: string;
  className?: string;
}

export const BookingCTA: React.FC<BookingCTAProps> = ({
  onSubmit,
  isSubmitting,
  isDisabled,
  bookingPolicy,
  invitedFriendsCount = 0,
  selectedOfferDiscount,
  earnablePoints,
  userTier,
  className = "",
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { authenticate } = useBiometricAuth();

  const handlePress = async () => {
    setIsAuthenticating(true);
    try {
      const result = await authenticate();
      if (result.success) {
        onSubmit();
      } else {
        Alert.alert("Authentication Failed", result.error);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <View className={`p-4 border-t border-border bg-background ${className}`}>
      <Button
        onPress={handlePress}
        disabled={isDisabled || isSubmitting || isAuthenticating}
        size="lg"
        className="w-full"
      >
        {isSubmitting || isAuthenticating ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <CheckCircle size={20} className="mr-2" />
            <Text className="text-white font-bold text-lg">
              {bookingPolicy === "instant"
                ? "Confirm Booking"
                : "Request Booking"}
              {invitedFriendsCount > 0 && ` (${invitedFriendsCount} friends)`}
            </Text>
          </>
        )}
      </Button>

      <View className="mt-3 flex-row justify-center items-center gap-2">
        <Text className="text-xs text-muted-foreground text-center">
          {selectedOfferDiscount ? `${selectedOfferDiscount}% discount + ` : ""}
          {earnablePoints} loyalty points • {userTier.toUpperCase()} tier
          {invitedFriendsCount > 0 &&
            ` • ${invitedFriendsCount} friends invited`}
        </Text>
      </View>
    </View>
  );
};
