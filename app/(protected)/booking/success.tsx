// app/(protected)/booking/success.tsx
import React, { useEffect, useRef } from "react";
import { View, Pressable, Share, Linking, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle,
  Calendar,
  Copy,
  Share2,
  MessageCircle,
  Home,
  Navigation,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import LottieView from "lottie-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

export default function BookingSuccessScreen() {
  const params = useLocalSearchParams<{
    bookingId: string;
    restaurantName: string;
    confirmationCode: string;
  }>();
  
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const confettiRef = useRef<LottieView>(null);

  // Play celebration animation on mount
  useEffect(() => {
    // Haptic feedback for success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Play confetti animation
    if (confettiRef.current) {
      confettiRef.current.play();
    }
  }, []);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(params.confirmationCode);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // You might want to show a toast here
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just booked a table at ${params.restaurantName}! 🎉\n\nConfirmation code: ${params.confirmationCode}`,
        title: "Restaurant Booking Confirmed",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleAddToCalendar = () => {
    // This would integrate with the device calendar
    // For now, we'll show an alert
    Alert.alert("Coming Soon", "Calendar integration will be available soon!");
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `I just booked a table at ${params.restaurantName}! Confirmation code: ${params.confirmationCode}`
    );
    Linking.openURL(`whatsapp://send?text=${message}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Confetti Animation (Optional - requires lottie file) */}
      {/* <LottieView
        ref={confettiRef}
        source={require("@/assets/animations/confetti.json")}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        autoPlay={false}
        loop={false}
        pointerEvents="none"
      /> */}

      <View className="flex-1 items-center justify-center px-6">
        {/* Success Icon */}
        <View className="bg-green-100 dark:bg-green-900/20 rounded-full p-6 mb-6">
          <CheckCircle size={64} color="#10b981" strokeWidth={2} />
        </View>

        {/* Success Message */}
        <H1 className="text-center mb-2">Booking Confirmed!</H1>
        <P className="text-center text-muted-foreground mb-8">
          Your table at {params.restaurantName} has been successfully booked
        </P>

        {/* Confirmation Code */}
        <View className="bg-card rounded-xl p-6 w-full mb-8 shadow-sm">
          <Text className="text-center text-sm text-muted-foreground mb-2">
            Confirmation Code
          </Text>
          <Pressable
            onPress={handleCopyCode}
            className="flex-row items-center justify-center gap-3 bg-muted rounded-lg p-4"
          >
            <Text className="text-2xl font-bold font-mono tracking-wider">
              {params.confirmationCode}
            </Text>
            <Copy size={20} color="#666" />
          </Pressable>
          <Text className="text-center text-xs text-muted-foreground mt-2">
            Tap to copy
          </Text>
        </View>

        {/* Quick Actions */}
        <View className="w-full gap-3 mb-8">
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleAddToCalendar}
            >
              <Calendar size={20} />
              <Text>Add to Calendar</Text>
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              onPress={handleShare}
            >
              <Share2 size={20} />
              <Text>Share</Text>
            </Button>
          </View>
          
          {Platform.OS !== "web" && (
            <Button
              variant="outline"
              className="w-full"
              onPress={handleWhatsApp}
            >
              <MessageCircle size={20} color="#25D366" />
              <Text>Share on WhatsApp</Text>
            </Button>
          )}
        </View>

        {/* Next Steps */}
        <View className="bg-muted/50 rounded-lg p-4 w-full mb-8">
          <Text className="font-semibold mb-2">What's Next?</Text>
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className="w-5 h-5 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-xs">1</Text>
              </View>
              <Text className="text-sm flex-1">
                You'll receive a confirmation email shortly
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-5 h-5 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-xs">2</Text>
              </View>
              <Text className="text-sm flex-1">
                We'll send you a reminder 2 hours before
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-5 h-5 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-xs">3</Text>
              </View>
              <Text className="text-sm flex-1">
                Show your confirmation code at the restaurant
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Actions */}
      <View className="p-4 gap-3">
        <Button
          variant="default"
          onPress={() => router.push("/bookings")}
          className="w-full"
        >
          <Calendar size={20} />
          <Text>View My Bookings</Text>
        </Button>
        
        <Button
          variant="ghost"
          onPress={() => router.push("/")}
          className="w-full"
        >
          <Home size={20} />
          <Text>Back to Home</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}