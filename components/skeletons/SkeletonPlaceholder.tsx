import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

interface SkeletonPlaceholderProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  style?: any;
}

const SkeletonPlaceholder: React.FC<SkeletonPlaceholderProps> = ({
  width,
  height,
  borderRadius = 4,
  style,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sharedAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    sharedAnimation.start();

    return () => {
      sharedAnimation.stop();
    };
  }, [pulseAnim]);

  const animatedStyle = {
    opacity: pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    }),
  };

  return (
    <Animated.View
      style={[
        styles.placeholder,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#E1E9EE",
  },
});

export default SkeletonPlaceholder;
