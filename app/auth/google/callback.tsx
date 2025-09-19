import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { getActivityIndicatorColor } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

export default function GoogleOAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const { session, initialized } = useAuth();
  const [countdown, setCountdown] = useState(6);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {


    // Wait for auth to initialize
    if (!initialized) {

      return;
    }

    // If we have a session, redirect with a small delay for smooth transition
    if (session) {
  

      // Add a longer delay to ensure completely smooth transition and mask any brief errors
      setTimeout(() => {
        router.replace("/(protected)/(tabs)");
      }, 1000);
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
        
          router.replace("/welcome");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stop processing after a delay
    const processingTimer = setTimeout(() => {
      setProcessing(false);
    }, 1500);

    return () => {
      clearInterval(timer);
      clearTimeout(processingTimer);
    };
  }, [initialized, session, router, params]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-y-6">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />

        <H1 className="text-center text-2xl">
          {processing ? "Completing Google Sign In..." : "Almost Ready!"}
        </H1>

        <Muted className="text-center text-lg">
          {processing
            ? "Setting up your account and preferences..."
            : "Finalizing your authentication."}
        </Muted>

        <View className="bg-muted/20 rounded-lg p-4 w-full">
          <Muted className="text-center text-sm">
            {processing
              ? "Processing OAuth tokens and setting up your session..."
              : "If this takes too long, you'll be redirected automatically."}
          </Muted>
        </View>

        <Muted className="text-center text-xs opacity-70">
          {countdown > 0
            ? `Auto-redirect in ${countdown} seconds`
            : "Redirecting now..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
