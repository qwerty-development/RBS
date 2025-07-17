import React from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "@/components/image";
import { LocationHeader } from "@/components/home/LocationHeader";
import { useColorScheme } from "@/lib/useColorScheme";
import { LocationDisplay } from "../search/LocationDisplay";

interface HomeHeaderProps {
  /** User profile data */
  profile: any;
  /** Whether user is a guest */
  isGuest: boolean;
  /** Current location */
  location: any;
  /** Header translate Y animation value */
  headerTranslateY: Animated.AnimatedAddition;
  /** Greeting opacity animation value */
  greetingOpacity: Animated.AnimatedInterpolation<string | number>;
  /** Total header height setter */
  setTotalHeaderHeight: (height: number) => void;
  /** Collapsible header height setter */
  setCollapsibleHeaderHeight: (height: number) => void;
  /** Location press handler */
  onLocationPress: () => void;
  /** Profile press handler */
  onProfilePress: () => void;
}

export function HomeHeader({
  profile,
  isGuest,
  location,
  headerTranslateY,
  greetingOpacity,
  setTotalHeaderHeight,
  setCollapsibleHeaderHeight,
  onLocationPress,
  onProfilePress,
}: HomeHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();

  return (
    <Animated.View
      className="absolute top-0 left-0 right-0 bg-background border-b border-border/20"
      onLayout={(event) => {
        setTotalHeaderHeight(event.nativeEvent.layout.height);
      }}
      style={{
        paddingTop: insets.top,
        transform: [{ translateY: headerTranslateY }],
        zIndex: 100,
        elevation: 100,
      }}
      pointerEvents="box-none"
    >
      <Animated.View
        onLayout={(event) => {
          setCollapsibleHeaderHeight(event.nativeEvent.layout.height);
        }}
        style={{ opacity: greetingOpacity }}
        pointerEvents="box-none"
      >
        <View
          className="flex-row items-center justify-between px-4 pt-4 pb-2"
          pointerEvents="box-none"
        >
          <View className="flex-1" pointerEvents="none">
            <Text className="text-2xl font-bold text-foreground">
              Hello {profile?.full_name?.split(" ")[0] || "there"}{" "}
              <Text className="text-2xl">👋</Text>
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/profile")}
            style={({ pressed }) => ({
              marginLeft: 12,
              padding: 4,
              zIndex: 999,
              elevation: 999,
              opacity: pressed ? 0.7 : 1,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            pointerEvents="box-only"
          >
            <View
              style={{
                position: "relative",
                zIndex: 999,
                elevation: 999,
              }}
            >
              <Image
                source={
                  profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : require("@/assets/default-avatar.jpeg")
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor:
                    colorScheme === "dark"
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,0,0,0.2)",
                }}
                contentFit="cover"
              />
              {/* Online status indicator */}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 12,
                  height: 12,
                  backgroundColor: "#22c55e",
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: colorScheme === "dark" ? "#000" : "#fff",
                  zIndex: 1000,
                  elevation: 1000,
                }}
              />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      <View className="-mt-2 px-4 pb-3 pt-1">
        <LocationDisplay />
      </View>
    </Animated.View>
  );
}
