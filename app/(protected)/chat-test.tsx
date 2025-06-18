import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, ScrollView, TextInput } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { H3 } from '@/components/ui/typography';
import { Send } from 'lucide-react-native';
import { ourAgent, ChatMessage } from '@/ai/AI_Agent';

export default function ChatTestScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
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
      console.log('Sending message:', input);

      // Add user message to chat
      const userMessage: ChatMessage = { role: 'user', content: input };
      setMessages(prev => [...prev, userMessage]);
      setInput('');

      // Call the AI agent
      console.log('Calling AI agent...');
      const response = await ourAgent([...messages, userMessage]);
      console.log('AI response:', response);

      // Add AI response to chat
      setMessages(prev => [...prev, response]);

    } catch (error) {
      console.error('Error in chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages]);

  return (
    <View className="flex-1 bg-background">
      <View className="p-4 border-b border-border">
        <H3>AI Chat Test</H3>
        <Text className="text-muted-foreground">
          Test the AI chatbot and check console logs
        </Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 p-4"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message, index) => (
          <View
            key={index}
            className={`mb-4 p-3 rounded-lg ${
              message.role === 'user'
                ? 'bg-primary ml-12'
                : 'bg-muted mr-12'
            }`}
          >
            <Text
              className={
                message.role === 'user'
                  ? 'text-primary-foreground'
                  : 'text-foreground'
              }
            >
              {message.content}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="p-4 border-t border-border">
        <View className="flex-row gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            className="flex-1 border border-border rounded-lg px-3 py-2"
            multiline
          />
          <Button
            onPress={handleSend}
            disabled={isLoading || !input.trim()}
          >
            <Send size={20} color="white" />
          </Button>
        </View>
      </View>
    </View>
  );
} 