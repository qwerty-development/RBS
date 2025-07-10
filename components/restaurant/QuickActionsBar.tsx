import React from "react";
import { View, Pressable } from "react-native";
import {
  Heart,
  Share2,
  Phone,
  Navigation,
} from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface QuickActionsBarProps {
  restaurant: Restaurant;
  isFavorite: boolean;
  colorScheme: "light" | "dark";
  onToggleFavorite: () => void;
  onShare: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onDirections: () => void;
}

export const QuickActionsBar = ({
  restaurant,
  isFavorite,
  colorScheme,
  onToggleFavorite,
  onShare,
  onCall,
  onWhatsApp,
  onDirections,
}: QuickActionsBarProps) => {
  return (
    <View className="bg-background border-b border-border">
      <View className="flex-row justify-between items-center px-4 py-3">
        <Pressable
          onPress={onToggleFavorite}
          className="flex-row items-center gap-2"
        >
          <Heart
            size={24}
            color={
              isFavorite ? "#ef4444" : colorScheme === "dark" ? "#fff" : "#000"
            }
            fill={isFavorite ? "#ef4444" : "transparent"}
          />
          <Text className="font-medium">{isFavorite ? "Saved" : "Save"}</Text>
        </Pressable>

        <View className="flex-row gap-4">
          <Pressable onPress={onShare}>
            <Share2 size={24} />
          </Pressable>
          {restaurant.phone_number && (
            <Pressable onPress={onCall}>
              <Phone size={24} />
            </Pressable>
          )}
          {restaurant.whatsapp_number && (
            <Pressable onPress={onWhatsApp}>
              <FontAwesome name="whatsapp" size={24} color="#25D366" />
            </Pressable>
          )}
          <Pressable onPress={onDirections}>
            <Navigation size={24} color="#3b82f6" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};
