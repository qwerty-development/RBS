import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { H1, Muted } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { getActivityIndicatorColor } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const { session, initialized, clearOAuthInProgress } = useAuth();
  const [countdown, setCountdown] = useState(6);
  const [processing, setProcessing] = useState(true);

  // Determine the provider from params or URL
  const provider = params.provider || 
                  (typeof window !== "undefined" && window.location?.href?.includes("google") ? "Google" : "OAuth");

  useEffect(() => {
    console.log(`🔄 ${provider} auth callback route hit with params:`, params);
    
    // Wait for auth to initialize
    if (!initialized) {
      console.log("⏳ Waiting for auth to initialize...");
      return;
    }

    // If we have a session, redirect immediately
    if (session) {
      console.log(`✅ Session found in ${provider} callback, redirecting to app`);
      
      // Clear OAuth in progress flag before navigation
      clearOAuthInProgress();
      
      // Add a small delay to ensure state is updated
      setTimeout(() => {
        router.replace("/(protected)/(tabs)");
      }, 100);
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          console.log(`⏰ ${provider} auth callback timeout, redirecting to welcome`);
          
          // Clear OAuth in progress flag before navigation
          clearOAuthInProgress();
          
          router.replace("/welcome");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Stop processing after a delay
    const processingTimer = setTimeout(() => {
      setProcessing(false);
    }, 2500);

    return () => {
      clearInterval(timer);
      clearTimeout(processingTimer);
    };
  }, [initialized, session, router, params, provider]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-y-6">
        <ActivityIndicator 
          size="large" 
          color={getActivityIndicatorColor(colorScheme)}
        />
        
        <H1 className="text-center text-2xl">
          {processing ? `Signing you in with ${provider}...` : "Almost there!"}
        </H1>
        
        <Muted className="text-center">
          {processing 
            ? `Please wait while we complete your ${provider} authentication.`
            : "Finalizing your authentication process."
          }
        </Muted>
        
        <View className="bg-muted/20 rounded-lg p-4 w-full">
          <Muted className="text-center text-sm">
            {processing 
              ? "Processing authentication tokens..."
              : "Taking longer than usual? You'll be redirected soon."
            }
          </Muted>
        </View>
        
        <Muted className="text-center text-xs opacity-70">
          {countdown > 0 ? `Redirecting in ${countdown}s` : "Redirecting..."}
        </Muted>
      </View>
    </SafeAreaView>
  );
}
