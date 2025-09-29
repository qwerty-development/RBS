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
  Animated,
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
import { InputValidator } from "@/lib/security";

const { width: screenWidth } = Dimensions.get("window");

// RestoAI backend configuration
const AI_API_BASE_URL = RESTO_AI_BASE_URL; // Centralized base URL

// Waving hand animation component
const WavingHandAnimation = memo(() => {
  const waveAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createWaveAnimation = () => {
      return Animated.sequence([
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]);
    };

    const startAnimation = () => {
      createWaveAnimation().start(() => {
        // Repeat the animation after a delay
        setTimeout(startAnimation, 2000);
      });
    };

    startAnimation();
  }, [waveAnimation]);

  const rotateInterpolate = waveAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "20deg"],
  });

  return (
    <View className="items-center justify-center py-8">
      <Animated.View
        style={{
          transform: [{ rotate: rotateInterpolate }],
        }}
        className="bg-primary p-4 rounded-full shadow-lg"
      >
        <Text className="text-4xl">👋</Text>
      </Animated.View>
      <Text className="text-lg font-medium text-foreground mt-4">
        DineMate is ready to help!
      </Text>
      <Text className="text-sm text-muted-foreground mt-2 text-center px-4">
        Ask me about restaurants, make reservations, or get dining
        recommendations
      </Text>
    </View>
  );
});

// Enhanced typing indicator component
const TypingIndicator = memo(() => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    createDotAnimation(dot1, 0).start();
    createDotAnimation(dot2, 200).start();
    createDotAnimation(dot3, 400).start();
  }, []);

  const dot1Scale = dot1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const dot2Scale = dot2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  const dot3Scale = dot3.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  return (
    <View className="mb-4 mr-12">
      <View className="bg-muted p-4 rounded-2xl border border-border">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 bg-primary rounded-full items-center justify-center">
            <Text className="text-primary-foreground text-sm font-bold">
              AI
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Animated.View
              style={{
                transform: [{ scale: dot1Scale }],
              }}
              className="w-2 h-2 bg-primary rounded-full"
            />
            <Animated.View
              style={{
                transform: [{ scale: dot2Scale }],
              }}
              className="w-2 h-2 bg-primary rounded-full"
            />
            <Animated.View
              style={{
                transform: [{ scale: dot3Scale }],
              }}
              className="w-2 h-2 bg-primary rounded-full"
            />
          </View>
          <Text className="text-sm text-muted-foreground ml-2">
            DineMate is thinking...
          </Text>
        </View>
      </View>
    </View>
  );
});

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
            className={`p-4 rounded-2xl ${
              isUser
                ? "bg-primary shadow-lg"
                : "bg-muted border border-border shadow-sm"
            }`}
          >
            {!isUser && (
              <View className="flex-row items-center gap-2 mb-2">
                <View className="w-6 h-6 bg-primary rounded-full items-center justify-center">
                  <Text className="text-primary-foreground text-xs font-bold">
                    AI
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground font-medium">
                  DineMate
                </Text>
              </View>
            )}
            <Text
              className={`text-sm leading-5 ${
                isUser ? "text-primary-foreground" : "text-foreground"
              }`}
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
  conversationHistory: ChatMessage[] = [],
  sessionId?: string,
  userId?: string,
): Promise<ChatMessage> {
  try {
    // Get current user session for JWT authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Get last 10 message pairs (20 messages total) for context
    const recentHistory = conversationHistory.slice(-20);

    // Format conversation history for the AI backend
    const formattedHistory = recentHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
      // Don't send restaurant data in history to keep payload lean
    }));

    // Prepare headers with JWT authentication
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add JWT token if user is authenticated
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const response = await fetch(`${AI_API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        message: message,
        conversation_history: formattedHistory,
        session_id: sessionId || "default",
        user_id: session?.user?.id || userId, // Use session user ID if available
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          `Authentication failed: Your session may have expired. Please log in again.`,
        );
      } else if (response.status === 403) {
        throw new Error(
          `Access denied: You don't have permission to access this feature.`,
        );
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.error || "API request failed");
    }

    // Fetch restaurant details if restaurant IDs were returned
    let restaurants: any[] = [];
    if (data.restaurants_to_show && data.restaurants_to_show.length > 0) {
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

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

  // Load user ID and authentication status from Supabase session
  useEffect(() => {
    const loadUserSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        setUserId(session?.user?.id);
        setIsAuthenticated(!!session?.access_token);

        if (session?.user?.id) {
        } else {
        }
      } catch (error) {
        console.error("Error loading user session:", error);
        setIsAuthenticated(false);
      }
    };
    loadUserSession();
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

    // Validate content for basic length and spam (removed overly strict profanity check)
    const validation = InputValidator.validateContent(trimmedInput, {
      maxLength: 500,
      minLength: 1,
      checkProfanity: false, // Disabled overly strict profanity filter for restaurant queries
      fieldName: "message",
    });

    if (!validation.isValid) {
      Alert.alert("Content Issue", validation.errors.join("\n"));
      return;
    }

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
      // Sliding window: Keep last 20 messages (10 user + 10 AI pairs) for context
      // This ensures the AI remembers recent conversation without overwhelming the API
      const historyToSend = messages.slice(-20);

      // Call RestoAI API with conversation history
      const response = await sendMessageToRestoAI(
        trimmedInput,
        messages, // Pass current conversation history
        sessionId,
        userId,
      );

      // Single atomic update: add response and clear loading
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
      setApiConnected(true);
    } catch (error) {
      console.error("Error in chat:", error);
      setIsLoading(false);

      let errorMessage = "Sorry, I encountered an error. Please try again.";

      if (error instanceof Error) {
        // Check for authentication errors
        if (
          error.message.includes("Authentication failed") ||
          error.message.includes("401")
        ) {
          errorMessage =
            "Your session has expired. Please log in again to continue using personalized features.";
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again to access personalized AI features.",
            [{ text: "OK" }],
          );
        } else if (
          error.message.includes("Access denied") ||
          error.message.includes("403")
        ) {
          errorMessage =
            "You don't have permission to access this feature. Please contact support if you believe this is an error.";
        } else if (
          error.message.includes("fetch") ||
          error.message.includes("Network")
        ) {
          // Connection error
          setApiConnected(false);
          errorMessage =
            "Sorry, I'm having trouble connecting to the server. Please check if the RestoAI backend is running and try again.";
        }
      }

      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage,
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
    },
    [onClose],
  );

  const resetChat = useCallback(async () => {
    try {
      // Get current user session for JWT authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Prepare headers with JWT authentication
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add JWT token if user is authenticated
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Call RestoAI API to reset chat with conversation history cleared
      await fetch(`${AI_API_BASE_URL}/api/chat/reset`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          session_id: sessionId,
          user_id: session?.user?.id || userId,
          clear_history: true, // Signal to clear conversation history
        }),
      });

      // Clear local messages
      setMessages([]);
    } catch (error) {
      console.error("Error resetting chat:", error);
      // Still clear local messages even if API call fails
      setMessages([]);
    }
  }, [sessionId, setMessages, userId]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 70 : 0}
    >
      <View className="flex-1 bg-background">
        <View className="bg-primary p-4 shadow-lg">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 bg-primary-foreground/20 rounded-full items-center justify-center">
                  <Text className="text-2xl">🤖</Text>
                </View>
                <View>
                  <H3 className="text-primary-foreground">
                    DineMate AI Assistant
                  </H3>
                  <View className="flex-row items-center gap-2">
                    {apiConnected === true ? (
                      <>
                        <Wifi size={14} color="#22c55e" />
                        <Text className="text-xs text-green-200">
                          Connected
                        </Text>
                      </>
                    ) : apiConnected === false ? (
                      <>
                        <WifiOff size={14} color="#ef4444" />
                        <Text className="text-xs text-red-200">
                          Disconnected
                        </Text>
                      </>
                    ) : (
                      <Text className="text-xs text-primary-foreground/70">
                        Checking connection...
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
            <View className="flex-row gap-2 ml-4">
              {onClose && (
                <Pressable
                  onPress={onClose}
                  className="p-2 rounded-full bg-primary-foreground/20"
                >
                  <X size={20} color="white" />
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
            <View className="flex-1">
              <WavingHandAnimation />
              {apiConnected === false && (
                <View className="bg-red-50 border border-red-200 p-4 rounded-xl mx-4">
                  <Text className="text-sm text-red-700 text-center font-medium">
                    ⚠️ RestoAI backend is not connected. Please check if the
                    server is running.
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

          {isLoading && <TypingIndicator />}
        </ScrollView>

        <View className="p-4 border-t border-border">
          <View className="flex-row gap-3 items-end">
            <View className="flex-1 bg-background rounded-2xl border border-border shadow-sm">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask me about restaurants, make a reservation..."
                className="px-4 py-3 text-foreground text-sm"
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                editable={apiConnected !== false}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={isLoading || !input.trim() || apiConnected === false}
              className={`w-12 h-12 rounded-2xl items-center justify-center shadow-lg ${
                isLoading || !input.trim() || apiConnected === false
                  ? "bg-muted"
                  : "bg-primary"
              }`}
            >
              <Send
                size={20}
                color={
                  isLoading || !input.trim() || apiConnected === false
                    ? "#9ca3af"
                    : "white"
                }
              />
            </Pressable>
          </View>
          {input.length > 0 && (
            <Text className="text-xs text-muted-foreground mt-2 text-right">
              {input.length}/500 characters
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});

export default ChatTestPyScreen;
