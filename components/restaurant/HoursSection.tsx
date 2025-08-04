import React from "react";
import { View } from "react-native";
import { Clock, DollarSign } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Database } from "@/types/supabase";
import { useRestaurantAvailability } from "@/hooks/useRestaurantAvailability";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  happy_hour_times?: { start: string; end: string };
};

interface HoursSectionProps {
  restaurant: Restaurant;
}

export const HoursSection = ({
  restaurant,
}: HoursSectionProps) => {
  const { 
    formatOperatingHours, 
    checkAvailability,
    loading: availabilityLoading 
  } = useRestaurantAvailability(restaurant.id);
  
  const today = new Date();
  const availability = checkAvailability(today);
  
  return (
    <View className="px-4 mb-6">
      <H3 className="mb-3">Hours</H3>
      <View className="bg-card p-4 rounded-lg">
        {!availabilityLoading && (
          <View className="flex-row items-center gap-2 mb-2">
            <Clock size={20} color={availability.isOpen ? "#10b981" : "#ef4444"} />
            <Text className="font-medium">
              Today: {formatOperatingHours()}
            </Text>
            <View
              className={`px-2 py-1 rounded-full ml-auto ${
                availability.isOpen ? "bg-green-100" : "bg-red-100"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  availability.isOpen ? "text-green-800" : "text-red-800"
                }`}
              >
                {availability.isOpen ? "Open" : "Closed"}
              </Text>
            </View>
          </View>
        )}
        {restaurant.happy_hour_times && (
          <View className="flex-row items-center gap-2 mt-2 pt-2 border-t border-border">
            <DollarSign size={20} color="#10b981" />
            <Text className="text-green-600 dark:text-green-400">
              Happy Hour: {restaurant.happy_hour_times.start} -{" "}
              {restaurant.happy_hour_times.end}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
