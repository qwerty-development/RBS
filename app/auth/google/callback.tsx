import { useEffect, useState } from "react";
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
  const [countdown, setCountdown] = useState(8);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    console.log("🎯 Google OAuth callback route hit with params:", params);
    
    // Wait for auth to initialize
    if (!initialized) {
      console.log("⏳ Waiting for auth to initialize...");
      return;
    }

    // If we have a session, redirect immediately
    if (session) {
      console.log("✅ Session found in Google callback, redirecting to app");
      router.replace("/(protected)/(tabs)");
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          console.log("⏰ Google OAuth callback timeout, redirecting to welcome");
          router.replace("/welcome");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stop processing after a delay
    const processingTimer = setTimeout(() => {
      setProcessing(false);
    }, 3000);

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
          {processing ? "Signing you in with Google..." : "Almost done!"}
        </H1>
        
        <Muted className="text-center">
          {processing 
            ? "Please wait while we complete your Google authentication."
            : "Finalizing your authentication process."
          }
        </Muted>
        
        <View className="bg-muted/20 rounded-lg p-4 w-full">
          <Muted className="text-center text-sm">
            {processing 
              ? "Processing OAuth tokens and setting up your session..."
              : "If this takes too long, you'll be redirected automatically."
            }
          </Muted>
        </View>
        
        <Muted className="text-center text-xs opacity-70">
          {countdown > 0 ? `Auto-redirect in ${countdown} seconds` : "Redirecting now..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
