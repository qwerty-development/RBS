// components/social/ShareBookingButton.tsx
import React from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Camera, Share2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface ShareBookingButtonProps {
  bookingId: string;
  restaurantId: string;
  restaurantName: string;
}

export function ShareBookingButton({
  bookingId,
  restaurantId,
  restaurantName,
}: ShareBookingButtonProps) {
  const router = useRouter();

  const handleShareToFeed = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/social/create-post",
      params: {
        bookingId,
        restaurantId,
      },
    });
  };

  return (
    <View className="px-6 py-4 border-t border-border">
      <Text className="font-semibold text-lg mb-3">Share Your Experience</Text>
      <Button
        onPress={handleShareToFeed}
        variant="outline"
        className="flex-row items-center justify-center"
      >
        <View className="flex-row items-center justify-center gap-2">
          <Camera size={20} color="#666" />
          <Text>Share to Social Feed</Text>
        </View>
      </Button>
    </View>
  );
}
