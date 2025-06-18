import React, { useState, useRef } from "react";
import { FlatList, View, Dimensions, Pressable } from "react-native";
import { SpecialOfferCard } from "./SpecialOfferCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Type definitions
interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  tags: string[];
  average_rating: number;
  total_reviews: number;
  address: string;
  price_range: number;
  booking_policy: "instant" | "request";
  created_at?: string;
  featured?: boolean;
}

interface SpecialOffer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  valid_until: string;
  restaurant: Restaurant;
}

interface SpecialOffersCarouselProps {
  offers: SpecialOffer[];
  onPress: (offer: SpecialOffer) => void;
}

export function SpecialOffersCarousel({ offers, onPress }: SpecialOffersCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <View>
      <FlatList
        ref={flatListRef}
        data={offers}
        renderItem={({ item }) => (
          <SpecialOfferCard offer={item} onPress={onPress} />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        contentContainerStyle={{ paddingVertical: 8 }}
      />
      
      {/* Pagination Dots */}
      {offers.length > 1 && (
        <View className="flex-row justify-center mt-4 space-x-2">
          {offers.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ 
                  index, 
                  animated: true 
                });
              }}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex 
                  ? 'bg-primary' 
                  : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}