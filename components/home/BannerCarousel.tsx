// components/home/BannerCarousel.tsx
import React, { useRef, useState, useCallback } from "react";
import { ScrollView, View, Dimensions, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";

import { Banner } from "./Banner";
import { useAuth } from "@/context/supabase-provider";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useOffers, EnrichedOffer } from "@/hooks/useOffers";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { Image } from "@/components/image";
import { EnrichedBanner } from "@/types/banners";

const { width: screenWidth } = Dimensions.get("window");

interface BannerCarouselProps {
  banners: EnrichedBanner[];
}

export function BannerCarousel({ banners }: BannerCarouselProps) {
  // --- Hooks ---
  const router = useRouter();
  const { claimOffer } = useOffers();
  const {
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // --- State ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // --- UI Logic ---
  const bannersWithImages = banners.filter(
    (banner) => banner.image_url && banner.image_url.trim() !== "",
  );

  // Build list with local welcome banner as the first item
  const bannerWidth = screenWidth - 32;
  const spacing = 8;

  const localWelcomeBanner = (
    <View key="welcome-local" style={{ marginRight: spacing }}>
      <Image
        source={require("@/assets/welcome.png")}
        style={{ width: bannerWidth, height: 200, borderRadius: 12 }}
        contentFit="cover"
      />
    </View>
  );

  const hasRemoteBanners = bannersWithImages.length > 0;

  if (!hasRemoteBanners) {
    // Still show the local banner alone
    return (
      <View className="mb-6">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={bannerWidth + spacing}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {localWelcomeBanner}
        </ScrollView>
      </View>
    );
  }

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (bannerWidth + spacing));
    // +1 because of the local banner at the beginning
    setCurrentIndex(Math.max(0, Math.min(index, bannersWithImages.length)));
  };

  const handleDotPress = (index: number) => {
    const scrollPosition = index * (bannerWidth + spacing);
    scrollViewRef.current?.scrollTo({
      x: scrollPosition,
      animated: true,
    });
    setCurrentIndex(index);
  };

  // --- Offer Handling Logic (with Guest Guard) ---
  const handleClaimAndBook = useCallback(
    async (offer: EnrichedOffer) => {
      try {
        const success = await claimOffer(offer.id);

        if (success) {
          router.push({
            pathname: "/booking/availability",
            params: {
              restaurantId: offer.restaurant_id,
              restaurantName: offer.restaurant.name,
              offerId: offer.id,
              discountPercentage: offer.discount_percentage.toString(),
            },
          });
        } else {
          Alert.alert(
            "Unable to Claim",
            "This offer could not be claimed. Please try again.",
          );
        }
      } catch (error) {
        console.error("Error claiming and booking offer:", error);
      }
    },
    [claimOffer, router],
  );

  // --- Banner Click Handling ---
  const handleBannerPress = useCallback(
    (banner: EnrichedBanner) => {
      runProtectedAction(async () => {
        // Handle restaurant navigation
        if (banner.clickType === "restaurant" && banner.restaurant) {
          router.push({
            pathname: "/restaurant/[id]",
            params: {
              id: banner.restaurant.id,
            },
          });
          return;
        }

        // Handle special offer
        if (
          banner.clickType === "offer" &&
          banner.special_offer &&
          banner.special_offer.restaurant
        ) {
          const offer = banner.special_offer;

          // Check if offer is valid
          if (offer.valid_until) {
            const validUntil = new Date(offer.valid_until);
            const now = new Date();
            if (now > validUntil) {
              Alert.alert("Offer Expired", "This offer has expired.");
              return;
            }
          }

          // Show confirmation dialog
          Alert.alert(
            "Use Offer",
            `Use this ${offer.discount_percentage || 0}% off offer at ${offer.restaurant.name}?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Book Now",
                onPress: () =>
                  handleClaimAndBook(offer as unknown as EnrichedOffer),
              },
            ],
          );
          return;
        }
      }, "view offers and restaurants");
    },
    [runProtectedAction, router, handleClaimAndBook],
  );

  return (
    <>
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
          {/* Local welcome banner first */}
        

          {/* Then remote banners */}
          {bannersWithImages.map((banner, index) => (
            <View
              key={banner.id}
              style={{
                marginRight:
                  index === bannersWithImages.length - 1 ? 0 : spacing,
              }}
            >
              <Banner banner={banner} onPress={handleBannerPress} />
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        {bannersWithImages.length >= 1 && (
          <View className="flex-row justify-center items-center mt-4 gap-2">
            {/* +1 dot for the local banner */}
            {[...Array(bannersWithImages.length + 1)].map((_, index) => (
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

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />
    </>
  );
}
