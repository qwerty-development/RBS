// components/booking/SectionSelector.tsx
import React, { memo, useState } from "react";
import { View, Pressable, ActivityIndicator, Modal, ScrollView } from "react-native";
import { MapPin, ChevronDown, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { Database } from "@/types/supabase";

// Types
type RestaurantSection = Database["public"]["Tables"]["restaurant_sections"]["Row"];

interface SectionSelectorProps {
  sections: RestaurantSection[];
  selectedSectionId: string | null;
  onSectionSelect: (sectionId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export const SectionSelector = memo<SectionSelectorProps>(({
  sections,
  selectedSectionId,
  onSectionSelect,
  loading = false,
  disabled = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  if (loading) {
    return (
      <View className="bg-card border border-border rounded-xl p-4 mb-4">
        <View className="flex-row items-center gap-3 mb-2">
          <MapPin size={20} color="#3b82f6" />
          <Text className="font-semibold text-base">Select Section</Text>
        </View>
        
        <View className="items-center justify-center py-4">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="mt-2 text-muted-foreground text-sm">Loading sections...</Text>
        </View>
      </View>
    );
  }

  if (!sections || sections.length === 0) {
    return null; // Don't show anything if no sections available
  }

  const selectedSection = sections.find(section => section.id === selectedSectionId);

  const handleDropdownPress = () => {
    if (disabled) return;
    setIsDropdownOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSectionSelect = (sectionId: string) => {
    onSectionSelect(sectionId);
    setIsDropdownOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAnySectionSelect = () => {
    onSectionSelect("any"); // Use "any" as a special value
    setIsDropdownOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <>
      <View className={`bg-card border border-border rounded-xl p-4 mb-4 ${disabled ? "opacity-60" : ""}`}>
        <View className="flex-row items-center gap-3 mb-3">
          <MapPin size={20} color="#3b82f6" />
          <View className="flex-1">
            <Text className="font-semibold text-base">Select Section</Text>
            <Text className="text-sm text-muted-foreground">
              Choose your preferred seating area
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleDropdownPress}
          disabled={disabled}
          className={`border border-border rounded-lg p-3 flex-row items-center justify-between ${
            disabled ? "opacity-50" : "active:bg-muted"
          }`}
        >
          <View className="flex-row items-center gap-3 flex-1">
            {selectedSection ? (
              <>
                <View 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedSection.color || "#3b82f6" }}
                />
                <View className="flex-1">
                  <Text className="font-medium text-base">{selectedSection.name}</Text>
                  {selectedSection.description && (
                    <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                      {selectedSection.description}
                    </Text>
                  )}
                </View>
              </>
            ) : selectedSectionId === "any" ? (
              <>
                <View 
                  className="w-4 h-4 rounded-full bg-gray-400"
                />
                <View className="flex-1">
                  <Text className="font-medium text-base">Any Section</Text>
                  <Text className="text-sm text-muted-foreground">
                    No preference - any available section
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View 
                  className="w-4 h-4 rounded-full bg-gray-400"
                />
                <View className="flex-1">
                  <Text className="font-medium text-base">Any Section</Text>
                  <Text className="text-sm text-muted-foreground">
                    No preference - any available section
                  </Text>
                </View>
              </>
            )}
          </View>
          <ChevronDown size={20} color="#6b7280" />
        </Pressable>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={isDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <Pressable 
          className="flex-1 bg-black/50 justify-center px-4"
          onPress={() => setIsDropdownOpen(false)}
        >
          <View className="bg-card border border-border rounded-xl p-4 max-h-96">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-semibold text-lg">Choose Section</Text>
              <Pressable
                onPress={() => setIsDropdownOpen(false)}
                className="p-1"
              >
                <Text className="text-muted-foreground text-xl">×</Text>
              </Pressable>
            </View>

            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              <View className="gap-2">
                {/* Any Section Option */}
                <Pressable
                  onPress={handleAnySectionSelect}
                  className={`p-3 rounded-lg border ${
                    selectedSectionId === "any" || !selectedSectionId
                      ? "border-primary bg-primary/10"
                      : "border-border active:bg-muted"
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-4 h-4 rounded-full bg-gray-400" />
                    <View className="flex-1">
                      <Text className="font-medium text-base">Any Section</Text>
                      <Text className="text-sm text-muted-foreground">
                        No preference - any available section
                      </Text>
                    </View>
                    {(selectedSectionId === "any" || !selectedSectionId) && (
                      <Check size={20} color="#3b82f6" />
                    )}
                  </View>
                </Pressable>

                {/* Divider */}
                <View className="h-px bg-border my-1" />

                {/* Specific Sections */}
                {sections.map((section) => (
                  <Pressable
                    key={section.id}
                    onPress={() => handleSectionSelect(section.id)}
                    className={`p-3 rounded-lg border ${
                      selectedSectionId === section.id
                        ? "border-primary bg-primary/10"
                        : "border-border active:bg-muted"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: section.color || "#3b82f6" }}
                      />
                      <View className="flex-1">
                        <Text className="font-medium text-base">{section.name}</Text>
                        {section.description && (
                          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                            {section.description}
                          </Text>
                        )}
                      </View>
                      {selectedSectionId === section.id && (
                        <Check size={20} color="#3b82f6" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

SectionSelector.displayName = "SectionSelector";