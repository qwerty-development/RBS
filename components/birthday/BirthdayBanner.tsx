import React from "react";
import { View, Pressable } from "react-native";
import { Gift, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { P } from "@/components/ui/typography";
import { getBirthdayMessage } from "@/utils/birthday";

interface BirthdayBannerProps {
  userName: string;
  onViewOffers?: () => void;
  onDismiss?: () => void;
}

export const BirthdayBanner: React.FC<BirthdayBannerProps> = ({
  userName,
  onViewOffers,
  onDismiss,
}) => {
  return (
    <View className="mx-4 mb-4 p-4 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30 rounded-xl border border-pink-200 dark:border-pink-800">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <Gift size={24} className="text-pink-600 dark:text-pink-400" />
            <Text className="ml-2 font-bold text-pink-700 dark:text-pink-300">
              🎂 Happy Birthday!
            </Text>
          </View>
          <P className="text-pink-600 dark:text-pink-400 mb-3">
            {getBirthdayMessage(userName)}
          </P>
          {onViewOffers && (
            <Pressable
              onPress={onViewOffers}
              className="bg-pink-500 px-4 py-2 rounded-lg self-start"
            >
              <Text className="text-white font-medium">
                View Birthday Offers
              </Text>
            </Pressable>
          )}
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} className="p-1">
            <X size={20} className="text-pink-400" />
          </Pressable>
        )}
      </View>
    </View>
  );
};
