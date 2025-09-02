import React, { useState } from "react";
import { View, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { X, Flag, AlertCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  useContentModeration,
  ContentType,
  FlagReason,
} from "@/hooks/useContentModeration";

interface ContentFlagModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
  contentAuthor?: string;
  contentPreview?: string;
}

interface FlagOption {
  reason: FlagReason;
  title: string;
  description: string;
  icon: string;
}

const FLAG_OPTIONS: FlagOption[] = [
  {
    reason: "harassment",
    title: "Harassment or Bullying",
    description: "Content that targets, intimidates, or abuses other users",
    icon: "🚫",
  },
  {
    reason: "hate_speech",
    title: "Hate Speech",
    description:
      "Content that attacks people based on race, religion, gender, etc.",
    icon: "⚠️",
  },
  {
    reason: "violence_threats",
    title: "Violence or Threats",
    description: "Content that threatens or promotes violence against people",
    icon: "🔴",
  },
  {
    reason: "sexual_content",
    title: "Sexual or Explicit Content",
    description: "Inappropriate sexual content or advances",
    icon: "🔞",
  },
  {
    reason: "inappropriate_language",
    title: "Inappropriate Language",
    description: "Offensive language or profanity",
    icon: "🗣️",
  },
  {
    reason: "spam",
    title: "Spam",
    description: "Repetitive, irrelevant, or promotional content",
    icon: "📧",
  },
  {
    reason: "fake_review",
    title: "Fake or Misleading",
    description:
      "Content that is false, misleading, or not based on genuine experience",
    icon: "❌",
  },
  {
    reason: "discrimination",
    title: "Discrimination",
    description: "Content that discriminates against protected groups",
    icon: "⚖️",
  },
  {
    reason: "other",
    title: "Other",
    description: "Other policy violations not listed above",
    icon: "🔍",
  },
];

export const ContentFlagModal: React.FC<ContentFlagModalProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  contentAuthor,
  contentPreview,
}) => {
  const { colorScheme } = useColorScheme();
  const { flagContent, loading, showFlagSuccessAlert } = useContentModeration();

  const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for flagging this content.");
      return;
    }

    const result = await flagContent(
      contentType,
      contentId,
      selectedReason,
      description || undefined,
    );

    if (result.success) {
      showFlagSuccessAlert();
      onClose();
      setSelectedReason(null);
      setDescription("");
    } else {
      Alert.alert("Error", result.error || "Failed to flag content");
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl max-h-[90%] min-h-[60%]">
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-border">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                <Flag size={20} color="#dc2626" />
              </View>
              <View>
                <H3>Report Content</H3>
                <Text className="text-sm text-muted-foreground">
                  Help keep our community safe
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
              <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Content Preview */}
            {(contentAuthor || contentPreview) && (
              <View className="mx-6 mt-4 p-4 bg-muted/30 rounded-xl">
                <Text className="text-sm text-muted-foreground mb-1">
                  Reporting {contentType}{" "}
                  {contentAuthor && `by ${contentAuthor}`}
                </Text>
                {contentPreview && (
                  <Text className="text-sm" numberOfLines={3}>
                    {contentPreview}
                  </Text>
                )}
              </View>
            )}

            {/* Warning */}
            <View className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <View className="flex-row items-start gap-3">
                <AlertCircle size={20} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                    Important Notice
                  </Text>
                  <Text className="text-sm text-amber-700 dark:text-amber-300">
                    False reports may result in account restrictions. Only flag
                    content that genuinely violates our community guidelines.
                  </Text>
                </View>
              </View>
            </View>

            {/* Flag Reasons */}
            <View className="p-6">
              <Text className="font-semibold mb-4">
                Why are you reporting this content?
              </Text>

              <View className="gap-3">
                {FLAG_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.reason}
                    onPress={() => setSelectedReason(option.reason)}
                    className={`p-4 border-2 rounded-xl ${
                      selectedReason === option.reason
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <View className="flex-row items-start gap-3">
                      <Text className="text-xl">{option.icon}</Text>
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            selectedReason === option.reason
                              ? "text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {option.title}
                        </Text>
                        <Text className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </Text>
                      </View>
                      <View
                        className={`w-5 h-5 rounded-full border-2 ${
                          selectedReason === option.reason
                            ? "border-primary bg-primary"
                            : "border-muted-foreground"
                        } items-center justify-center`}
                      >
                        {selectedReason === option.reason && (
                          <View className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Additional Description */}
              <View className="mt-6">
                <Textarea
                  label="Additional details (optional)"
                  placeholder="Provide any additional context that might help our moderation team..."
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                  numberOfLines={4}
                />
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View className="p-6 border-t border-border">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={handleClose}
                className="flex-1"
                disabled={loading}
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                onPress={handleSubmit}
                className="flex-1"
                disabled={loading || !selectedReason}
              >
                <Text>{loading ? "Reporting..." : "Submit Report"}</Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ContentFlagModal;
