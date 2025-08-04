// components/waiting-list/WaitingListModal.tsx
import React, { useState } from "react";
import { View, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { X, Clock, Calendar, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/supabase-provider";
import { JoinWaitlistForm } from "./JoinWaitlistForm";

interface WaitingListModalProps {
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  selectedTime: string; // HH:MM format
  requestedDate: string; // YYYY-MM-DD format
  partySize: number;
  onSuccess?: () => void;
}

export function WaitingListModal({
  visible,
  onClose,
  restaurantId,
  restaurantName,
  selectedTime,
  requestedDate,
  partySize,
  onSuccess,
}: WaitingListModalProps) {
  const { profile } = useAuth();
  const [isJoining, setIsJoining] = useState(false);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleFormSubmit = async (formData: {
    requestedTime: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    minPartySize: number;
    maxPartySize: number | null;
    partySize: number;
  }) => {
    // This will be handled by the form itself
    // Just close the modal on success
    onSuccess?.();
    handleClose();
  };

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "tomorrow";
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatTimeForDisplay = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 bg-background">
          {/* Header */}
          <View className="flex-row justify-between items-center p-4 pt-12 border-b border-border">
            <View className="flex-1">
              <Text className="text-xl font-semibold">Time Slot Full</Text>
              <Text className="text-sm text-muted-foreground">{restaurantName}</Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={handleClose}
              className="w-10 h-10 rounded-full"
            >
              <X size={20} />
            </Button>
          </View>

          {/* Scrollable Content */}
          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          >
            {/* Time Slot Info */}
            <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center">
                  <Clock size={20} color="#dc2626" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-red-900 dark:text-red-100">
                    This Time Slot is Fully Booked
                  </Text>
                  <Text className="text-sm text-red-700 dark:text-red-300">
                    No tables available for the selected time
                  </Text>
                </View>
              </View>

              {/* Selected Details */}
              <View className="bg-white/50 dark:bg-black/20 rounded-lg p-3 space-y-2">
                <View className="flex-row items-center gap-2">
                  <Calendar size={16} color="#dc2626" />
                  <Text className="text-sm font-medium text-red-800 dark:text-red-200">
                    {formatDateForDisplay(requestedDate)} at {formatTimeForDisplay(selectedTime)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Users size={16} color="#dc2626" />
                  <Text className="text-sm font-medium text-red-800 dark:text-red-200">
                    Party of {partySize}
                  </Text>
                </View>
              </View>
            </View>

            {/* Waiting List Info */}
            <View className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <Text className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Join the Waiting List
              </Text>
              <Text className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                We'll notify you immediately if a table becomes available for your preferred time range.
              </Text>
              
              <View className="space-y-2">
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 bg-blue-600 rounded-full" />
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    Free to join, cancel anytime
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 bg-blue-600 rounded-full" />
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    Instant push notifications when tables become available
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 bg-blue-600 rounded-full" />
                  <Text className="text-xs text-blue-700 dark:text-blue-300">
                    Choose your flexibility for time and party size
                  </Text>
                </View>
              </View>
            </View>

            {/* Waiting List Form - Remove the ScrollView wrapper */}
            <JoinWaitlistForm
              restaurantName={restaurantName}
              initialDate={requestedDate}
              initialTime={selectedTime}
              initialPartySize={partySize}
              onSubmit={handleFormSubmit}
              onCancel={handleClose}
              loading={isJoining}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}