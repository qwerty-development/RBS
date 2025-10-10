import React, { useMemo, useRef, useState } from "react";
import { View, Dimensions, Image as RNImage } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, Muted, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { getThemedColors } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";

const { width, height } = Dimensions.get("window");

type Slide = {
  key: string;
  title: string;
  subtitle: string;
  image: any;
  cta?: string;
};

const SLIDES: Slide[] = [
  {
    key: "discover",
    title: "Discover great restaurants",
    subtitle: "Curated lists, trending spots, and picks for your tastes.",
    image: require("@/assets/onboarding/discover.png"),
  },
  {
    key: "book",
    title: "Book in a few taps",
    subtitle: "Live availability, instant booking, and smart reminders.",
    image: require("@/assets/onboarding/book.png"),
  },
  {
    key: "friends",
    title: "Plan with friends",
    subtitle: "Invite, coordinate, and share plans in one place.",
    image: require("@/assets/onboarding/friends.png"),
  },
  {
    key: "rewards",
    title: "Earn rewards",
    subtitle: "Collect points and unlock perks as you dine.",
    image: require("@/assets/onboarding/rewards.png"),
    cta: "Get started",
  },
  {
    key: "ai",
    title: "Not finding a place to eat? Ask Dinemate AI",
    subtitle: "Dinemate AI will help you find the perfect restaurant.",
    image: require("@/assets/onboarding/ai.png"),
    cta: "Get started",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const themed = getThemedColors(colorScheme);
  const { updateProfile } = useAuth();

  const scrollX = useSharedValue(0);
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const handleComplete = async (): Promise<void> => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);
      await updateProfile({ onboarded: true });
      router.replace("/(protected)/(tabs)");
    } catch {
      router.replace("/(protected)/(tabs)");
    }
  };

  const next = (): void => {
    if (isCompleting) return;

    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex((i) => i + 1);
    } else {
      void handleComplete();
    }
  };

  const skip = (): void => {
    if (isCompleting) return;
    void handleComplete();
  };

  const indicators = useMemo(
    () =>
      SLIDES.map((_, i) => {
        return <Dot key={i} i={i} scrollX={scrollX} />;
      }),
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          // All onboarding images are 400x700 (portrait)
          const aspect = 400 / 700;

          // Responsive bounds: up to 90% width, up to ~48% screen height
          const maxW = Math.floor(width * 0.9);
          const maxH = Math.floor(height * 0.48);

          // Fit image preserving aspect within the bounds
          const displayWidth = Math.min(maxW, Math.floor(maxH * aspect));
          const displayHeight = Math.floor(displayWidth / aspect);

          return (
            <View
              style={{ width }}
              className="flex-1 items-center justify-center p-6 gap-6"
            >
              <RNImage
                source={item.image}
                resizeMode="contain"
                style={{
                  width: displayWidth,
                  height: displayHeight,
                  borderRadius: 14,
                }}
              />
              <H1 className="text-center">{item.title}</H1>
              <P className="text-center text-muted-foreground">
                {item.subtitle}
              </P>
            </View>
          );
        }}
      />

      <View className="px-6 pb-6 gap-4">
        <View className="flex-row self-center gap-2">{indicators}</View>
        <View className="flex-row gap-3">
          <Button variant="ghost" className="flex-1" onPress={skip}>
            <Text>Skip</Text>
          </Button>
          <Button className="flex-1" onPress={next}>
            <Text>
              {index === SLIDES.length - 1
                ? SLIDES[index].cta || "Done"
                : "Next"}
            </Text>
          </Button>
        </View>
        <Muted className="text-center">
          You can change these anytime in Settings.
        </Muted>
      </View>
    </SafeAreaView>
  );
}

function Dot({
  i,
  scrollX,
}: {
  i: number;
  scrollX: Animated.SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1.2, 0.8],
      Extrapolate.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolate.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });
  return (
    <Animated.View style={style} className="w-2 h-2 rounded-full bg-primary" />
  );
}
