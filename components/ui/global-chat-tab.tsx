import React, { useState } from "react";
import { View, Pressable, Modal } from "react-native";
import { Text } from "@/components/ui/text";
import ChatTestScreen from "@/app/(protected)/chat-test";
import { ChatMessage } from "@/ai/AI_Agent";

export function GlobalChatTab() {
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Moved from ChatTestScreen to persist chat history

  return (
    <>
      <View className="absolute right-0 top-[35%] -translate-y-1/2 z-50">
        <Pressable
          onPress={() => setShowChatModal(true)}
          className="items-center bg-white/85 justify-center py-4 px-2 rounded-l-md shadow-sm elevation-3"
        >
          <View className="-rotate-90">
            <Text className="text-blue-500 text-xs font-semibold tracking-wider">
              DineMate
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChatModal(false)}
      >
        <ChatTestScreen
          onClose={() => setShowChatModal(false)}
          messages={messages}
          setMessages={setMessages}
        />
      </Modal>
    </>
  );
}
