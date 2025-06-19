import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Dimensions,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Send, X } from "lucide-react-native";
import { ourAgent, ChatMessage } from "@/ai/AI_Agent";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { router } from "expo-router";

const { width: screenWidth } = Dimensions.get("window");

interface ChatTestScreenProps {
  onClose?: () => void;
  messages?: ChatMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

// Enhanced message component that can display text and restaurant cards
const MessageBubble = memo(
  ({
    message,
    onRestaurantPress,
  }: {
    message: ChatMessage;
    onRestaurantPress?: (restaurant: any) => void;
  }) => {
    const isUser = message.role === "user";
    const hasRestaurants =
      message.restaurants && message.restaurants.length > 0;

    const cardWidth = screenWidth - 80; // Account for message margins and padding

    const renderRestaurantCard = ({
      item: restaurant,
      index,
    }: {
      item: any;
      index: number;
    }) => (
      <View style={{ width: cardWidth, paddingRight: 12 }}>
        <RestaurantCard
          key={restaurant.id || index}
          restaurant={restaurant}
          variant="featured"
          className="shadow-sm"
          onPress={() => onRestaurantPress?.(restaurant)}
        />
      </View>
    );

    return (
      <View className={`mb-4 ${isUser ? "ml-12" : "mr-12"}`}>
        {/* Text content */}
        {message.content && (
          <View
            className={`p-3 rounded-lg ${isUser ? "bg-primary" : "bg-muted"}`}
          >
            <Text
              className={isUser ? "text-primary-foreground" : "text-foreground"}
            >
              {message.content}
            </Text>
          </View>
        )}

        {/* Restaurant cards - Horizontal scrollable */}
        {hasRestaurants && (
          <View className="mt-3">
            <FlatList
              data={message.restaurants}
              renderItem={renderRestaurantCard}
              keyExtractor={(restaurant, index) =>
                restaurant.id || index.toString()
              }
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              snapToInterval={cardWidth + 12}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingLeft: 4,
                paddingRight: 4,
              }}
            />
            {message.restaurants!.length > 1 && (
              <View className="flex-row justify-center mt-2">
                <Text className="text-xs text-muted-foreground">
                  Swipe to see more restaurants ({message.restaurants!.length}{" "}
                  total)
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }
);

const ChatTestScreen = memo(function ChatTestScreen({
  onClose,
  messages: externalMessages,
  setMessages: externalSetMessages,
}: ChatTestScreenProps) {
  // Use external state if provided, otherwise use local state (for backwards compatibility)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messages = externalMessages ?? localMessages;
  const setMessages = externalSetMessages ?? setLocalMessages;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change (optimized for speed)
  useEffect(() => {
    if (scrollViewRef.current) {
      // Small delay to allow for card rendering
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // Store current input and clear immediately for better UX
    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    const currentMessages = [...messages, userMessage];

    // Single batch update: add user message, clear input, set loading
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending message:", trimmedInput);

      // Call AI agent with current message context
      console.log("Calling AI agent...");
      const response = await ourAgent(currentMessages);
      console.log("AI response received:", response);

      // Single atomic update: add response and clear loading
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    } catch (error) {
      console.error("Error in chat:", error);
      setIsLoading(false);
      // Optionally add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
  }, [input, messages, setMessages]);

  const handleRestaurantPress = useCallback(
    (restaurant: any) => {
      // Close the chat when restaurant is pressed
      if (onClose) {
        onClose();
      }

      router.push(`/restaurant/${restaurant.id}`);
      console.log("Restaurant pressed:", restaurant.id);
    },
    [onClose]
  );

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
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          // Delay scroll to allow for card rendering
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }}
      >
        {messages.length === 0 && (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-muted-foreground text-center mb-4">
              👋 Hi! I'm DineMate, your AI dining assistant.
            </Text>
            <Text className="text-muted-foreground text-center text-sm mb-4">
              I can help you find restaurants, make reservations, get
              recommendations, and answer questions about dining options.
            </Text>
            <View className="bg-muted p-3 rounded-lg">
              <Text className="text-sm text-muted-foreground text-center">
                Try asking: "Show me Italian restaurants" or "Find places with
                outdoor seating"
              </Text>
            </View>
          </View>
        )}

        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            onRestaurantPress={handleRestaurantPress}
          />
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
            className="flex-1 border border-border rounded-lg px-3 py-2 text-foreground"
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Button onPress={handleSend} disabled={isLoading || !input.trim()}>
            <Send size={20} color="white" />
          </Button>
        </View>
      </View>
    </View>
  );
});

export default ChatTestScreen;
