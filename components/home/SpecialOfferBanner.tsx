import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "@/components/image";
import { EnrichedOffer } from "@/hooks/useOffers";

interface SpecialOfferBannerProps {
  offer: EnrichedOffer;
}

const { width: screenWidth } = Dimensions.get("window");
const bannerWidth = screenWidth - 32; // Account for container padding
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
        opacity: pressed ? 0.95 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg shadow-black/10"
        style={{ width: bannerWidth, height: bannerHeight }}
      >
        {/* Banner Image Only */}
        <Image
          source={{ uri: offer.img_url }}
          style={{ width: bannerWidth, height: bannerHeight }}
          contentFit="cover"
        />
      </View>
    </Pressable>
  );
}
