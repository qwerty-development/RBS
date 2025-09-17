import React, { useEffect, useRef } from "react";
import { View, Animated, Dimensions, StyleSheet, Easing } from "react-native";
import { Image } from "expo-image";

const { width, height } = Dimensions.get("window");

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  skipAnimation?: boolean;
  fastMode?: boolean;
}

export default function AnimatedSplashScreen({
  onAnimationComplete,
  skipAnimation = false,
  fastMode = false,
}: AnimatedSplashScreenProps) {
  const backgroundOpacity = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const runAnimation = async () => {
      // Skip animation entirely for immediate deep link navigation
      if (skipAnimation) {
        onAnimationComplete();
        return;
      }

      // Use faster timing for deep link fast mode
      const timingConfig = fastMode
        ? { fadeIn: 200, wait: 300, fadeOut: 150, finalWait: 100 }
        : { fadeIn: 800, wait: 1000, fadeOut: 300, finalWait: 400 };

      // Step 1: Text fades in (background is already at 100% opacity)
      await new Promise((resolve) => {
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: timingConfig.fadeIn,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(resolve);
      });

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, timingConfig.wait));

      // Step 2: Fade out animation
      await new Promise((resolve) => {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: timingConfig.fadeOut,
          easing: Easing.bezier(0.4, 0.4, 0.4, 0.4), // Very smooth ease-out
          useNativeDriver: true,
        }).start(resolve);
      });

      // Wait a moment to ensure fade-out is visible
      await new Promise((resolve) =>
        setTimeout(resolve, timingConfig.finalWait),
      );

      // Animation complete
      onAnimationComplete();
    };

    runAnimation();
  }, [
    backgroundOpacity,
    textOpacity,
    splashOpacity,
    onAnimationComplete,
    skipAnimation,
    fastMode,
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
