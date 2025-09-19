import React, { useEffect, useRef } from "react";
import { View, Animated, Dimensions, StyleSheet, Easing } from "react-native";
import { Image } from "expo-image";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  const backgroundOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // AGGRESSIVE FALLBACK: Always complete animation after maximum 3 seconds
    const fallbackTimer = setTimeout(() => {
     
      onAnimationComplete();
    }, 3000);

    const runAnimation = async () => {
      try {
        // Step 1: Text fades in (background is already at 100% opacity)
        await new Promise((resolve) => {
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(resolve);
        });

        // Wait a moment (reduced from 1000ms to 500ms)
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Step 2: Fade out animation (faster)
        await new Promise((resolve) => {
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 200, // Reduced from 300ms
            easing: Easing.bezier(0.4, 0.4, 0.4, 0.4),
            useNativeDriver: true,
          }).start(resolve);
        });

        // Shorter final wait (reduced from 400ms)
        await new Promise((resolve) => setTimeout(resolve, 200));

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
  }, [backgroundOpacity, textOpacity, splashOpacity, onAnimationComplete]);

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
