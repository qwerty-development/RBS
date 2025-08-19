import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Send, X, Wifi, WifiOff } from "lucide-react-native";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { router } from "expo-router";
import { supabase } from "@/config/supabase";
import { RESTO_AI_BASE_URL } from "@/config/ai";
import { OptimizedList } from "@/components/ui/optimized-list";

const { width: screenWidth } = Dimensions.get("window");

// RestoAI backend configuration
const AI_API_BASE_URL = RESTO_AI_BASE_URL; // Centralized base URL

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  restaurants?: any[];
}

interface ChatTestPyScreenProps {
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
            <OptimizedList
              data={message.restaurants ?? []}
              renderItem={renderRestaurantCard}
              keyExtractor={(restaurant, index) =>
                restaurant.id || index.toString()
              }
              listProps={{
                horizontal: true,
                showsHorizontalScrollIndicator: false,
                pagingEnabled: true,
                snapToInterval: cardWidth + 12,
                decelerationRate: "fast",
                contentContainerStyle: {
                  paddingLeft: 4,
                  paddingRight: 4,
                },
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
  },
);

// Function to communicate with RestoAI backend
async function sendMessageToRestoAI(
  message: string,
  sessionId?: string,
  userId?: string,
): Promise<ChatMessage> {
  try {
    const response = await fetch(`${AI_API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        session_id: sessionId || "default",
        user_id: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.error || "API request failed");
    }

    // Fetch restaurant details if restaurant IDs were returned
    let restaurants: any[] = [];
    if (data.restaurants_to_show && data.restaurants_to_show.length > 0) {
      console.log(
        "Fetching restaurant details for IDs:",
        data.restaurants_to_show,
      );

      try {
        const { data: restaurantData, error } = await supabase
          .from("restaurants")
          .select("*")
          .in("id", data.restaurants_to_show);

        if (error) {
          console.error("Error fetching restaurant details:", error);
        } else {
          // Sort restaurants to match the order from the API (featured first)
          const restaurantMap = new Map(restaurantData?.map((r) => [r.id, r]));
          restaurants = data.restaurants_to_show
            .map((id: string) => restaurantMap.get(id))
            .filter(Boolean);
        }
      } catch (error) {
        console.error("Error fetching restaurant details:", error);
      }
    }

    return {
      role: "assistant",
      content: data.response,
      restaurants: restaurants.length > 0 ? restaurants : undefined,
    };
  } catch (error) {
    console.error("Error communicating with RestoAI API:", error);
    throw error;
  }
}

// Function to check if RestoAI backend is available (with fallback to root)
async function checkRestoAIHealth(timeoutMs: number = 8000): Promise<boolean> {
  const tryFetch = async (path: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${AI_API_BASE_URL}${path}`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };

  try {
    const ok = await tryFetch("/api/health");
    if (ok) return true;
  } catch (_) {}

  try {
    const okRoot = await tryFetch("/");
    return okRoot;
  } catch (error) {
    console.error("RestoAI API health check failed:", error);
    return false;
  }
}

const ChatTestPyScreen = memo(function ChatTestPyScreen({
  onClose,
  messages: externalMessages,
  setMessages: externalSetMessages,
}: ChatTestPyScreenProps) {
  // Use external state if provided, otherwise use local state
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messages = externalMessages ?? localMessages;
  const setMessages = externalSetMessages ?? setLocalMessages;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const scrollViewRef = useRef<ScrollView>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Check API health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      const isHealthy = await checkRestoAIHealth();
      setApiConnected(isHealthy);

      if (!isHealthy) {
        Alert.alert(
          "Connection Error",
          `Cannot connect to RestoAI backend at ${AI_API_BASE_URL}. Please make sure the server is running.`,
          [{ text: "OK" }],
        );
      }
    };

    checkHealth();
  }, []);

  // Load user ID once from Supabase session
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUserId(data.session?.user?.id);
      } catch {}
    };
    loadUserId();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    if (apiConnected === false) {
      // Re-try health check just-in-time before blocking send
      const nowHealthy = await checkRestoAIHealth(8000);
      if (!nowHealthy) {
        Alert.alert(
          "No Connection",
          "Cannot send message - RestoAI backend is not available. Please check if the server is running.",
        );
        return;
      }
      setApiConnected(true);
    }

    // Store current input and clear immediately for better UX
    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    const currentMessages = [...messages, userMessage];

    // Single batch update: add user message, clear input, set loading
    setMessages(currentMessages);
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending message to RestoAI API:", trimmedInput);

      // Call RestoAI API
      const response = await sendMessageToRestoAI(
        trimmedInput,
        sessionId,
        userId,
      );
      console.log("RestoAI API response received:", response);

      // Single atomic update: add response and clear loading
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
      setApiConnected(true);
    } catch (error) {
      console.error("Error in chat:", error);
      setIsLoading(false);

      // Check if it's a connection error
      const isConnectionError =
        error instanceof Error &&
        (error.message.includes("fetch") || error.message.includes("Network"));

      setApiConnected(false);

      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isConnectionError
            ? "Sorry, I'm having trouble connecting to the server. Please check if the RestoAI backend is running and try again."
            : "Sorry, I encountered an error. Please try again.",
        },
      ]);
    }
  }, [input, messages, setMessages, sessionId, apiConnected]);

  const handleRestaurantPress = useCallback(
    (restaurant: any) => {
      // Close the chat when restaurant is pressed
      if (onClose) {
        onClose();
      }

      router.push(`/restaurant/${restaurant.id}`);
      console.log("Restaurant pressed:", restaurant.id);
    },
    [onClose],
  );

  const resetChat = useCallback(async () => {
    try {
      // Call RestoAI API to reset chat
      await fetch(`${AI_API_BASE_URL}/api/chat/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
        }),
      });

      // Clear local messages
      setMessages([]);
    } catch (error) {
      console.error("Error resetting chat:", error);
      // Still clear local messages even if API call fails
      setMessages([]);
    }
  }, [sessionId, setMessages]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 0}
    >
      <View className="flex-1 bg-background">
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <H3>DineMate AI Assistant</H3>
                <View className="flex-row items-center">
                  {apiConnected === true ? (
                    <Wifi size={16} color="#22c55e" />
                  ) : apiConnected === false ? (
                    <WifiOff size={16} color="#ef4444" />
                  ) : (
                    <Text className="text-xs text-muted-foreground">
                      Checking...
                    </Text>
                  )}
                </View>
              </View>
              <Text className="text-muted-foreground">
                RestoAI-powered chat assistant for restaurant recommendations
              </Text>
                {apiConnected === false && (
                <Text className="text-xs text-red-500 mt-1">
                  API Disconnected - Check if RestoAI server is running at {" "}
                  {AI_API_BASE_URL}
                </Text>
              )}
            </View>
            <View className="flex-row gap-2 ml-4">
              <Pressable
                onPress={resetChat}
                className="p-2 rounded-full bg-muted"
              >
                <Text className="text-xs">Reset</Text>
              </Pressable>
              {onClose && (
                <Pressable
                  onPress={onClose}
                  className="p-2 rounded-full bg-muted"
                >
                  <X size={20} color="#666" />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1 p-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        >
          {messages.length === 0 && (
            <View className="flex-1 items-center justify-center py-8">
              <Text className="text-muted-foreground text-center mb-4">
                🐍 Hi! I'm DineMate powered by Python & Flask.
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
              {apiConnected === false && (
                <View className="bg-red-100 p-3 rounded-lg mt-4">
                  <Text className="text-sm text-red-700 text-center">
                    ⚠️ RestoAI backend is not connected.
                  </Text>
                </View>
              )}
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
              editable={apiConnected !== false}
            />
            <Button
              onPress={handleSend}
              disabled={isLoading || !input.trim() || apiConnected === false}
            >
              <Send size={20} color="white" />
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});

export default ChatTestPyScreen;
