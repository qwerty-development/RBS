import React, { useRef, useState } from "react";
import { ScrollView, View, Dimensions, Pressable } from "react-native";
import { SpecialOfferBanner } from "./SpecialOfferBanner";
import { EnrichedOffer } from "@/hooks/useOffers";

const { width: screenWidth } = Dimensions.get("window");

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

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const bannerWidth = screenWidth - 32; // Account for container padding
  const spacing = 8;

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (bannerWidth + spacing));
    setCurrentIndex(Math.max(0, Math.min(index, bannersWithImages.length - 1)));
  };

  // Pagination dot press handler
  const handleDotPress = (index: number) => {
    const scrollPosition = index * (bannerWidth + spacing);
    scrollViewRef.current?.scrollTo({
      x: scrollPosition,
      animated: true,
    });
    setCurrentIndex(index);
  };

  return (
    <View className="mb-6">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={bannerWidth + spacing}
        snapToAlignment="start"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {bannersWithImages.map((offer, index) => (
          <View
            key={offer.id}
            style={{
              marginRight: index === bannersWithImages.length - 1 ? 0 : spacing,
            }}
          >
            <SpecialOfferBanner offer={offer} />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {bannersWithImages.length > 1 && (
        <View className="flex-row justify-center items-center mt-4 gap-2">
          {bannersWithImages.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => handleDotPress(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 w-2"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
