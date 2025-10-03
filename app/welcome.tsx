// app/welcome.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
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

// No background images; use theme primary color as background

export default function WelcomeScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { appleSignIn, googleSignIn, continueAsGuest } = useAuth();
  const isDark = colorScheme === "dark";

  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  // No slideshow state; static primary background

  const appIcon = require("@/assets/transparent-icon.png");

  const slotWords = ["Book", "Discover", "Earn", "Share", "Review"];
  const [slotIndex, setSlotIndex] = useState(0);
  const slotOpacity = useState(new Animated.Value(1))[0];
  const slotTranslateY = useState(new Animated.Value(0))[0];

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

  // Slot-like word loop
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(slotOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSlotIndex((prev) => (prev + 1) % slotWords.length);
        slotTranslateY.setValue(6);
        Animated.parallel([
          Animated.timing(slotOpacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(slotTranslateY, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 1400);
    return () => clearInterval(interval);
  }, [slotOpacity, slotTranslateY]);

  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      const { error } = await appleSignIn();

      if (error) {
        if (error.message !== "User canceled Apple sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Apple sign in failed.",
          );
        }
      }
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

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await googleSignIn();

      if (error) {
        if (error.message !== "User canceled Google sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Google sign in failed.",
          );
        }
      }
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

  const handleContinueAsGuest = async () => {
    try {
      setIsGuestLoading(true);
      await continueAsGuest();
    } catch (err: any) {
      console.error("Guest mode error:", err);
      Alert.alert("Error", "Failed to continue as guest. Please try again.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  const isLoading = isAppleLoading || isGoogleLoading || isGuestLoading;

  return (
    <View className="flex-1 bg-primary">
      <SafeAreaView className="flex flex-1 px-3" edges={["top"]}>
        <View className="flex flex-1 items-center justify-center px-6">
          <Image source={appIcon} className="w-32 h-32 rounded-2xl mb-6" />
          <H1 className="text-center mb-2 text-white">Welcome to Plate</H1>
          <Text className="text-center max-w-md text-lg leading-relaxed text-white/90">
            Discover and book from a wide variety of restaurants
          </Text>
          <Text className="text-center mt-2 text-white/80 text-lg">
            Here you can
          </Text>
          <Animated.View
            style={{
              opacity: slotOpacity,
              transform: [{ translateY: slotTranslateY }],
            }}
          >
            <Text className="text-center mt-3 text-white font-semibold text-lg">
              {slotWords[slotIndex]}
            </Text>
          </Animated.View>
        </View>

        <View
          className="rounded-3xl overflow-hidden mt-auto mx-3 mb-12"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 14,
          }}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 20,
              paddingBottom: 24,
              backgroundColor: isDark
                ? "rgba(0,0,0,0.55)"
                : "rgba(255,255,255,0.75)",
              borderRadius: 24,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.12)"
                : "rgba(0,0,0,0.06)",
            }}
          >
            {/* Primary Actions */}
            <View className="gap-y-3 mb-6">
              <Button
                size="default"
                variant="default"
                onPress={() => router.push("/sign-up")}
                disabled={isLoading}
                className="h-14 rounded-lg"
              >
                <Text>Create Account</Text>
              </Button>

              <Button
                size="default"
                variant="outline"
                onPress={() => router.push("/sign-in")}
                disabled={isLoading}
                className="h-14 rounded-lg"
              >
                <Text>Sign In</Text>
              </Button>
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-6">
              <View
                className={`flex-1 h-[1px] ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
              <Text
                className={`mx-4 text-sm ${isDark ? "text-white/80" : "text-black/70"}`}
              >
                or continue with
              </Text>
              <View
                className={`flex-1 h-[1px] ${isDark ? "bg-white/20" : "bg-black/20"}`}
              />
            </View>

            {/* Social Login Buttons */}
            <View className="flex-row gap-x-3 mb-4">
              {Platform.OS === "ios" && appleAuthAvailable && (
                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={isLoading}
                  className={`flex-1 flex-row items-center justify-center h-14 rounded-lg ${
                    isAppleLoading ? "opacity-50" : ""
                  }`}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: "#000",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 2,
                  }}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#fff" />
                      <Text className="ml-2 font-medium text-white">Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                className={`${Platform.OS === "ios" && appleAuthAvailable ? "flex-1" : "w-full"} flex-row items-center justify-center h-14 rounded-lg ${
                  isGoogleLoading ? "opacity-50" : ""
                }`}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "#000",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                }}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#fff" />
                    <Text className="ml-2 font-medium text-white">Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Guest Option */}
            <TouchableOpacity
              onPress={handleContinueAsGuest}
              disabled={isLoading}
              className="items-center justify-center h-14 rounded-lg"
              activeOpacity={0.7}
              style={{
                backgroundColor: "#000",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
              }}
            >
              {isGuestLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="font-medium text-white">Browse as Guest</Text>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <Text
              className={`text-center text-xs mt-6 leading-relaxed ${isDark ? "text-white/70" : "text-black/60"}`}
            >
              By continuing, you agree to our{"\n"}
              Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
