// app/(protected)/booking/shared-tables.tsx
import React, { useState, useCallback, useEffect } from "react";
import { ScrollView, View, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Calendar, Users, Share2 } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { SharedTablesList } from "@/components/booking/SharedTablesList";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";

export default function SharedTablesScreen() {
  const { colorScheme } = useColorScheme();
  const { profile, isGuest } = useAuth();
  const router = useRouter();
  
  // State for time selection
  const [selectedTime, setSelectedTime] = useState<string>("19:00"); // Default to 7 PM

  // Get parameters
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    date?: string;
    partySize?: string;
    time?: string;
  }>();

  const restaurantId = params.restaurantId;
  const selectedDate = params.date ? new Date(params.date) : new Date();
  const partySize = params.partySize ? parseInt(params.partySize, 10) : 1;
  
  // Set initial time from params or default
  useEffect(() => {
    if (params.time) {
      setSelectedTime(params.time);
    }
  }, [params.time]);

  // Check if user is a guest and redirect if needed
  useEffect(() => {
    if (isGuest) {
      Alert.alert(
        "Sign In Required",
        "You need to sign in to book shared tables.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => router.back(),
          },
          {
            text: "Sign In",
            onPress: () => router.push("/sign-in"),
          },
        ],
      );
      return;
    }
  }, [isGuest, router]);

  const {
    restaurant,
    loading: restaurantLoading,
  } = useRestaurant(restaurantId);

  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  const handleBookingSuccess = useCallback(
    (bookingId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.push({
        pathname: "/booking/success",
        params: {
          bookingId,
          restaurantId,
          restaurantName: restaurant?.name || "Restaurant",
        },
      });
    },
    [router, restaurantId, restaurant?.name],
  );

  if (isGuest) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-lg mb-4">
            Sign in required to book shared tables.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <Text>Loading restaurant information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-center text-lg mb-4">
            Unable to load restaurant information.
          </Text>
          <Button onPress={handleBack}>
            <Text className="text-white">Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-border">
        <Button variant="ghost" size="sm" onPress={handleBack} className="mr-2">
          <ArrowLeft
            size={20}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Button>

        <View className="flex-1">
          <H3 className="font-bold">{restaurant.name}</H3>
          <Text className="text-sm text-muted-foreground">Shared Tables</Text>
        </View>

        <View className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-2">
          <Share2 size={20} className="text-purple-600 dark:text-purple-400" />
        </View>
      </View>

      {/* Booking details */}
      <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3">
            <View className="flex-row items-center space-x-2">
              <Calendar size={16} className="text-muted-foreground" />
              <Text className="text-sm font-medium">
                {selectedDate.toLocaleDateString()}
              </Text>
            </View>

            <View className="w-px h-4 bg-border" />

            <View className="flex-row items-center space-x-2">
              <Users size={16} className="text-muted-foreground" />
              <Text className="text-sm font-medium">
                {partySize} {partySize === 1 ? "person" : "people"}
              </Text>
            </View>
          </View>

          <Button
            variant="outline"
            size="sm"
            onPress={() =>
              router.push({
                pathname: "/booking/availability",
                params: {
                  restaurantId,
                  restaurantName: restaurant.name,
                },
              })
            }
          >
            <Text className="text-sm">Change</Text>
          </Button>
        </View>
      </View>

      {/* Shared tables list */}
      <View className="flex-1">
        <SharedTablesList
          restaurantId={restaurantId}
          date={selectedDate}
          time={selectedTime}
          onBookingSuccess={handleBookingSuccess}
        />
      </View>
    </SafeAreaView>
  );
}
