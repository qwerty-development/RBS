import React, { useState, useEffect } from "react";
import { View, Pressable, Alert } from "react-native";
import {
  Gift,
  Utensils,
  MessageSquare,
  Edit3,
  Check,
  X,
  Info,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { supabase } from "@/config/supabase";

interface EditableBookingFieldsProps {
  bookingId: string;
  currentValues: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  };
  onUpdate: (updatedFields: {
    occasion?: string | null;
    special_requests?: string | null;
    dietary_notes?: string[] | null;
  }) => void;
  canEdit: boolean;
}

export const EditableBookingFields: React.FC<EditableBookingFieldsProps> = ({
  bookingId,
  currentValues,
  onUpdate,
  canEdit,
}) => {
  const { colorScheme } = useColorScheme();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editValues, setEditValues] = useState(currentValues);

  useEffect(() => {
    setEditValues(currentValues);
  }, [currentValues]);

  const handleSave = async () => {
    if (!canEdit) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          occasion: editValues.occasion || null,
          special_requests: editValues.special_requests || null,
          dietary_notes: editValues.dietary_notes || null,
        })
        .eq("id", bookingId);

      if (error) throw error;

      onUpdate(editValues);
      setIsEditing(false);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert("Success", "Booking details updated successfully");
    } catch (error) {
      console.error("Error updating booking fields:", error);
      Alert.alert(
        "Error",
        "Failed to update booking details. Please try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditValues(currentValues);
    setIsEditing(false);
  };

  const handleDietaryNotesChange = (value: string) => {
    const notes = value
      .split(",")
      .map((note) => note.trim())
      .filter((note) => note.length > 0);
    setEditValues({
      ...editValues,
      dietary_notes: notes.length > 0 ? notes : null,
    });
  };

  const hasAnyData =
    currentValues.occasion ||
    currentValues.special_requests ||
    (currentValues.dietary_notes && currentValues.dietary_notes.length > 0);

  if (!hasAnyData && !canEdit) {
    return null; // Don't show anything if no data and can't edit
  }

  return (
    <View className="mt-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Info size={16} color={colors[colorScheme].primary} />
          <Text className="text-base font-medium">Additional Information</Text>
        </View>

        {canEdit && !isEditing && (
          <Pressable
            onPress={() => setIsEditing(true)}
            className="flex-row items-center gap-1 px-2 py-1 rounded-md bg-primary/10"
          >
            <Edit3 size={14} color={colors[colorScheme].primary} />
            <Text className="text-xs text-primary">Edit</Text>
          </Pressable>
        )}
      </View>

      {isEditing ? (
        <View className="space-y-4 bg-background rounded-lg p-4 border border-border">
          {/* Occasion */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Occasion (optional)
            </Text>
            <Input
              value={editValues.occasion || ""}
              onChangeText={(text) =>
                setEditValues({ ...editValues, occasion: text })
              }
              placeholder="e.g., Birthday, Anniversary, Business meeting"
              className="mb-0"
            />
          </View>

          {/* Dietary Notes */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Dietary Notes (optional)
            </Text>
            <Input
              value={editValues.dietary_notes?.join(", ") || ""}
              onChangeText={handleDietaryNotesChange}
              placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
              className="mb-0"
            />
            <Text className="text-xs text-muted-foreground mt-1">
              Separate multiple dietary requirements with commas
            </Text>
          </View>

          {/* Special Requests */}
          <View>
            <Text className="text-sm font-medium mb-2 text-muted-foreground">
              Special Requests (optional)
            </Text>
            <Input
              value={editValues.special_requests || ""}
              onChangeText={(text) =>
                setEditValues({ ...editValues, special_requests: text })
              }
              placeholder="Any special requests for your visit"
              multiline
              numberOfLines={3}
              className="mb-0"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onPress={handleCancel}
              disabled={isUpdating}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <X size={16} color={colors[colorScheme].mutedForeground} />
                <Text>Cancel</Text>
              </View>
            </Button>

            <Button
              onPress={handleSave}
              disabled={isUpdating}
              className="flex-1"
            >
              <View className="flex-row items-center gap-2">
                <Check size={16} color="white" />
                <Text>{isUpdating ? "Saving..." : "Save"}</Text>
              </View>
            </Button>
          </View>
        </View>
      ) : (
        <View className="space-y-0">
          {/* Occasion */}
          {currentValues.occasion && (
            <View className="pb-3">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="bg-primary/10 rounded-full p-1.5">
                  <Gift size={14} color={colors[colorScheme].primary} />
                </View>
                <Text className="font-medium text-sm text-primary dark:text-white">
                  Occasion
                </Text>
              </View>
              <Text className="text-foreground text-sm capitalize ml-8 mb-3">
                {currentValues.occasion}
              </Text>
              <View className="h-0.5 bg-primary/20" />
            </View>
          )}

          {/* Dietary Notes */}
          {currentValues.dietary_notes &&
            currentValues.dietary_notes.length > 0 && (
              <View className="pt-3 pb-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <View className="bg-primary/10 rounded-full p-1.5">
                    <Utensils size={14} color={colors[colorScheme].primary} />
                  </View>
                  <Text className="font-medium text-sm text-primary dark:text-white">
                    Dietary Notes
                  </Text>
                </View>
                <Text className="text-foreground text-sm ml-8 mb-3">
                  {currentValues.dietary_notes.join(", ")}
                </Text>
                <View className="h-0.5 bg-primary/20" />
              </View>
            )}

          {/* Special Requests */}
          {currentValues.special_requests && (
            <View className="pt-3 pb-3">
              <View className="flex-row items-center gap-2 mb-1">
                <View className="bg-primary/10 rounded-full p-1.5">
                  <MessageSquare size={14} color={colors[colorScheme].primary} />
                </View>
                <Text className="font-medium text-sm text-primary dark:text-white">
                  Special Requests
                </Text>
              </View>
              <Text className="text-foreground text-sm ml-8 mb-3">
                {currentValues.special_requests.trim()}
              </Text>
              <View className="h-0.5 bg-primary/20" />
            </View>
          )}

          {/* Show placeholder when no data and can edit */}
          {!hasAnyData && canEdit && (
            <View className="py-4 px-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
              <Text className="text-center text-muted-foreground text-sm">
                No additional information added yet
              </Text>
              <Text className="text-center text-muted-foreground text-xs mt-1">
                Tap "Edit" to add occasion, dietary notes, or special requests
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
