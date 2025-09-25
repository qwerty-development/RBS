import React, { useEffect, useRef } from "react";
import { View, Animated, Dimensions, StyleSheet, Easing } from "react-native";
import { Image } from "expo-image";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  skipAnimation?: boolean; // NUCLEAR: Option to skip animation completely
}

export default function AnimatedSplashScreen({
  onAnimationComplete,
  skipAnimation = false,
}: AnimatedSplashScreenProps) {
  const backgroundOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // NUCLEAR: If skipAnimation is true, complete immediately
    if (skipAnimation) {
      onAnimationComplete();
      return;
    }

    // NUCLEAR FALLBACK: Always complete animation ASAP
    const fallbackTimer = setTimeout(() => {
      onAnimationComplete();
    }, 500);

    const runAnimation = async () => {
      try {
        // Step 1: Text fades in NUCLEAR FAST
        await new Promise((resolve) => {
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 100, // NUCLEAR: Super fast
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(resolve);
        });

        // NUCLEAR: Minimal wait
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Step 2: NUCLEAR fade out
        await new Promise((resolve) => {
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 50, // NUCLEAR: Super fast
            easing: Easing.bezier(0.4, 0.4, 0.4, 0.4),
            useNativeDriver: true,
          }).start(resolve);
        });

        // NUCLEAR: No final wait
        await new Promise((resolve) => setTimeout(resolve, 10));

        clearTimeout(fallbackTimer);
        // Animation complete
        onAnimationComplete();
      } catch (error) {
        console.warn("Animation error, completing anyway:", error);
        clearTimeout(fallbackTimer);
        onAnimationComplete();
      }
    };

    runAnimation();

    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [
    backgroundOpacity,
    textOpacity,
    splashOpacity,
    onAnimationComplete,
    skipAnimation,
  ]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: splashOpacity,
        },
      ]}
    >
      {/* Background */}
      <Animated.View
        style={[
          styles.background,
          {
            opacity: backgroundOpacity,
          },
        ]}
      />

      {/* Text Logo */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
          },
        ]}
      >
        <Image
          source={require("../assets/text-plate.png")}
          style={styles.textLogo}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffece2",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textLogo: {
    width: width * 0.7,
    height: height * 0.2,
  },
});
