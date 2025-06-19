import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, ScrollView, TextInput, Pressable } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Send, X } from "lucide-react-native";
import { ourAgent, ChatMessage } from "@/ai/AI_Agent";

interface ChatTestScreenProps {
  onClose?: () => void;
}

export default function ChatTestScreen({ onClose }: ChatTestScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    try {
      setIsLoading(true);
      console.log("Sending message:", input);

      // Add user message to chat
      const userMessage: ChatMessage = { role: "user", content: input };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Call the AI agent
      console.log("Calling AI agent...");
      const response = await ourAgent([...messages, userMessage]);
      console.log("AI response:", response);

      // Add AI response to chat
      setMessages((prev) => [...prev, response]);
    } catch (error) {
      console.error("Error in chat:", error);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages]);

  return (
    <View className="flex-1 bg-background">
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <H3>DineMate AI Assistant</H3>
            <Text className="text-muted-foreground">
              Ask me anything about restaurants, dining, or make a reservation!
            </Text>
          </View>
          {onClose && (
            <Pressable
              onPress={onClose}
              className="ml-4 p-2 rounded-full bg-muted"
            >
              <X size={20} color="#666" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1 p-4"
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length === 0 && (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-muted-foreground text-center mb-4">
              👋 Hi! I'm DineMate, your AI dining assistant.
            </Text>
            <Text className="text-muted-foreground text-center text-sm">
              I can help you find restaurants, make reservations, get
              recommendations, and answer questions about dining options.
            </Text>
          </View>
        )}

        {messages.map((message, index) => (
          <View
            key={index}
            className={`mb-4 p-3 rounded-lg ${
              message.role === "user" ? "bg-primary ml-12" : "bg-muted mr-12"
            }`}
          >
            <Text
              className={
                message.role === "user"
                  ? "text-primary-foreground"
                  : "text-foreground"
              }
            >
              {message.content}
            </Text>
          </View>
        ))}

        {isLoading && (
          <View className="mb-4 p-3 rounded-lg bg-muted mr-12">
            <Text className="text-foreground">DineMate is thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View className="p-4 border-t border-border">
        <View className="flex-row gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask me about restaurants, make a reservation..."
            className="flex-1 border border-border rounded-lg px-3 py-2"
            multiline
            maxLength={500}
          />
          <Button onPress={handleSend} disabled={isLoading || !input.trim()}>
            <Send size={20} color="white" />
          </Button>
        </View>
      </View>
    </View>
  );
}
