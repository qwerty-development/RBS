import React from "react";
import { View, Modal, Pressable } from "react-native";
import { X, UserPlus, LogIn } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import { H3, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";

interface GuestPromptModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  feature?: string;
}

export function GuestPromptModal({
  visible,
  onClose,
  title = "Sign Up to Continue",
  message = "Create an account to unlock all features",
  feature,
}: GuestPromptModalProps) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  const handleSignUp = () => {
    onClose();
    router.push("/sign-up");
  };

  const handleSignIn = () => {
    onClose();
    router.push("/sign-in");
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="bg-background rounded-t-3xl p-6 pb-8"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="absolute right-4 top-4 z-10">
            <Pressable
              onPress={onClose}
              className="p-2 rounded-full bg-muted"
            >
              <X size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </Pressable>
          </View>

          <View className="items-center mb-6">
            <UserPlus size={48} className="text-primary mb-4" />
            <H3 className="text-center mb-2">{title}</H3>
            <P className="text-center text-muted-foreground">
              {feature
                ? `Sign up to ${feature}`
                : message}
            </P>
          </View>

          <View className="gap-3">
            <Button onPress={handleSignUp} className="w-full">
              <Text>Create Account</Text>
            </Button>
            
            <Button
              variant="outline"
              onPress={handleSignIn}
              className="w-full"
            >
              <Text>Sign In</Text>
            </Button>
          </View>

          <P className="text-center text-sm text-muted-foreground mt-4">
            Join thousands discovering great restaurants in Lebanon
          </P>
        </Pressable>
      </Pressable>
    </Modal>
  );
}