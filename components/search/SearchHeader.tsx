// components/search/SearchHeader.tsx
import React from "react";
import { View, Pressable, TextInput, Animated } from "react-native";
import {
  Search as SearchIcon,
  Filter,
  Calendar,
  Clock,
  Users,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { LocationDisplay } from "./LocationDisplay";

interface BookingFilters {
  date: Date | null;
  time: string;
  partySize: number | null;
  availableOnly: boolean;
}

interface SearchHeaderProps {
  searchQuery: string;
  bookingFilters: BookingFilters;
  activeFilterCount: number;
  colorScheme: "light" | "dark";
  isCollapsed?: boolean;
  onSearchChange: (query: string) => void;
  onShowDatePicker: () => void;
  onShowTimePicker: () => void;
  onShowPartySizePicker: () => void;
  onShowGeneralFilters: () => void;
  onShowBookingModal: () => void; // New prop for the booking bubble
}

export const SearchHeader = ({
  searchQuery,
  bookingFilters,
  activeFilterCount,
  colorScheme,
  isCollapsed = false,
  onSearchChange,
  onShowDatePicker,
  onShowTimePicker,
  onShowPartySizePicker,
  onShowGeneralFilters,
  onShowBookingModal,
}: SearchHeaderProps) => {
  // Separate animations for better performance
  const animatedHeight = React.useRef(new Animated.Value(1)).current;
  const animatedTransform = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // Use parallel animations with native driver when possible
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isCollapsed ? 0 : 1,
        duration: 200, // Faster animation
        useNativeDriver: false, // Can't use native driver for height
      }),
      Animated.timing(animatedTransform, {
        toValue: isCollapsed ? 0 : 1,
        duration: 200, // Faster animation
        useNativeDriver: true, // Use native driver for better performance
      }),
    ]).start();
  }, [isCollapsed]);

  // Helper functions for display text
  const getPartySizeText = () => {
    if (bookingFilters.partySize === null) return "Any size";
    return bookingFilters.partySize.toString();
  };

  const getDateText = () => {
    if (bookingFilters.date === null) return "Any date";
    if (bookingFilters.date.toDateString() === new Date().toDateString()) {
      return "Today";
    }
    return bookingFilters.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View className="bg-background border-b border-border">
      {/* Always visible: Location + Search + Filter */}
      <View className="p-4">
        {/* Location Header with Booking Bubble */}
        <View className="flex-row items-center justify-between mb-4">
          <LocationDisplay />

          {/* Booking Quick Access Bubble */}
          <Pressable
            onPress={onShowBookingModal}
            className="bg-primary/10 border border-primary/20 rounded-full px-3 py-2 flex-row items-center gap-2"
          >
            <Users
              size={14}
              color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"}
            />
            <Text className="text-primary text-sm font-medium">
              {getPartySizeText()} • {getDateText()}, {bookingFilters.time}
            </Text>
          </Pressable>
        </View>

        {/* Search Input with Filter Button */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row items-center bg-muted rounded-lg px-3 py-2">
            <SearchIcon size={20} color="#666" />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Search restaurants, cuisines..."
              placeholderTextColor="#666"
              className="flex-1 ml-3 text-base text-foreground"
              returnKeyType="search"
            />
          </View>

          {/* Filter Button */}
          <Pressable
            onPress={onShowGeneralFilters}
            className="bg-primary px-4 py-3 rounded-lg"
          >
            <View className="flex-row items-center justify-center gap-2">
              <Filter size={18} color="#fff" />
              {activeFilterCount > 0 && (
                <View className="bg-white rounded-full px-2 py-0.5">
                  <Text className="text-xs text-primary font-medium">
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Collapsible Content: Booking Filters */}
    </View>
  );
};
