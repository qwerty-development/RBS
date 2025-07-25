import React from "react";
import { View, TextInput } from "react-native";
import { Text } from "./text";

interface TextareaProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  numberOfLines?: number;
  maxLength?: number;
  className?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  description,
  error,
  numberOfLines = 4,
  maxLength,
  className = "",
}) => {
  return (
    <View className={`mb-4 ${className}`}>
      <Text className="font-medium text-base mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        className={`border-2 rounded-lg px-4 py-3 text-base ${
          error ? "border-red-500" : "border-border"
        } bg-background text-foreground`}
        placeholderTextColor="#9ca3af"
        style={{ height: numberOfLines * 24 + 24, textAlignVertical: "top" }}
      />
      {description && (
        <Text className="text-sm text-muted-foreground mt-1">
          {description}
        </Text>
      )}
      {maxLength && (
        <Text className="text-xs text-muted-foreground mt-1">
          {value.length}/{maxLength} characters
        </Text>
      )}
      {error && <Text className="text-sm text-red-500 mt-1">{error}</Text>}
    </View>
  );
};
