import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import {
  Clock,
  X,
  Users,
  Calendar,
  MapPin,
  Check,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3, Muted } from "@/components/ui/typography";
import { TimeRangeSearchParams } from "./TimeRangeSelector";

export interface WaitlistEntry {
  restaurantId: string;
  userId: string;
  desiredDate: string;
  desiredTimeRange: string;
  partySize: number;
  tableTypes?: string[];
  specialRequests?: string;
}

interface WaitlistConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (entry: WaitlistEntry) => Promise<void>;
  searchParams: TimeRangeSearchParams;
  restaurantId: string;
  restaurantName: string;
  userId: string;
  selectedTableTypes: string[];
  loading?: boolean;
}

export const WaitlistConfirmationModal: React.FC<
  WaitlistConfirmationModalProps
> = ({
  visible,
  onClose,
  onConfirm,
  searchParams,
  restaurantId,
  restaurantName,
  userId,
  selectedTableTypes,
  loading = false,
}) => {
  // Editable state
  const [partySize, setPartySize] = useState(searchParams.partySize);
  const [specialRequests, setSpecialRequests] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Format time range for display and database
  const formatTimeRange = useCallback((startTime: string, endTime: string) => {
    return `[${startTime},${endTime})`;
  }, []);

  const formatDisplayTimeRange = useCallback(
    (startTime: string, endTime: string) => {
      return `${startTime} - ${endTime}`;
    },
    [],
  );

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (partySize < 1) {
      Alert.alert("Invalid Party Size", "Party size must be at least 1 person");
      return;
    }

    setSubmitting(true);
    try {
      const waitlistEntry: WaitlistEntry = {
        restaurantId,
        userId,
        desiredDate: searchParams.date.toISOString().split("T")[0], // YYYY-MM-DD format
        desiredTimeRange: formatTimeRange(
          searchParams.timeRange.startTime,
          searchParams.timeRange.endTime,
        ),
        partySize,
        tableTypes:
          selectedTableTypes.length > 0 ? selectedTableTypes : undefined,
        specialRequests: specialRequests.trim() || undefined,
      };

      await onConfirm(waitlistEntry);

      // Reset form
      setPartySize(searchParams.partySize);
      setSpecialRequests("");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error("Failed to join waitlist:", error);
      Alert.alert(
        "Waitlist Error",
        "Failed to join the waitlist. Please try again.",
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }, [
    partySize,
    specialRequests,
    restaurantId,
    userId,
    searchParams,
    selectedTableTypes,
    formatTimeRange,
    onConfirm,
    onClose,
  ]);

  const handlePartySizeChange = useCallback((text: string) => {
    const size = parseInt(text) || 1;
    if (size >= 1 && size <= 20) {
      setPartySize(size);
    }
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <View className="flex-1">
            <H3>Join Waitlist</H3>
            <Muted numberOfLines={1}>{restaurantName}</Muted>
          </View>
          <Pressable onPress={onClose} className="p-2 -mr-2">
            <X size={24} color="#666" />
          </Pressable>
        </View>

        {/* Info Banner */}
        <View className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-border">
          <View className="flex-row items-center gap-2 mb-2">
            <AlertCircle size={16} color="#3b82f6" />
            <Text className="font-medium text-blue-800 dark:text-blue-200">
              No tables available for your selected time
            </Text>
          </View>
          <Text className="text-sm text-blue-600 dark:text-blue-300">
            We&apos;ll notify you if a table becomes available during your
            preferred time range.
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4 gap-6">
            {/* Current Search Details */}
            <View className="bg-muted/30 rounded-xl p-4">
              <Text className="font-semibold text-lg mb-3">Your Request</Text>

              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <Calendar size={16} color="#666" />
                  <Text className="font-medium">
                    {formatDate(searchParams.date)}
                  </Text>
                  <Text className="text-muted-foreground">
                    ({searchParams.date.toLocaleDateString()})
                  </Text>
                </View>

                <View className="flex-row items-center gap-3">
                  <Clock size={16} color="#666" />
                  <Text className="font-medium">
                    {formatDisplayTimeRange(
                      searchParams.timeRange.startTime,
                      searchParams.timeRange.endTime,
                    )}
                  </Text>
                </View>

                <View className="flex-row items-center gap-3">
                  <MapPin size={16} color="#666" />
                  <Text className="font-medium">{restaurantName}</Text>
                </View>

                {selectedTableTypes.length > 0 && (
                  <View className="flex-row items-start gap-3">
                    <Text className="text-sm text-muted-foreground mt-1">
                      Table Types:
                    </Text>
                    <View className="flex-1 flex-row flex-wrap gap-1">
                      {selectedTableTypes.map((type, index) => (
                        <View
                          key={type}
                          className="bg-primary/10 rounded-full px-2 py-1"
                        >
                          <Text className="text-xs text-primary font-medium">
                            {type}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Editable Party Size */}
            <View>
              <Text className="font-semibold text-lg mb-3">Edit Details</Text>

              <View className="mb-4">
                <Text className="text-sm font-medium mb-2 text-muted-foreground">
                  Party Size
                </Text>
                <View className="flex-row items-center gap-3">
                  <Users size={16} color="#666" />
                  <View className="flex-1">
                    <TextInput
                      value={partySize.toString()}
                      onChangeText={handlePartySizeChange}
                      keyboardType="number-pad"
                      className="bg-card border border-border rounded-lg p-3 font-medium"
                      placeholder="Enter party size"
                      maxLength={2}
                    />
                  </View>
                  <Text className="text-muted-foreground">
                    {partySize === 1 ? "guest" : "guests"}
                  </Text>
                </View>
              </View>

              {/* Special Requests */}
              <View>
                <Text className="text-sm font-medium mb-2 text-muted-foreground">
                  Special Requests (Optional)
                </Text>
                <TextInput
                  value={specialRequests}
                  onChangeText={setSpecialRequests}
                  multiline
                  numberOfLines={3}
                  className="bg-card border border-border rounded-lg p-3"
                  placeholder="Any special requests or notes..."
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text className="text-xs text-muted-foreground mt-1">
                  {specialRequests.length}/500 characters
                </Text>
              </View>
            </View>

            {/* How it works */}
            <View className="bg-muted/30 rounded-xl p-4">
              <Text className="font-medium mb-2">How the waitlist works:</Text>
              <View className="gap-2">
                <View className="flex-row items-start gap-2">
                  <Text className="text-primary font-bold">1.</Text>
                  <Text className="text-sm text-muted-foreground flex-1">
                    We&apos;ll monitor for table availability during your
                    preferred time
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Text className="text-primary font-bold">2.</Text>
                  <Text className="text-sm text-muted-foreground flex-1">
                    You&apos;ll receive a notification if a table becomes
                    available
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Text className="text-primary font-bold">3.</Text>
                  <Text className="text-sm text-muted-foreground flex-1">
                    You&apos;ll have a limited time to confirm your booking
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="gap-3">
              <Button
                onPress={handleConfirm}
                disabled={submitting || partySize < 1}
                className="flex-row items-center justify-center gap-2"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Check size={16} color="white" />
                )}
                <Text className="text-primary-foreground font-medium">
                  {submitting ? "Joining Waitlist..." : "Join Waitlist"}
                </Text>
              </Button>

              <Button variant="outline" onPress={onClose} disabled={submitting}>
                <Text className="font-medium">Cancel</Text>
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
