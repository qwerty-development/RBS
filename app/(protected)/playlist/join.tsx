// app/(protected)/playlist/join.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  QrCode,
  FolderPlus,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { usePlaylistSharing } from "@/hooks/usePlaylistSharing";

export default function JoinPlaylistScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const [code, setCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  const { joinPlaylistByCode } = usePlaylistSharing(null);

  // Handle single character input
  const handleCodeChange = useCallback((text: string, index: number) => {
    const newCode = code.split('');
    newCode[index] = text.toUpperCase();
    const updatedCode = newCode.join('');
    setCode(updatedCode);

    // Move to next input if character entered
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [code]);

  // Handle backspace
  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  // Handle paste
  const handlePaste = useCallback((pastedText: string) => {
    const cleanedCode = pastedText.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
    setCode(cleanedCode);
    
    // Focus last input or blur if code is complete
    if (cleanedCode.length === 6) {
      Keyboard.dismiss();
    } else {
      inputRefs.current[cleanedCode.length]?.focus();
    }
  }, []);

  // Handle join
  const handleJoin = useCallback(async () => {
    if (code.length !== 6) return;

    setIsJoining(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { success, playlistId } = await joinPlaylistByCode(code);
      
      if (success && playlistId) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({
          pathname: "/playlist/[id]",
          params: { id: playlistId },
        });
      }
    } finally {
      setIsJoining(false);
    }
  }, [code, joinPlaylistByCode, router]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-4 py-3 flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
          <H3 className="ml-2">Join Playlist</H3>
        </View>

        <View className="flex-1 px-6">
          {/* Icon and Instructions */}
          <View className="items-center mt-8 mb-12">
            <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-6">
              <FolderPlus size={48} color="#dc2626" />
            </View>
            
            <H2 className="text-center mb-3">Enter Playlist Code</H2>
            <Muted className="text-center text-base">
              Ask the playlist owner for their 6-character share code
            </Muted>
          </View>

          {/* Code Input */}
          <View className="flex-row justify-center gap-2 mb-8">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                value={code[index] || ""}
                onChangeText={(text) => {
                  if (text.length <= 1) {
                    handleCodeChange(text, index);
                  } else {
                    // Handle paste
                    handlePaste(text);
                  }
                }}
                onKeyPress={(e) => handleKeyPress(e, index)}
                maxLength={1}
                autoCapitalize="characters"
                keyboardType="default"
                className={`
                  w-12 h-14 text-center text-xl font-bold rounded-xl
                  ${code[index]
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"
                  }
                `}
                editable={!isJoining}
              />
            ))}
          </View>

          {/* Join Button */}
          <Button
            onPress={handleJoin}
            disabled={code.length !== 6 || isJoining}
            className="mb-4"
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-semibold">Join Playlist</Text>
            )}
          </Button>



          {/* Tips */}
          <View className="mt-auto mb-8 bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
            <Text className="font-semibold mb-2">💡 Tips</Text>
            <Muted className="text-sm leading-5">
              • Playlist codes are 6 characters long{"\n"}
              • They contain only letters and numbers{"\n"}
              • Codes are not case sensitive{"\n"}
              • You can paste a code from your clipboard
            </Muted>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};