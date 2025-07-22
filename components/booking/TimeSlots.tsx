// components/booking/TimeSlots.tsx (Optimized)
import React, { useState } from "react";
import { View, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { 
  Clock, Wifi, CheckCircle, ChevronRight, Building, Coffee, Crown, 
  Eye, TreePine, Utensils, Sparkles, Heart, Star, Award, MapPin 
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { TimeSlotBasic } from "@/lib/AvailabilityService";

interface TimeSlotsProps {
  slots: TimeSlotBasic[];
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  loading: boolean;
  showLiveIndicator?: boolean;
}

export const TimeSlots: React.FC<TimeSlotsProps> = ({
  slots,
  selectedTime,
  onTimeSelect,
  loading,
  showLiveIndicator = true,
}) => {
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
                <Text className="text-xs text-blue-600 dark:text-blue-400">Live</Text>
              </View>
            </View>
          )}
        </View>
        <View className="items-center py-8">
          <ActivityIndicator size="large" />
          <Text className="text-muted-foreground text-center mt-2">
            Finding perfect seating options...
          </Text>
        </View>
      </View>
    );
  }

  if (!slots || slots.length === 0) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <Clock size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Available Times</Text>
        </View>
        <View className="items-center py-8">
          <Text className="text-muted-foreground text-center">
            No availability for this date and party size.
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-1">
            Try selecting a different date or party size.
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
        {showLiveIndicator && (
          <View className="bg-green-100 dark:bg-green-900/20 rounded-full px-2 py-1 ml-auto">
            <View className="flex-row items-center gap-1">
              <CheckCircle size={12} color="#10b981" />
              <Text className="text-xs text-green-600 dark:text-green-400">
                {slots.length} slots
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text className="text-sm text-muted-foreground mb-3">
        Select a time to choose your seating experience
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          
          return (
            <Pressable
              key={slot.time}
              onPress={() => {
                onTimeSelect(slot.time);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`px-4 py-3 rounded-lg border-2 min-w-[80px] ${
                isSelected
                  ? "bg-primary border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
            >
              <View className="items-center">
                <Text
                  className={`font-semibold text-center ${
                    isSelected
                      ? "text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {slot.time}
                </Text>
                {isSelected && (
                  <ChevronRight size={14} className="text-primary-foreground mt-1" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedTime && (
        <View className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <CheckCircle size={16} color="#3b82f6" />
            <Text className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              Selected: {selectedTime}
            </Text>
            <Text className="text-xs text-blue-700 dark:text-blue-300 ml-auto">
              Loading seating options...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

interface TableOption {
  tables: any[];
  requiresCombination: boolean;
  totalCapacity: number;
  tableTypes: string[];
  experienceTitle: string;
  experienceDescription: string;
  isPerfectFit: boolean;
  combinationInfo?: {
    primaryTable: any;
    secondaryTable: any;
    reason: string;
  };
}

interface SlotTableOptions {
  time: string;
  options: TableOption[];
  primaryOption: TableOption;
}

interface TableOptionsProps {
  slotOptions: SlotTableOptions;
  onConfirm: (tableIds: string[], selectedOption: TableOption) => void;
  onBack: () => void;
  loading?: boolean;
}

const getExperienceIcon = (tableType: string, isPerfectFit: boolean) => {
  const icons: Record<string, any> = {
    'booth': Crown,
    'window': Eye,
    'patio': TreePine,
    'bar': Coffee,
    'private': Building,
    'standard': Utensils
  };
  
  return icons[tableType] || Utensils;
};

const getExperienceColor = (tableType: string, isPerfectFit: boolean) => {
  const colors: Record<string, string> = {
    'booth': isPerfectFit ? '#8b5cf6' : '#a855f7',
    'window': isPerfectFit ? '#3b82f6' : '#60a5fa',
    'patio': isPerfectFit ? '#10b981' : '#34d399',
    'bar': isPerfectFit ? '#f59e0b' : '#fbbf24',
    'private': isPerfectFit ? '#ef4444' : '#f87171',
    'standard': isPerfectFit ? '#6366f1' : '#818cf8'
  };
  
  return colors[tableType] || '#6b7280';
};

const ExperienceCard: React.FC<{
  option: TableOption;
  isSelected: boolean;
  isPrimary: boolean;
  onSelect: () => void;
}> = ({ option, isSelected, isPrimary, onSelect }) => {
  const { 
    experienceTitle, 
    experienceDescription, 
    requiresCombination, 
    isPerfectFit,
    tableTypes 
  } = option;
  
  const tableType = tableTypes[0];
  const IconComponent = getExperienceIcon(tableType, isPerfectFit);
  const color = getExperienceColor(tableType, isPerfectFit);

  return (
    <Pressable
      onPress={() => {
        onSelect();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      className={`border-2 rounded-xl p-4 mb-3 ${
        isSelected 
          ? "border-primary bg-primary/5" 
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center gap-3 flex-1">
          <View 
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: color + '20' }}
          >
            <IconComponent size={20} color={color} />
          </View>
          
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="font-bold text-lg">
                {experienceTitle}
              </Text>
              {isPrimary && (
                <View className="bg-green-100 dark:bg-green-900/30 rounded-full px-2 py-1">
                  <View className="flex-row items-center gap-1">
                    <Star size={10} color="#10b981" fill="#10b981" />
                    <Text className="text-xs font-bold text-green-600 dark:text-green-400">
                      TOP CHOICE
                    </Text>
                  </View>
                </View>
              )}
             
            </View>
            
            <Text className="text-sm text-muted-foreground">
              {experienceDescription}
            </Text>
          </View>
        </View>

        {isSelected && (
          <CheckCircle size={24} color="#10b981" />
        )}
      </View>

      {/* Experience Details */}
      {requiresCombination ? (
        <View className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Sparkles size={16} color="#f59e0b" />
            <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Exclusive Group Arrangement
            </Text>
          </View>
          <Text className="text-xs text-orange-700 dark:text-orange-300">
            Multiple tables specially arranged and reserved just for your party
          </Text>
        </View>
      ) : (
        <View className="bg-muted/30 rounded-lg p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MapPin size={14} color="#666" />
              <Text className="text-sm font-medium capitalize">
                {tableType.replace('_', ' ')} Experience
              </Text>
            </View>
            
          
          </View>
        </View>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <View className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <View className="flex-row items-center justify-center gap-2">
            <CheckCircle size={16} color="#10b981" />
            <Text className="text-sm font-medium text-green-800 dark:text-green-200">
              Selected Experience
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};

export const TableOptions: React.FC<TableOptionsProps> = ({
  slotOptions,
  onConfirm,
  onBack,
  loading = false,
}) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="items-center py-8">
          <ActivityIndicator size="large" />
          <Text className="text-muted-foreground text-center mt-2">
            Curating your seating experiences...
          </Text>
        </View>
      </View>
    );
  }

  if (!slotOptions || !slotOptions.options || slotOptions.options.length === 0) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <Text className="text-center text-muted-foreground">
          No seating experiences available for this time.
        </Text>
        <Pressable
          onPress={onBack}
          className="mt-3 p-2 bg-muted rounded-lg"
        >
          <Text className="text-center text-primary">Select Different Time</Text>
        </Pressable>
      </View>
    );
  }

  const { time, options, primaryOption } = slotOptions;
  const selectedOption = options[selectedOptionIndex];

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="font-semibold text-lg">Seating Experience for {time}</Text>
          <Text className="text-sm text-muted-foreground">
            Choose your perfect dining atmosphere
          </Text>
        </View>
        <Pressable onPress={onBack} className="p-1">
          <Text className="text-primary text-sm">Change Time</Text>
        </Pressable>
      </View>

      {/* Experience Options */}
      <ScrollView 
        style={{ maxHeight: 400 }} 
        showsVerticalScrollIndicator={false}
        className="mb-4"
      >
        {options.map((option, index) => (
          <ExperienceCard
            key={index}
            option={option}
            isSelected={selectedOptionIndex === index}
            isPrimary={option === primaryOption}
            onSelect={() => setSelectedOptionIndex(index)}
          />
        ))}
      </ScrollView>

      {/* Experience Count Info */}
      {options.length > 1 && (
        <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4">
          <View className="flex-row items-center justify-center gap-2">
            <Sparkles size={16} color="#8b5cf6" />
            <Text className="text-sm text-purple-800 dark:text-purple-200 font-medium text-center">
              {options.length} unique dining experiences available
            </Text>
          </View>
        </View>
      )}

      {/* Confirm Button */}
      <Pressable
        onPress={() => {
          const tableIds = selectedOption.tables.map((t: any) => t.id);
          onConfirm(tableIds, selectedOption);
        }}
        className="bg-primary rounded-lg p-4 mt-2"
      >
        <View className="flex-row items-center justify-center gap-2">
          <CheckCircle size={20} color="white" />
          <Text className="text-center font-semibold text-primary-foreground">
            Reserve This Experience
          </Text>
        </View>
      </Pressable>
    </View>
  );
};