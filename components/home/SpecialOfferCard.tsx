import React from "react";
import { View, Pressable } from "react-native";
import { Sparkles } from "lucide-react-native";
import { Text } from "@/components/ui/text";

interface Restaurant {
  id: string;
  name: string;
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
    <Pressable onPress={handlePress} className="mr-3 w-72">
      <View className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-4">
        <View className="flex-row items-center gap-2 mb-2">
          <View className="bg-primary px-2 py-1 rounded-full">
            <Text className="text-primary-foreground font-bold text-sm">
              {offer.discount_percentage}% OFF
            </Text>
          </View>
          <Sparkles size={16} color="#f59e0b" />
        </View>
        <Text className="font-semibold mb-1">{offer.title}</Text>
        <Text className="text-sm text-muted-foreground mb-2">
          {offer.restaurant.name}
        </Text>
        <Text className="text-xs text-muted-foreground">
          Valid until {new Date(offer.valid_until).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}
