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
  const [countdown, setCountdown] = useState(5);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    console.log("🔄 OAuth callback received with params:", params);
    
    // Wait for auth to initialize
    if (!initialized) {
      return;
    }

    // If we have a session, redirect with a small delay for smooth transition
    if (session) {
      console.log("✅ Session found, redirecting to app");
      
      // Add a longer delay to ensure completely smooth transition and mask any brief errors
      setTimeout(() => {
        router.replace("/(protected)/(tabs)");
      }, 1000);
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
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
    }, 2000);

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
            : "Finalizing your authentication process."
          }
        </Muted>
        
        <Muted className="text-center text-xs opacity-70">
          {countdown > 0 ? `Redirecting in ${countdown} seconds` : "Redirecting..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
