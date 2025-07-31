// components/waiting-list/JoinWaitlistForm.tsx
import React, { useState, useMemo } from "react";
import { View, Alert } from "react-native";
import { Clock, Users, ChevronDown, Calendar, Plus, Minus } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H3 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface JoinWaitlistFormProps {
  restaurantName: string;
  initialDate: string; // YYYY-MM-DD format
  initialTime: string; // HH:MM format
  initialPartySize: number;
  onSubmit: (data: {
    requestedTime: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    minPartySize: number;
    maxPartySize: number | null;
    partySize: number;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
}

type TimeFlexibility = 'tight' | 'moderate' | 'flexible';
type PartySizeFlexibility = 'exact' | 'smaller' | 'larger' | 'both';

const TIME_FLEXIBILITY_OPTIONS = [
  { value: 'tight' as TimeFlexibility, label: 'Tight (±30 min)', windowMinutes: 30 },
  { value: 'moderate' as TimeFlexibility, label: 'Moderate (±1 hour)', windowMinutes: 60 },
  { value: 'flexible' as TimeFlexibility, label: 'Flexible (±1.5 hours)', windowMinutes: 90 },
];

const PARTY_SIZE_FLEXIBILITY_OPTIONS = [
  { value: 'exact' as PartySizeFlexibility, label: 'Exact size only' },
  { value: 'smaller' as PartySizeFlexibility, label: 'This size or smaller' },
  { value: 'larger' as PartySizeFlexibility, label: 'This size or larger' },
  { value: 'both' as PartySizeFlexibility, label: 'Any size around this' },
];

export function JoinWaitlistForm({
  restaurantName,
  initialDate,
  initialTime,
  initialPartySize,
  onSubmit,
  onCancel,
  loading = false,
}: JoinWaitlistFormProps) {
  const [timeFlexibility, setTimeFlexibility] = useState<TimeFlexibility>('moderate');
  const [partySizeFlexibility, setPartySizeFlexibility] = useState<PartySizeFlexibility>('exact');
  const [partySize, setPartySize] = useState(initialPartySize);
  const [preferredTime, setPreferredTime] = useState(initialTime);

  // Calculate time range based on flexibility
  const timeRange = useMemo(() => {
    const flexOption = TIME_FLEXIBILITY_OPTIONS.find(opt => opt.value === timeFlexibility);
    const windowMinutes = flexOption?.windowMinutes || 60;
    
    const [hours, minutes] = preferredTime.split(':').map(Number);
    const preferredDateTime = new Date();
    preferredDateTime.setHours(hours, minutes, 0, 0);
    
    const startTime = new Date(preferredDateTime.getTime() - (windowMinutes * 60 * 1000));
    const endTime = new Date(preferredDateTime.getTime() + (windowMinutes * 60 * 1000));
    
    // Ensure times are within reasonable restaurant hours (11:00 - 23:00)
    const minHour = 11;
    const maxHour = 23;
    
    if (startTime.getHours() < minHour) {
      startTime.setHours(minHour, 0, 0, 0);
    }
    if (endTime.getHours() >= maxHour) {
      endTime.setHours(maxHour, 0, 0, 0);
    }
    
    const formatTime = (date: Date) => 
      `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    return {
      start: formatTime(startTime),
      end: formatTime(endTime),
    };
  }, [preferredTime, timeFlexibility]);

  // Calculate party size range based on flexibility
  const partySizeRange = useMemo(() => {
    switch (partySizeFlexibility) {
      case 'exact':
        return { min: partySize, max: null };
      case 'smaller':
        return { min: Math.max(1, partySize - 2), max: partySize };
      case 'larger':
        return { min: partySize, max: partySize + 4 };
      case 'both':
        return { min: Math.max(1, partySize - 2), max: partySize + 2 };
      default:
        return { min: partySize, max: null };
    }
  }, [partySize, partySizeFlexibility]);

  const handleTimeFlexibilityChange = async (value: TimeFlexibility) => {
    setTimeFlexibility(value);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePartySizeFlexibilityChange = async (value: PartySizeFlexibility) => {
    setPartySizeFlexibility(value);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePartySizeChange = async (delta: number) => {
    const newSize = Math.max(1, Math.min(20, partySize + delta));
    if (newSize !== partySize) {
      setPartySize(newSize);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    onSubmit({
      requestedTime: preferredTime,
      timeSlotStart: timeRange.start,
      timeSlotEnd: timeRange.end,
      minPartySize: partySizeRange.min,
      maxPartySize: partySizeRange.max,
      partySize: partySize,
    });
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

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      {/* Header */}
      <View className="mb-6">
        <H3 className="text-xl mb-2">Join Waiting List</H3>
        <Text className="text-muted-foreground">
          Tell us your preferences and we'll notify you when a matching table becomes available at {restaurantName}.
        </Text>
      </View>

      {/* Date & Preferred Time */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Calendar size={20} color="#6b7280" />
          <Text className="font-semibold">Date & Preferred Time</Text>
        </View>
        <View className="bg-muted/30 rounded-lg p-3">
          <Text className="text-sm text-muted-foreground mb-1">
            {formatDateForDisplay(initialDate)} at {preferredTime}
          </Text>
          <Text className="text-xs text-muted-foreground">
            Actual notification time range: {timeRange.start} - {timeRange.end}
          </Text>
        </View>
      </View>

      {/* Time Flexibility */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Clock size={20} color="#6b7280" />
          <Text className="font-semibold">Time Flexibility</Text>
        </View>
        <Text className="text-sm text-muted-foreground mb-3">
          How flexible are you with the time?
        </Text>
        <View className="gap-2">
          {TIME_FLEXIBILITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={timeFlexibility === option.value ? "default" : "outline"}
              onPress={() => handleTimeFlexibilityChange(option.value)}
              className="justify-start"
            >
              <Text className={cn(
                "text-sm",
                timeFlexibility === option.value ? "text-white" : "text-foreground"
              )}>
                {option.label}
              </Text>
              {timeFlexibility === option.value && (
                <View className="ml-auto">
                  <ChevronDown size={16} color="#fff" />
                </View>
              )}
            </Button>
          ))}
        </View>
      </View>

      {/* Party Size */}
      <View className="mb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Users size={20} color="#6b7280" />
          <Text className="font-semibold">Party Size</Text>
        </View>
        
        {/* Party Size Counter */}
        <View className="flex-row items-center justify-center bg-muted/30 rounded-lg p-4 mb-3">
          <Button
            variant="outline"
            size="sm"
            onPress={() => handlePartySizeChange(-1)}
            disabled={partySize <= 1}
            className="w-10 h-10 rounded-full"
          >
            <Minus size={16} />
          </Button>
          <View className="mx-6 items-center">
            <Text className="text-2xl font-bold">{partySize}</Text>
            <Text className="text-xs text-muted-foreground">
              {partySize === 1 ? 'person' : 'people'}
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={() => handlePartySizeChange(1)}
            disabled={partySize >= 20}
            className="w-10 h-10 rounded-full"
          >
            <Plus size={16} />
          </Button>
        </View>

        {/* Party Size Flexibility */}
        <Text className="text-sm text-muted-foreground mb-3">
          How flexible are you with party size?
        </Text>
        <View className="gap-2">
          {PARTY_SIZE_FLEXIBILITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={partySizeFlexibility === option.value ? "default" : "outline"}
              onPress={() => handlePartySizeFlexibilityChange(option.value)}
              className="justify-start"
            >
              <Text className={cn(
                "text-sm",
                partySizeFlexibility === option.value ? "text-white" : "text-foreground"
              )}>
                {option.label}
              </Text>
              {partySizeFlexibility === option.value && (
                <View className="ml-auto">
                  <ChevronDown size={16} color="#fff" />
                </View>
              )}
            </Button>
          ))}
        </View>

        {/* Party Size Range Display */}
        <View className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text className="text-sm text-blue-800 dark:text-blue-200">
            {partySizeRange.max 
              ? `Will notify for tables that seat ${partySizeRange.min}-${partySizeRange.max} people`
              : `Will notify for tables that seat exactly ${partySizeRange.min} ${partySizeRange.min === 1 ? 'person' : 'people'}`
            }
          </Text>
        </View>
      </View>

      {/* Summary */}
      <View className="mb-6 p-4 bg-muted/20 rounded-lg">
        <Text className="font-semibold mb-2">Summary</Text>
        <Text className="text-sm text-muted-foreground mb-1">
          • You'll be notified for tables available between {timeRange.start} - {timeRange.end}
        </Text>
        <Text className="text-sm text-muted-foreground mb-1">
          • Party size range: {partySizeRange.min}{partySizeRange.max ? `-${partySizeRange.max}` : ''} people
        </Text>
        <Text className="text-sm text-muted-foreground">
          • Notifications are instant when a matching table becomes available
        </Text>
      </View>

      {/* Actions */}
      <View className="flex-row gap-3">
        <Button
          variant="outline"
          onPress={onCancel}
          disabled={loading}
          className="flex-1"
        >
          <Text>Cancel</Text>
        </Button>
        <Button
          onPress={handleSubmit}
          disabled={loading}
          className="flex-1"
        >
          <Text className="text-white font-medium">
            {loading ? "Joining..." : "Join Waiting List"}
          </Text>
        </Button>
      </View>
    </View>
  );
}