import React, { useState } from "react";
import { View, Modal, TouchableOpacity, Alert } from "react-native";
import { X, Shield, AlertTriangle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useContentModeration } from "@/hooks/useContentModeration";

interface UserBlockModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userAvatar?: string;
  onBlockSuccess?: () => void;
}

export const UserBlockModal: React.FC<UserBlockModalProps> = ({
  visible,
  onClose,
  userId,
  userName,
  userAvatar,
  onBlockSuccess,
}) => {
  const { colorScheme } = useColorScheme();
  const { blockUser, loading, showBlockSuccessAlert } = useContentModeration();

  const [reason, setReason] = useState("");

  const handleBlock = async () => {
    const result = await blockUser(userId, reason || undefined);

    if (result.success) {
      showBlockSuccessAlert(userName);
      onBlockSuccess?.();
      onClose();
      setReason("");
    } else {
      Alert.alert("Error", result.error || "Failed to block user");
    }
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center p-4">
        <View className="bg-background rounded-3xl w-full max-w-sm">
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-border">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                <Shield size={20} color="#dc2626" />
              </View>
              <H3>Block User</H3>
            </View>
            <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
              <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
            </TouchableOpacity>
          </View>

          <View className="p-6">
            {/* User Info */}
            <View className="flex-row items-center gap-3 mb-6">
              <Image
                source={
                  userAvatar
                    ? { uri: userAvatar }
                    : require("@/assets/default-avatar.jpeg")
                }
                className="w-12 h-12 rounded-full"
              />
              <View className="flex-1">
                <Text className="font-semibold">{userName}</Text>
                <Text className="text-sm text-muted-foreground">
                  You are about to block this user
                </Text>
              </View>
            </View>

            {/* Warning */}
            <View className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-6">
              <View className="flex-row items-start gap-3">
                <AlertTriangle size={20} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                    What happens when you block a user:
                  </Text>
                  <Text className="text-sm text-amber-700 dark:text-amber-300">
                    • They won't be able to see your posts or profile{"\n"}•
                    They can't comment on your content{"\n"}• You won't see
                    their content in feeds{"\n"}• They won't be able to message
                    you{"\n"}• This action is permanent and immediate
                  </Text>
                </View>
              </View>
            </View>

            {/* Reason (Optional) */}
            <Textarea
              label="Reason for blocking (optional)"
              placeholder="Why are you blocking this user? This helps us improve our community safety..."
              value={reason}
              onChangeText={setReason}
              maxLength={300}
              numberOfLines={3}
              className="mb-6"
            />

            {/* Actions */}
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
                onPress={handleBlock}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                <Text className="text-white">
                  {loading ? "Blocking..." : "Block User"}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UserBlockModal;
