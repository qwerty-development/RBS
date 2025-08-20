// components/playlists/CreatePlaylistModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { Playlist } from "@/hooks/usePlaylists";

interface CreatePlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    emoji: string;
  }) => Promise<void>;
  editingPlaylist?: Playlist | null;
  loading?: boolean;
  /** NEW: render content without wrapping in a RN <Modal> */
  inline?: boolean;
}

const EMOJI_OPTIONS = [
  "📍",
  "🍽️",
  "❤️",
  "⭐",
  "🎉",
  "🌟",
  "🔥",
  "💎",
  "🍕",
  "🍔",
  "🍣",
  "🥘",
  "🍰",
  "☕",
  "🍷",
  "🥂",
  "🌮",
  "🥗",
  "🍜",
  "🍱",
  "🌍",
  "🏆",
  "💫",
  "✨",
];

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  visible,
  onClose,
  onSubmit,
  editingPlaylist,
  loading = false,
  inline = false,
}) => {
  const { colorScheme } = useColorScheme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("📍");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingPlaylist) {
      setName(editingPlaylist.name);
      setDescription(editingPlaylist.description || "");
      setSelectedEmoji(editingPlaylist.emoji);
    } else {
      // Reset form when creating new
      setName("");
      setDescription("");
      setSelectedEmoji("📍");
    }
    setErrors({});
  }, [editingPlaylist, visible]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Playlist name is required";
    else if (name.trim().length < 2)
      newErrors.name = "Name must be at least 2 characters";
    else if (name.trim().length > 50)
      newErrors.name = "Name must be less than 50 characters";
    if (description.trim().length > 200)
      newErrors.description = "Description must be less than 200 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      emoji: selectedEmoji,
    });
  };

  const Content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        {/* Header (when inline, AddToPlaylistModal draws its own header; but we keep it for standalone use) */}
        {!inline && (
          <View className="bg-white dark:bg-gray-800 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <View className="flex-row items-center justify-between">
              <H3>{editingPlaylist ? "Edit Playlist" : "Create Playlist"}</H3>
              <Pressable onPress={onClose} className="p-2" disabled={loading}>
                <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
              </Pressable>
            </View>
          </View>
        )}

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {/* Emoji Selection */}
            <View className="mb-6">
              <Text className="text-base font-medium mb-2">Choose an Icon</Text>
              <View className="flex-row flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => setSelectedEmoji(emoji)}
                    className={`w-12 h-12 rounded-xl items-center justify-center ${
                      selectedEmoji === emoji
                        ? "bg-primary"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    }`}
                    disabled={loading}
                  >
                    <Text className="text-xl">{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Name Input */}
            <View className="mb-4">
              <Text className="text-base font-medium mb-2">
                Playlist Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="e.g., Date Night Spots"
                placeholderTextColor="#6b7280"
                className={`bg-white dark:bg-gray-800 px-4 py-3 rounded-xl text-base ${
                  errors.name
                    ? "border-2 border-red-500"
                    : "border border-gray-200 dark:border-gray-700"
                }`}
                maxLength={50}
                editable={!loading}
              />
              {errors.name && (
                <Text className="text-red-500 text-sm mt-1">{errors.name}</Text>
              )}
            </View>

            {/* Description Input */}
            <View className="mb-6">
              <Text className="text-base font-medium">Description </Text>
              <Muted className="text-sm font-normal">(optional)</Muted>
              <TextInput
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  if (errors.description)
                    setErrors((prev) => ({ ...prev, description: "" }));
                }}
                placeholder="What's this playlist about?"
                placeholderTextColor="#6b7280"
                className={`bg-white dark:bg-gray-800 px-4 py-3 rounded-xl text-base ${
                  errors.description
                    ? "border-2 border-red-500"
                    : "border border-gray-200 dark:border-gray-700"
                }`}
                multiline
                numberOfLines={3}
                maxLength={200}
                textAlignVertical="top"
                editable={!loading}
              />
              {errors.description && (
                <Text className="text-red-500 text-sm mt-1">
                  {errors.description}
                </Text>
              )}
              <Muted className="text-xs mt-1 text-right">
                {description.length}/200
              </Muted>
            </View>

            {/* Preview */}
            <View className="mb-6">
              <Text className="text-base font-medium mb-2">Preview</Text>
              <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">{selectedEmoji}</Text>
                  <View className="flex-1">
                    <Text className="font-semibold text-lg">
                      {name || "Your Playlist Name"}
                    </Text>
                    {description && (
                      <Muted className="text-sm mt-1">{description}</Muted>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="bg-white dark:bg-gray-800 px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={onClose}
              className="flex-1"
              disabled={loading}
            >
              <Text>Cancel</Text>
            </Button>
            <Button
              onPress={handleSubmit}
              className="flex-1"
              disabled={loading || !name.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white">
                  {editingPlaylist ? "Save Changes" : "Create Playlist"}
                </Text>
              )}
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  if (inline) {
    // Render content directly (used inside AddToPlaylistModal)
    return Content;
  }

  // Standalone modal usage (original behavior)
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {Content}
    </Modal>
  );
};
