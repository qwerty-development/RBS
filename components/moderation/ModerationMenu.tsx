import React, { useState } from "react";
import { View, Modal, TouchableOpacity, Alert } from "react-native";
import { Flag, Shield, X, MoreVertical } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/lib/useColorScheme";
import { ContentFlagModal } from "./ContentFlagModal";
import { UserBlockModal } from "./UserBlockModal";
import { ContentType } from "@/hooks/useContentModeration";

interface ModerationMenuProps {
  // Content information
  contentType: ContentType;
  contentId: string;
  contentAuthor?: string;
  contentPreview?: string;

  // User information (for blocking)
  userId: string;
  userName: string;
  userAvatar?: string;

  // Visibility control
  visible: boolean;
  onClose: () => void;

  // Optional callbacks
  onFlagSuccess?: () => void;
  onBlockSuccess?: () => void;

  // Additional menu items
  showEdit?: boolean;
  showDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;

  // Control what options to show
  showFlag?: boolean;
  showBlock?: boolean;
}

export const ModerationMenu: React.FC<ModerationMenuProps> = ({
  contentType,
  contentId,
  contentAuthor,
  contentPreview,
  userId,
  userName,
  userAvatar,
  visible,
  onClose,
  onFlagSuccess,
  onBlockSuccess,
  showEdit = false,
  showDelete = false,
  onEdit,
  onDelete,
  showFlag = true,
  showBlock = true,
}) => {
  const { colorScheme } = useColorScheme();
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const handleFlagPress = () => {
    onClose();
    setShowFlagModal(true);
  };

  const handleBlockPress = () => {
    onClose();
    setShowBlockModal(true);
  };

  const handleEdit = () => {
    onClose();
    onEdit?.();
  };

  const handleDelete = () => {
    onClose();
    Alert.alert(
      "Delete Content",
      "Are you sure you want to delete this content? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: onDelete,
        },
      ],
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            className="bg-background rounded-2xl w-64 shadow-lg"
            activeOpacity={1}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="font-semibold">Options</Text>
              <TouchableOpacity onPress={onClose} className="p-1">
                <X size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

            {/* Menu Items */}
            <View className="p-2">
              {/* Edit Option */}
              {showEdit && (
                <TouchableOpacity
                  onPress={handleEdit}
                  className="flex-row items-center gap-3 p-3 rounded-lg active:bg-muted/50"
                >
                  <View className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center">
                    <Text className="text-blue-600">✏️</Text>
                  </View>
                  <Text className="flex-1">Edit</Text>
                </TouchableOpacity>
              )}

              {/* Delete Option */}
              {showDelete && (
                <TouchableOpacity
                  onPress={handleDelete}
                  className="flex-row items-center gap-3 p-3 rounded-lg active:bg-muted/50"
                >
                  <View className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                    <Text className="text-red-600">🗑️</Text>
                  </View>
                  <Text className="flex-1 text-red-600">Delete</Text>
                </TouchableOpacity>
              )}

              {/* Separator if both edit/delete and moderation options are shown */}
              {(showEdit || showDelete) && (showFlag || showBlock) && (
                <View className="h-px bg-border my-2" />
              )}

              {/* Flag Content Option */}
              {showFlag && (
                <TouchableOpacity
                  onPress={handleFlagPress}
                  className="flex-row items-center gap-3 p-3 rounded-lg active:bg-muted/50"
                >
                  <View className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full items-center justify-center">
                    <Flag size={16} color="#f59e0b" />
                  </View>
                  <Text className="flex-1">Report Content</Text>
                </TouchableOpacity>
              )}

              {/* Block User Option */}
              {showBlock && (
                <TouchableOpacity
                  onPress={handleBlockPress}
                  className="flex-row items-center gap-3 p-3 rounded-lg active:bg-muted/50"
                >
                  <View className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                    <Shield size={16} color="#dc2626" />
                  </View>
                  <Text className="flex-1 text-red-600">Block User</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Flag Modal */}
      <ContentFlagModal
        visible={showFlagModal}
        onClose={() => setShowFlagModal(false)}
        contentType={contentType}
        contentId={contentId}
        contentAuthor={contentAuthor}
        contentPreview={contentPreview}
      />

      {/* Block Modal */}
      <UserBlockModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        userId={userId}
        userName={userName}
        userAvatar={userAvatar}
        onBlockSuccess={onBlockSuccess}
      />
    </>
  );
};

// Convenience component for just the trigger button
interface ModerationMenuButtonProps
  extends Omit<ModerationMenuProps, "visible" | "onClose"> {
  size?: number;
  color?: string;
}

export const ModerationMenuButton: React.FC<ModerationMenuButtonProps> = ({
  size = 20,
  color,
  ...props
}) => {
  const { colorScheme } = useColorScheme();
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} className="p-1">
        <MoreVertical
          size={size}
          color={color || (colorScheme === "dark" ? "#666" : "#999")}
        />
      </TouchableOpacity>

      <ModerationMenu
        {...props}
        visible={visible}
        onClose={() => setVisible(false)}
      />
    </>
  );
};

export default ModerationMenu;
