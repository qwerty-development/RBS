import React, { useState } from "react";
import { View, Pressable, Modal, Animated } from "react-native";
import { MessageCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import ChatTestScreen from "@/app/(protected)/chat-test";

export function GlobalChatTab() {
  const { colorScheme } = useColorScheme();
  const [showChatModal, setShowChatModal] = useState(false);
  const [animatedValue] = useState(new Animated.Value(0));

  React.useEffect(() => {
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    const timeout = setTimeout(() => {
      bounceAnimation.start();
    }, 3000); // Start animation after 3 seconds

    return () => {
      clearTimeout(timeout);
      bounceAnimation.stop();
    };
  }, [animatedValue]);

  const animatedScale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.1, 1],
  });

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: [{ translateY: -50 }, { scale: animatedScale }],
          zIndex: 1000,
        }}
      >
        <Pressable
          onPress={() => setShowChatModal(true)}
          style={{
            backgroundColor:
              colorScheme === "dark"
                ? colors.dark.primary
                : colors.light.primary,
            paddingVertical: 20,
            paddingHorizontal: 12,
            borderTopLeftRadius: 24,
            borderBottomLeftRadius: 24,
            shadowColor: "#000",
            shadowOffset: {
              width: -2,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
          }}
          className="items-center justify-center"
        >
          <View className="items-center gap-2">
            <MessageCircle size={28} color="white" strokeWidth={2} />
            <View style={{ transform: [{ rotate: "-90deg" }] }}>
              <Text className="text-primary-foreground text-xs font-bold tracking-wider">
                DINEMATE
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChatModal(false)}
      >
        <ChatTestScreen onClose={() => setShowChatModal(false)} />
      </Modal>
    </>
  );
}
