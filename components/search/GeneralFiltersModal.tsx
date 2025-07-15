// components/search/GeneralFiltersModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { X, Star } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { H3 } from "@/components/ui/typography";
import { SafeAreaView } from "@/components/safe-area-view";
import { DistanceFilter } from "./DistanceFilter";

const CUISINE_TYPES = [
  "Lebanese",
  "Italian",
  "French",
  "Japanese",
  "Chinese",
  "Indian",
  "Mexican",
  "American",
  "Mediterranean",
  "Seafood",
  "Steakhouse",
  "Vegetarian",
];

const FEATURES = [
  { id: "outdoor_seating", label: "Outdoor Seating", field: "outdoor_seating" },
  { id: "valet_parking", label: "Valet Parking", field: "valet_parking" },
  { id: "parking_available", label: "Parking", field: "parking_available" },
  { id: "shisha_available", label: "Shisha", field: "shisha_available" },
  { id: "live_music", label: "Live Music", field: "live_music_schedule" },
];

interface GeneralFilters {
  sortBy: "recommended" | "rating" | "distance" | "name" | "availability";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
  maxDistance: number | null;
}

interface GeneralFiltersModalProps {
  visible: boolean;
  generalFilters: GeneralFilters;
  onApplyFilters: (filters: GeneralFilters) => void;
  onClose: () => void;
}

export const GeneralFiltersModal = React.memo(
  ({
    visible,
    generalFilters,
    onApplyFilters,
    onClose,
  }: GeneralFiltersModalProps) => {
    const [tempFilters, setTempFilters] = useState(generalFilters);

    // Synchronize with props when modal opens
    useEffect(() => {
      if (visible) {
        setTempFilters(generalFilters);
      }
    }, [visible, generalFilters]);

    const applyFilters = useCallback(() => {
      onApplyFilters(tempFilters);
      onClose();
    }, [tempFilters, onApplyFilters, onClose]);

    const clearAllFilters = useCallback(() => {
      const defaultFilters: GeneralFilters = {
        sortBy: "recommended",
        cuisines: [],
        features: [],
        priceRange: [1, 2, 3, 4],
        bookingPolicy: "all",
        minRating: 0,
        maxDistance: null,
      };
      setTempFilters(defaultFilters);
    }, []);

    const toggleCuisine = useCallback(
      (cuisine: string) => {
        const isSelected = tempFilters.cuisines.includes(cuisine);
        setTempFilters((prev) => ({
          ...prev,
          cuisines: isSelected
            ? prev.cuisines.filter((c) => c !== cuisine)
            : [...prev.cuisines, cuisine],
        }));
      },
      [tempFilters.cuisines],
    );

    const togglePriceRange = useCallback(
      (price: number) => {
        const isSelected = tempFilters.priceRange.includes(price);
        setTempFilters((prev) => ({
          ...prev,
          priceRange: isSelected
            ? prev.priceRange.filter((p) => p !== price)
            : [...prev.priceRange, price].sort(),
        }));
      },
      [tempFilters.priceRange],
    );

    const toggleFeature = useCallback(
      (featureId: string) => {
        const isSelected = tempFilters.features.includes(featureId);
        setTempFilters((prev) => ({
          ...prev,
          features: isSelected
            ? prev.features.filter((f) => f !== featureId)
            : [...prev.features, featureId],
        }));
      },
      [tempFilters.features],
    );

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <H3>More Filters</H3>
            <Pressable onPress={onClose}>
              <X size={24} />
            </Pressable>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Sort By */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Sort By</Text>
              <View className="gap-3">
                {[
                  { value: "recommended", label: "Recommended" },
                  { value: "availability", label: "Best Availability" },
                  { value: "rating", label: "Highest Rated" },
                  { value: "distance", label: "Nearest First" },
                  { value: "name", label: "A-Z" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        sortBy: option.value as any,
                      }))
                    }
                    className="flex-row items-center gap-3"
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                        tempFilters.sortBy === option.value
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {tempFilters.sortBy === option.value && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <Text>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Distance Filter */}
            <DistanceFilter
              selectedDistance={tempFilters.maxDistance}
              onDistanceChange={(distance) =>
                setTempFilters((prev) => ({ ...prev, maxDistance: distance }))
              }
            />

            {/* Cuisines */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Cuisine Types</Text>
              <View className="flex-row flex-wrap gap-2">
                {CUISINE_TYPES.map((cuisine) => (
                  <Pressable
                    key={cuisine}
                    onPress={() => toggleCuisine(cuisine)}
                    className={`px-3 py-2 rounded-full border ${
                      tempFilters.cuisines.includes(cuisine)
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.cuisines.includes(cuisine)
                          ? "text-primary-foreground"
                          : ""
                      }
                    >
                      {cuisine}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Price Range</Text>
              <View className="flex-row gap-3">
                {[1, 2, 3, 4].map((price) => (
                  <Pressable
                    key={price}
                    onPress={() => togglePriceRange(price)}
                    className={`flex-1 items-center py-3 rounded-lg border ${
                      tempFilters.priceRange.includes(price)
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={`font-bold ${
                        tempFilters.priceRange.includes(price)
                          ? "text-primary-foreground"
                          : ""
                      }`}
                    >
                      {"$".repeat(price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Features & Amenities */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Features & Amenities</Text>
              <View className="gap-3">
                {FEATURES.map((feature) => (
                  <Pressable
                    key={feature.id}
                    onPress={() => toggleFeature(feature.id)}
                    className="flex-row items-center gap-3"
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 items-center justify-center ${
                        tempFilters.features.includes(feature.id)
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {tempFilters.features.includes(feature.id) && (
                        <Text className="text-white text-xs">✓</Text>
                      )}
                    </View>
                    <Text>{feature.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Booking Policy */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Booking Type</Text>
              <View className="gap-3">
                {[
                  { value: "all", label: "All restaurants" },
                  { value: "instant", label: "Instant booking only" },
                  { value: "request", label: "Request booking only" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        bookingPolicy: option.value as any,
                      }))
                    }
                    className="flex-row items-center gap-3"
                  >
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                        tempFilters.bookingPolicy === option.value
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {tempFilters.bookingPolicy === option.value && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <Text>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Minimum Rating */}
            <View className="p-4">
              <Text className="font-semibold mb-3">Minimum Rating</Text>
              <View className="flex-row gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() =>
                      setTempFilters((prev) => ({ ...prev, minRating: rating }))
                    }
                    className={`px-3 py-2 rounded-lg border ${
                      tempFilters.minRating === rating
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <View className="flex-row items-center gap-1">
                      {rating > 0 && (
                        <Star size={14} color="#f59e0b" fill="#f59e0b" />
                      )}
                      <Text
                        className={`text-sm ${
                          tempFilters.minRating === rating
                            ? "text-primary-foreground"
                            : ""
                        }`}
                      >
                        {rating === 0 ? "Any" : `${rating}+`}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom buttons */}
          <View className="p-4 border-t border-border">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={clearAllFilters}
              >
                <Text>Clear All</Text>
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onPress={applyFilters}
              >
                <Text>Apply Filters</Text>
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  },
);
