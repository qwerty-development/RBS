// components/search/GeneralFiltersModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Modal, Pressable, ScrollView } from "react-native";
import { X, Star, Check } from "lucide-react-native";
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
  sortBy: "recommended" | "rating" | "distance" | "name";
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
        <SafeAreaView
          className="flex-1 bg-gray-50 dark:bg-gray-900"
          edges={["top"]}
        >
          {/* Header */}
          <View className="bg-white dark:bg-gray-800 px-6 py-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <H3 className="text-gray-900 dark:text-white">Filters</H3>
              <Pressable
                onPress={onClose}
                className="p-2 -mr-2 rounded-full active:bg-gray-100 dark:active:bg-gray-700"
              >
                <X size={24} className="text-gray-600 dark:text-gray-300" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 16 }}
          >
            {/* Sort By Section */}
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 shadow-sm">
              <Text className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                Sort By
              </Text>
              <View className="space-y-3">
                {[
                  {
                    value: "recommended",
                    label: "Recommended",
                    desc: "Best overall matches",
                  },

                  {
                    value: "rating",
                    label: "Highest Rated",
                    desc: "Top customer reviews",
                  },
                  {
                    value: "distance",
                    label: "Nearest First",
                    desc: "Closest to your location",
                  },
                  { value: "name", label: "A-Z", desc: "Alphabetical order" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        sortBy: option.value as any,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 ${
                      tempFilters.sortBy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            tempFilters.sortBy === option.value
                              ? "text-primary"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {option.desc}
                        </Text>
                      </View>
                      {tempFilters.sortBy === option.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Distance & Location */}
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 shadow-sm">
              <DistanceFilter
                selectedDistance={tempFilters.maxDistance}
                onDistanceChange={(distance) =>
                  setTempFilters((prev) => ({ ...prev, maxDistance: distance }))
                }
              />
            </View>

            {/* Price & Rating Row */}
            <View className="flex-row gap-4 mb-4">
              {/* Price Range */}
              <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
                <Text className="font-semibold text-gray-900 dark:text-white mb-3">
                  Price
                </Text>
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4].map((price) => (
                    <Pressable
                      key={price}
                      onPress={() => togglePriceRange(price)}
                      className={`flex-1 items-center py-3 rounded-lg ${
                        tempFilters.priceRange.includes(price)
                          ? "bg-primary"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      <Text
                        className={`font-bold text-sm ${
                          tempFilters.priceRange.includes(price)
                            ? "text-white"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {"$".repeat(price)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Minimum Rating */}
              <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
                <Text className="font-semibold text-gray-900 dark:text-white mb-3">
                  Rating
                </Text>
                <View className="flex-row gap-2">
                  {[0, 3, 4, 4.5].map((rating) => (
                    <Pressable
                      key={rating}
                      onPress={() =>
                        setTempFilters((prev) => ({
                          ...prev,
                          minRating: rating,
                        }))
                      }
                      className={`flex-1 items-center py-3 rounded-lg ${
                        tempFilters.minRating === rating
                          ? "bg-primary"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      <View className="items-center">
                        {rating > 0 && (
                          <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        )}
                        <Text
                          className={`text-xs font-medium mt-1 ${
                            tempFilters.minRating === rating
                              ? "text-white"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {rating === 0 ? "Any" : `${rating}+`}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Cuisine Types */}
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 shadow-sm">
              <Text className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                Cuisine Types
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CUISINE_TYPES.map((cuisine) => (
                  <Pressable
                    key={cuisine}
                    onPress={() => toggleCuisine(cuisine)}
                    className={`px-4 py-2 rounded-full ${
                      tempFilters.cuisines.includes(cuisine)
                        ? "bg-primary"
                        : "bg-gray-100 dark:bg-gray-700"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        tempFilters.cuisines.includes(cuisine)
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {cuisine}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Features & Amenities */}
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-4 shadow-sm">
              <Text className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                Features & Amenities
              </Text>
              <View className="grid grid-cols-2 gap-3">
                {FEATURES.map((feature) => (
                  <Pressable
                    key={feature.id}
                    onPress={() => toggleFeature(feature.id)}
                    className={`p-3 rounded-lg border-2 flex-row items-center ${
                      tempFilters.features.includes(feature.id)
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
                        tempFilters.features.includes(feature.id)
                          ? "border-primary bg-primary"
                          : "border-gray-300 dark:border-gray-500"
                      }`}
                    >
                      {tempFilters.features.includes(feature.id) && (
                        <Check size={12} className="text-white" />
                      )}
                    </View>
                    <Text
                      className={`flex-1 text-sm font-medium ${
                        tempFilters.features.includes(feature.id)
                          ? "text-primary"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {feature.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Booking Policy */}
            <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm">
              <Text className="font-semibold text-lg text-gray-900 dark:text-white mb-4">
                Booking Type
              </Text>
              <View className="space-y-3">
                {[
                  {
                    value: "all",
                    label: "All restaurants",
                    desc: "Show all booking options",
                  },
                  {
                    value: "instant",
                    label: "Instant booking only",
                    desc: "Book immediately without waiting",
                  },
                  {
                    value: "request",
                    label: "Request booking only",
                    desc: "Requires restaurant confirmation",
                  },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        bookingPolicy: option.value as any,
                      }))
                    }
                    className={`p-3 rounded-lg border-2 ${
                      tempFilters.bookingPolicy === option.value
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`font-medium ${
                            tempFilters.bookingPolicy === option.value
                              ? "text-primary"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {option.label}
                        </Text>
                        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {option.desc}
                        </Text>
                      </View>
                      {tempFilters.bookingPolicy === option.value && (
                        <Check size={20} className="text-primary" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Buttons */}
          <View className="bg-white dark:bg-gray-800 px-4 py-4 border-t border-gray-200 dark:border-gray-600">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 border-2 border-gray-300 dark:border-gray-600"
                onPress={clearAllFilters}
              >
                <Text className="font-semibold text-gray-700 dark:text-gray-300">
                  Clear All
                </Text>
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-primary"
                onPress={applyFilters}
              >
                <Text className="font-semibold text-white">Apply Filters</Text>
              </Button>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  },
);
