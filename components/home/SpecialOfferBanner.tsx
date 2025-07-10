import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "@/components/image";
import { Text } from "@/components/ui/text";
import { EnrichedOffer } from "@/hooks/useOffers";

interface SpecialOfferBannerProps {
  offer: EnrichedOffer;
}

const { width: screenWidth } = Dimensions.get("window");
const bannerWidth = screenWidth - 32; // 16px margin on each side
const bannerHeight = 200; // Fixed height for consistency

export function SpecialOfferBanner({ offer }: SpecialOfferBannerProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push({
      pathname: "/restaurant/[id]",
      params: {
        id: offer.restaurant.id,
        highlightOfferId: offer.id,
      },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        marginHorizontal: 16,
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/10"
        style={{ width: bannerWidth, height: bannerHeight }}
      >
        {/* Banner Image */}
        <Image
          source={{ uri: offer.img_url }}
          style={{ width: bannerWidth, height: bannerHeight }}
          contentFit="cover"
        />

        {/* Gradient Overlay */}
        <View className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Discount Badge - Top Right */}
        <View className="absolute top-4 right-4 bg-primary h-16 w-16 rounded-full items-center justify-center border-3 border-white shadow-lg">
          <Text className="text-white font-extrabold text-xl">
            {offer.discount_percentage}
          </Text>
          <Text className="text-white font-bold text-xs -mt-1">% OFF</Text>
        </View>

        {/* Bottom Info */}
        <View className="absolute bottom-0 left-0 right-0 p-4">
          <Text
            className="text-white font-bold text-2xl mb-1"
            numberOfLines={1}
          >
            {offer.restaurant.name}
          </Text>
          <Text
            className="text-white/90 font-semibold text-lg"
            numberOfLines={1}
          >
            {offer.title}
          </Text>
          <Text className="text-white/80 text-sm mt-1" numberOfLines={1}>
            {offer.restaurant.cuisine_type}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
