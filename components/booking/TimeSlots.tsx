// components/booking/TimeSlots.tsx (Optimized Components)
import React, { memo, useMemo, useState, useCallback } from "react";
import { View, Pressable, ActivityIndicator, Dimensions } from "react-native";
import {
  Clock,
  Wifi,
  CheckCircle,
  Sparkles,
  Users,
  Crown,
  Car,
  TreePine,
  Utensils,
  Eye,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import {
  TimeSlotBasic,
  SlotTableOptions,
  TableOption,
} from "@/lib/AvailabilityService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Optimized skeleton components
const TimeSlotSkeleton = memo(() => (
  <View className="px-4 py-3 rounded-lg bg-muted/50 min-w-[80px] items-center animate-pulse">
    <View className="w-12 h-4 bg-muted rounded mb-1" />
    <View className="w-8 h-3 bg-muted rounded" />
  </View>
));

const TimeSlotSkeletonGrid = memo(() => (
  <View className="flex-row flex-wrap gap-3">
    {Array.from({ length: 8 }, (_, i) => (
      <TimeSlotSkeleton key={i} />
    ))}
  </View>
));

// Optimized individual time slot
const TimeSlotItem = memo<{
  slot: TimeSlotBasic;
  isSelected: boolean;
  onPress: (time: string) => void;
}>(({ slot, isSelected, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(slot.time);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [slot.time, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className={`px-4 py-3 rounded-lg min-w-[80px] items-center border-2 ${
        isSelected ? "bg-primary border-primary" : "bg-muted border-border"
      }`}
    >
      <Text
        className={`font-semibold ${
          isSelected ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {slot.time}
      </Text>
    </Pressable>
  );
});

// Main TimeSlots component with optimizations
export const TimeSlots = memo<{
  slots: TimeSlotBasic[];
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  loading: boolean;
  showLiveIndicator?: boolean;
  error?: string | null;
}>(
  ({
    slots,
    selectedTime,
    onTimeSelect,
    loading,
    showLiveIndicator = false,
    error,
  }) => {
    // Memoize slots processing
    const processedSlots = useMemo(() => {
      if (!slots || slots.length === 0) return [];

      // Sort slots by time for better UX
      return [...slots].sort((a, b) => a.time.localeCompare(b.time));
    }, [slots]);

    if (error) {
      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#ef4444" />
            <Text className="font-semibold text-lg">Available Times</Text>
          </View>
          <View className="items-center py-8">
            <Text className="text-red-600 dark:text-red-400 text-center">
              {error}
            </Text>
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Available Times</Text>
            {showLiveIndicator && (
              <View className="bg-blue-100 dark:bg-blue-900/20 rounded-full px-2 py-1 ml-auto">
                <View className="flex-row items-center gap-1">
                  <Wifi size={12} color="#3b82f6" />
                  <Text className="text-xs text-blue-600 dark:text-blue-400">
                    Live
                  </Text>
                </View>
              </View>
            )}
          </View>
          <TimeSlotSkeletonGrid />
        </View>
      );
    }

    if (processedSlots.length === 0) {
      return (
        <View className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Clock size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Available Times</Text>
          </View>
          <View className="items-center py-8">
            <Text className="text-muted-foreground text-center">
              No available times for this date and party size.
            </Text>
            <Text className="text-sm text-muted-foreground text-center mt-1">
              Try selecting a different date or smaller party size.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Clock size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Available Times</Text>
          <View className="bg-green-100 dark:bg-green-900/20 rounded-full px-2 py-1 ml-auto">
            <View className="flex-row items-center gap-1">
              <CheckCircle size={12} color="#10b981" />
              <Text className="text-xs text-green-600 dark:text-green-400">
                {processedSlots.length} slots
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {processedSlots.map((slot) => (
            <TimeSlotItem
              key={slot.time}
              slot={slot}
              isSelected={selectedTime === slot.time}
              onPress={onTimeSelect}
            />
          ))}
        </View>

        {selectedTime && (
          <View className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={16} color="#10b981" />
              <Text className="text-sm text-green-800 dark:text-green-200">
                Selected: {selectedTime}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  },
);

// Table option card with enhanced visuals
const TableOptionCard = memo<{
  option: TableOption;
  isRecommended: boolean;
  onSelect: () => void;
}>(({ option, isRecommended, onSelect }) => {
  // Get table type icons
  const getTableTypeIcon = (tableType: string) => {
    const icons = {
      booth: Crown,
      window: Eye,
      patio: TreePine,
      bar: Utensils,
      private: Crown,
      standard: Utensils,
    };
    return icons[tableType as keyof typeof icons] || Utensils;
  };

  const primaryTableType = option.tableTypes[0];
  const TableIcon = getTableTypeIcon(primaryTableType);

  const handlePress = useCallback(() => {
    onSelect();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      className={`p-4 rounded-xl border-2 ${
        isRecommended ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View
            className={`p-2 rounded-full ${
              isRecommended ? "bg-primary/20" : "bg-muted/50"
            }`}
          >
            <TableIcon size={16} color={isRecommended ? "#3b82f6" : "#666"} />
          </View>
          <Text
            className={`font-bold ${
              isRecommended ? "text-primary" : "text-foreground"
            }`}
          >
            {option.experienceTitle}
          </Text>
        </View>

        {isRecommended && (
          <View className="bg-primary rounded-full px-2 py-1">
            <Text className="text-white text-xs font-bold">RECOMMENDED</Text>
          </View>
        )}

        {option.isPerfectFit && !isRecommended && (
          <View className="bg-green-500 rounded-full px-2 py-1">
            <Text className="text-white text-xs font-bold">PERFECT FIT</Text>
          </View>
        )}
      </View>

      {/* Description */}
      <Text className="text-sm text-muted-foreground mb-3">
        {option.experienceDescription}
      </Text>

      {/* Details */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Users size={14} color="#666" />
            <Text className="text-sm text-muted-foreground">
              {option.totalCapacity} seats
            </Text>
          </View>

          {option.requiresCombination && (
            <View className="bg-orange-100 dark:bg-orange-900/20 px-2 py-1 rounded">
              <Text className="text-orange-700 dark:text-orange-300 text-xs font-medium">
                Combined Tables
              </Text>
            </View>
          )}
        </View>

        <View
          className={`px-3 py-1 rounded-full ${
            isRecommended ? "bg-primary" : "bg-muted"
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              isRecommended ? "text-white" : "text-foreground"
            }`}
          >
            Select
          </Text>
        </View>
      </View>

      {/* Combination Info */}
      {option.combinationInfo && (
        <View className="mt-3 pt-3 border-t border-border">
          <Text className="text-xs text-muted-foreground">
            {option.combinationInfo.reason}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

// Skeleton for table options
const TableOptionSkeleton = memo(() => (
  <View className="p-4 rounded-xl border border-border bg-card">
    <View className="flex-row items-center gap-2 mb-3">
      <View className="w-8 h-8 bg-muted rounded-full" />
      <View className="w-32 h-5 bg-muted rounded" />
    </View>
    <View className="w-full h-4 bg-muted rounded mb-3" />
    <View className="w-3/4 h-4 bg-muted rounded mb-3" />
    <View className="flex-row justify-between">
      <View className="w-20 h-4 bg-muted rounded" />
      <View className="w-16 h-6 bg-muted rounded" />
    </View>
  </View>
));

// Main TableOptions component
export const TableOptions = memo<{
  slotOptions: SlotTableOptions | null;
  onConfirm: (tableIds: string[], selectedOption: TableOption) => void;
  onBack?: () => void;
  loading: boolean;
}>(({ slotOptions, onConfirm, onBack, loading }) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  // Reset selection when options change
  React.useEffect(() => {
    setSelectedOptionIndex(0);
  }, [slotOptions?.time]);

  const handleOptionSelect = useCallback((index: number) => {
    setSelectedOptionIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!slotOptions?.options?.[selectedOptionIndex]) return;

    const selectedOption = slotOptions.options[selectedOptionIndex];
    const tableIds = selectedOption.tables.map((t) => t.id);

    onConfirm(tableIds, selectedOption);
  }, [slotOptions, selectedOptionIndex, onConfirm]);

  if (loading) {
    return (
      <View>
        <View className="flex-row items-center gap-2 mb-4">
          <Sparkles size={20} color="#8b5cf6" />
          <Text className="font-semibold text-lg">Choose Your Experience</Text>
        </View>
        <View className="gap-3">
          <TableOptionSkeleton />
          <TableOptionSkeleton />
        </View>
      </View>
    );
  }

  if (!slotOptions) {
    return (
      <View className="items-center py-8">
        <Text className="text-muted-foreground text-center">
          No seating options available for this time slot.
        </Text>
      </View>
    );
  }

  const { options } = slotOptions;
  const selectedOption = options[selectedOptionIndex];

  return (
    <View>
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-4">
        <Sparkles size={20} color="#8b5cf6" />
        <Text className="font-semibold text-lg">Choose Your Experience</Text>
        {options.length > 1 && (
          <Text className="text-sm text-muted-foreground ml-auto">
            {options.length} options available
          </Text>
        )}
      </View>

      {/* Options */}
      <View className="gap-3 mb-6">
        {options.map((option, index) => (
          <TableOptionCard
            key={`${option.tableTypes.join("-")}-${index}`}
            option={option}
            isRecommended={index === 0}
            onSelect={() => handleOptionSelect(index)}
          />
        ))}
      </View>

      {/* Confirm Button */}
      <Button onPress={handleConfirm} size="lg" className="w-full">
        <View className="flex-row items-center justify-center gap-2">
          <CheckCircle size={20} color="white" />
          <Text className="text-white font-bold">
            Confirm {selectedOption.experienceTitle}
          </Text>
        </View>
      </Button>

      {/* Selected option summary */}
      {selectedOption && (
        <View className="mt-3 p-3 bg-muted/30 rounded-lg">
          <Text className="text-sm font-medium text-center">
            {selectedOption.requiresCombination
              ? `${selectedOption.tables.length} tables arranged for your party`
              : `Table for ${selectedOption.totalCapacity} guests`}{" "}
            • {selectedOption.experienceTitle}
          </Text>
        </View>
      )}
    </View>
  );
});

// Combined component for seamless experience selection
export const ExperienceSelector = memo<{
  restaurantId: string;
  date: Date;
  time: string;
  partySize: number;
  onConfirm: (
    tableIds: string[],
    selectedTime: string,
    selectedDate: Date,
    partySize: number,
    selectedOption: any,
  ) => void;
  onBack: () => void;
}>(({ restaurantId, date, time, partySize, onConfirm, onBack }) => {
  const [slotOptions, setSlotOptions] = useState<SlotTableOptions | null>(null);
  const [loading, setLoading] = useState(true);

  // Load table options for the selected time
  React.useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      try {
        const availabilityService = (
          await import("@/lib/AvailabilityService")
        ).AvailabilityService.getInstance();
        const options = await availabilityService.getTableOptionsForSlot(
          restaurantId,
          date,
          time,
          partySize,
        );
        setSlotOptions(options);
      } catch (error) {
        console.error("Error loading slot options:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [restaurantId, date, time, partySize]);

  const handleConfirm = useCallback(
    (tableIds: string[], selectedOption: TableOption) => {
      onConfirm(tableIds, time, date, partySize, selectedOption);
    },
    [onConfirm, time, date, partySize],
  );

  return (
    <View>
      <TableOptions
        slotOptions={slotOptions}
        onConfirm={handleConfirm}
        onBack={onBack}
        loading={loading}
      />
    </View>
  );
});
