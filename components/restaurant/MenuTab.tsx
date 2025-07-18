import React from "react";
import { View, Pressable, Linking } from "react-native";
import { Menu } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface MenuTabProps {
  restaurant: Restaurant;
}

export const MenuTab = ({ restaurant }: MenuTabProps) => {
  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Menu</H3>
      {restaurant.menu_url ? (
        <Pressable
          onPress={() => Linking.openURL(restaurant.menu_url!)}
          className="bg-card p-6 rounded-lg items-center"
        >
          <Menu size={48} color="#666" />
          <Text className="mt-3 font-medium">View Full Menu</Text>
          <Muted className="text-sm mt-1">Opens in browser</Muted>
        </Pressable>
      ) : (
        <View className="bg-muted p-6 rounded-lg items-center">
          <Menu size={48} color="#666" />
          <Muted className="mt-3">Menu not available</Muted>
          <Text className="text-sm text-center mt-1 text-muted-foreground">
            Contact the restaurant for menu information
          </Text>
        </View>
      )}
    </View>
  );
};
