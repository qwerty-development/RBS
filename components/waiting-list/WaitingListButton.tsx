// components/waiting-list/WaitingListButton.tsx
import React, { useState } from "react";
import { View, Pressable, Alert, ActivityIndicator, Modal } from "react-native";
import { Clock, Users, Calendar, Plus, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/supabase-provider";
import { useWaitingListStore } from "@/stores";
import { JoinWaitlistForm } from "./JoinWaitlistForm";

interface WaitingListButtonProps {
  restaurantId: string;
  restaurantName: string;
  requestedDate: string; // YYYY-MM-DD format
  requestedTime: string; // HH:MM format
  partySize: number;
  specialRequests?: string;
  occasion?: string;
  dietaryNotes?: string[];
  className?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function WaitingListButton({
  restaurantId,
  restaurantName,
  requestedDate,
  requestedTime,
  partySize,
  specialRequests,
  occasion,
  dietaryNotes,
  className,
  onSuccess,
  onError,
}: WaitingListButtonProps) {
  const { profile } = useAuth();
  const { joinWaitingList, isLoading } = useWaitingListStore();
  const [showForm, setShowForm] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleShowForm = async () => {
    if (!profile?.id) {
      Alert.alert("Sign In Required", "Please sign in to join the waiting list");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowForm(true);
  };

  const handleFormSubmit = async (formData: {
    requestedTime: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    minPartySize: number;
    maxPartySize: number | null;
    partySize: number;
  }) => {
    if (!profile?.id) return;

    setJoining(true);
    
    try {
      const result = await joinWaitingList({
        userId: profile.id,
        restaurantId,
        requestedDate,
        requestedTime: formData.requestedTime,
        timeSlotStart: formData.timeSlotStart,
        timeSlotEnd: formData.timeSlotEnd,
        partySize: formData.partySize,
        minPartySize: formData.minPartySize,
        maxPartySize: formData.maxPartySize,
        specialRequests,
        occasion: occasion === "none" ? undefined : occasion,
        dietaryNotes: dietaryNotes?.length ? dietaryNotes : undefined,
      });

      if (result) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        
        setShowForm(false);
        
        Alert.alert(
          "Added to Waiting List!",
          "You've been added to the waiting list. We'll notify you when a matching table becomes available.",
          [{ text: "OK" }]
        );
        
        onSuccess?.();
      } else {
        throw new Error("Failed to join waiting list");
      }
    } catch (error: any) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error
      );
      
      const errorMessage = error.message || "Failed to join waiting list";
      Alert.alert("Error", errorMessage);
      onError?.(errorMessage);
    } finally {
      setJoining(false);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
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

  const isProcessing = joining || isLoading;

  return (
    <View className={cn("bg-card border border-border rounded-xl p-4", className)}>
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full items-center justify-center">
          <Clock size={20} color="#f97316" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-lg">No Tables Available</Text>
          <Text className="text-sm text-muted-foreground">
            This time slot is fully booked
          </Text>
        </View>
      </View>

      {/* Booking Details */}
      <View className="bg-muted/30 rounded-lg p-3 mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Calendar size={16} color="#6b7280" />
          <Text className="text-sm text-muted-foreground">
            {formatDateForDisplay(requestedDate)} at {requestedTime}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Users size={16} color="#6b7280" />
          <Text className="text-sm text-muted-foreground">
            Party of {partySize}
          </Text>
        </View>
      </View>

      {/* Call to Action */}
      <View className="gap-3">
        <Text className="text-sm text-center text-muted-foreground">
          Join the waiting list and we'll notify you if a table becomes available
        </Text>
        
        <Button
          onPress={handleShowForm}
          disabled={isProcessing}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <View className="flex-row items-center gap-2">
            <Plus size={16} color="#fff" />
            <Text className="text-white font-medium">Join Waiting List</Text>
          </View>
        </Button>
      </View>

      {/* Additional Info */}
      <View className="mt-3 pt-3 border-t border-border">
        <Text className="text-xs text-center text-muted-foreground">
          Free to join • Cancel anytime • Instant notifications
        </Text>
      </View>

      {/* Join Waitlist Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleFormCancel}
      >
        <View className="flex-1 bg-background p-4 pt-12">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-1">
              <Text className="text-lg font-semibold">Join Waiting List</Text>
              <Text className="text-sm text-muted-foreground">{restaurantName}</Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={handleFormCancel}
              className="w-10 h-10 rounded-full"
            >
              <X size={20} />
            </Button>
          </View>

          {/* Form */}
          <JoinWaitlistForm
            restaurantName={restaurantName}
            initialDate={requestedDate}
            initialTime={requestedTime}
            initialPartySize={partySize}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            loading={joining}
          />
        </View>
      </Modal>
    </View>
  );
}