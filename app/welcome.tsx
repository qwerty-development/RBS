// app/welcome.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

export default function WelcomeScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { appleSignIn, googleSignIn, continueAsGuest } = useAuth();
  const isDark = colorScheme === "dark";

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  const appIcon =
    colorScheme === "dark"
      ? require("@/assets/icon.png")
      : require("@/assets/icon-dark.png");

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      if (Platform.OS === "ios") {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          setAppleAuthAvailable(isAvailable);
        } catch {
          setAppleAuthAvailable(false);
        }
      }
    };

    checkAppleAuthAvailability();
  }, []);

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      const { error, needsProfileUpdate } = await appleSignIn();

      if (error) {
        if (error.message !== "User canceled Apple sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Apple sign in failed.",
          );
        }
      }
      // Navigation handled by AuthContext
    } catch (err: any) {
      console.error("Apple sign in error:", err);
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Apple.",
      );
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error, needsProfileUpdate } = await googleSignIn();

      if (error) {
        if (error.message !== "User canceled Google sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Google sign in failed.",
          );
        }
      }
      // Navigation handled by AuthContext
    } catch (err: any) {
      console.error("Google sign in error:", err);
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Google.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle Continue as Guest
  const handleContinueAsGuest = async () => {
    try {
      setIsGuestLoading(true);
      await continueAsGuest();
      // Navigation handled by AuthContext
    } catch (err: any) {
      console.error("Guest mode error:", err);
      Alert.alert(
        "Error",
        "Failed to continue as guest. Please try again.",
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex flex-1 bg-background p-4">
      <View className="flex flex-1 items-center justify-center gap-y-4 web:m-4">
        <Image source={appIcon} className="w-20 h-20 rounded-xl" />
        <H1 className="text-center">Welcome to Booklet</H1>
        <Muted className="text-center max-w-sm">
          Discover and book the best restaurants in Lebanon. Join thousands of food lovers.
        </Muted>
      </View>
      <View className="flex flex-col gap-y-3 web:m-4">
        {/* Email Sign Up/In */}
        <Button
          size="default"
          variant="default"
          onPress={() => router.push("/sign-up")}
          disabled={isAppleLoading || isGoogleLoading || isGuestLoading}
        >
          <Text>Sign Up with Email</Text>
        </Button>
        
        <Button
          size="default"
          variant="secondary"
          onPress={() => router.push("/sign-in")}
          disabled={isAppleLoading || isGoogleLoading || isGuestLoading}
        >
          <Text>Sign In with Email</Text>
        </Button>

        {/* Divider */}
        <View className="flex-row items-center my-2">
          <View className="flex-1 h-[1px] bg-border" />
          <Muted className="mx-4">or</Muted>
          <View className="flex-1 h-[1px] bg-border" />
        </View>

        {/* Social Logins */}
        {Platform.OS === "ios" && appleAuthAvailable && (
          <TouchableOpacity
            onPress={handleAppleSignIn}
            disabled={isAppleLoading || isGoogleLoading || isGuestLoading}
            className={`flex-row items-center justify-center p-3.5 rounded-lg ${
              isDark ? "bg-white" : "bg-black"
            } ${isAppleLoading ? "opacity-50" : ""}`}
          >
            {isAppleLoading ? (
              <ActivityIndicator size="small" color={isDark ? "#000" : "#fff"} />
            ) : (
              <>
                <Ionicons
                  name="logo-apple"
                  size={20}
                  color={isDark ? "#000" : "#fff"}
                />
                <Text
                  className={`ml-2 font-medium ${
                    isDark ? "text-black" : "text-white"
                  }`}
                >
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleGoogleSignIn}
          disabled={isAppleLoading || isGoogleLoading || isGuestLoading}
          className={`flex-row items-center justify-center p-3.5 rounded-lg border border-border bg-background ${
            isGoogleLoading ? "opacity-50" : ""
          }`}
        >
          {isGoogleLoading ? (
            <ActivityIndicator size="small" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text className="ml-2 font-medium">Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Guest Option */}
        <TouchableOpacity
          onPress={handleContinueAsGuest}
          disabled={isAppleLoading || isGoogleLoading || isGuestLoading}
          className="mt-2"
        >
          <View className="flex-row items-center justify-center p-3.5">
            {isGuestLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Ionicons 
                  name="eye-outline" 
                  size={20} 
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
                <Text className="ml-2 text-muted-foreground">
                  Continue as Guest
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Terms */}
        <Muted className="text-center text-xs mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Muted>
      </View>
    </SafeAreaView>
  );
}