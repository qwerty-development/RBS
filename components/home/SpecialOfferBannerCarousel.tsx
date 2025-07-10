import React from "react";
import { ScrollView, View } from "react-native";
import { SpecialOfferBanner } from "./SpecialOfferBanner";
import { EnrichedOffer } from "@/hooks/useOffers";

interface SpecialOfferBannerCarouselProps {
  offers: EnrichedOffer[];
}

export function SpecialOfferBannerCarousel({
  offers,
}: SpecialOfferBannerCarouselProps) {
  // Filter offers to only show those with banner images (img_url)
  const bannersWithImages = offers.filter(
    (offer) => offer.img_url && offer.img_url.trim() !== ""
  );

  // Don't render anything if no banners with images
  if (bannersWithImages.length === 0) {
    return null;
  }

  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={undefined} // Let it scroll freely
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {bannersWithImages.map((offer, index) => (
          <View key={offer.id} style={{ marginLeft: index === 0 ? 0 : 8 }}>
            <SpecialOfferBanner offer={offer} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
