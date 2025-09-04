import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { getActivityIndicatorColor } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const { session, initialized } = useAuth();
  const [countdown, setCountdown] = useState(8); // Increased timeout
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    console.log("🔄 OAuth callback received with params:", params);

    // Wait for auth to initialize
    if (!initialized) {
      return;
    }

    // If we have a session, let auth provider handle navigation
    // Don't navigate here to prevent race conditions
    if (session) {
      console.log("✅ Session found, letting auth provider handle navigation");
      return;
    }

    // Start countdown timer with longer timeout
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          console.log("⏰ OAuth callback timeout, redirecting to welcome");
          router.replace("/welcome");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stop processing after a short delay
    const processingTimer = setTimeout(() => {
      setProcessing(false);
    }, 3000); // Increased processing time

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

        <H1 className="text-center">
          {processing ? "Completing sign in..." : "Almost there!"}
        </H1>

        <Muted className="text-center">
          {processing
            ? "Please wait while we complete your authentication."
            : "Finalizing your authentication process."}
        </Muted>

        <Muted className="text-center text-xs opacity-70">
          {countdown > 0 ? `Auto-redirect in ${countdown}s` : "Redirecting..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
