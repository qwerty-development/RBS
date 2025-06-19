import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { Sparkles, Calendar, MapPin } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Image } from "@/components/image";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

interface SpecialOfferCardProps {
  offer: SpecialOffer;
  onPress: (offer: SpecialOffer) => void;
}

export function SpecialOfferCard({ offer, onPress }: SpecialOfferCardProps) {
  if (!offer?.restaurant?.id) {
    console.warn("Invalid offer or restaurant data:", offer);
    return null;
  }

  const handlePress = () => {
    onPress(offer);
  };

  return (
    <Pressable onPress={handlePress} style={{ width: SCREEN_WIDTH - 32 }} className="mx-4">
      <View className="bg-card rounded-2xl overflow-hidden shadow-lg shadow-black/10 border border-border">
        {/* Restaurant Image */}
        <View className="relative">
          <Image 
            source={{ uri: offer.restaurant.main_image_url }} 
            className="w-full h-48" 
            contentFit="cover" 
          />
          
          {/* Enhanced Dark Overlay for Better Text Visibility */}
          <View className="absolute inset-0 bg-black/40" />
          <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          
          {/* Discount Badge */}
          <View className="absolute top-4 right-4 bg-primary px-4 py-2 rounded-full shadow-lg">
            <Text className="text-primary-foreground font-extrabold text-lg">
              {offer.discount_percentage}% OFF
            </Text>
          </View>
          
          {/* Restaurant Info Overlay */}
          <View className="absolute bottom-4 left-4 right-4">
            <View className="flex-row items-center mb-2">
              <Sparkles size={20} color="#fbbf24" />
              <Text className="text-yellow-400 font-semibold ml-2">Special Offer</Text>
            </View>
            <H3 className="text-white mb-1 shadow-lg">{offer.title}</H3>
            <View className="flex-row items-center">
              <MapPin size={16} color="#ffffff" />
              <Text className="text-white/90 ml-1 font-medium">{offer.restaurant.name}</Text>
              <Text className="text-white/70 ml-2">• {offer.restaurant.cuisine_type}</Text>
            </View>
          </View>
        </View>
        
        {/* Card Content */}
        <View className="p-4">
          {offer.description && (
            <P className="text-muted-foreground mb-3" numberOfLines={2}>
              {offer.description}
            </P>
          )}
          
          {/* Metadata */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center bg-muted/50 rounded-full px-3 py-2">
              <Calendar size={16} color="#6b7280" />
              <Text className="text-sm text-muted-foreground ml-2">
                Expires {new Date(offer.valid_until).toLocaleDateString()}
              </Text>
            </View>
            
            <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
              <Text className="text-green-700 dark:text-green-400 font-semibold text-sm">
                Limited Time
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}