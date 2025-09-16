// components/search/SearchHeader.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Pressable,
  TextInput,
  Animated,
  ScrollView,
  Keyboard,
} from "react-native";
import {
  Search as SearchIcon,
  Filter,
  Calendar,
  Clock,
  Users,
  MapPin,
  Tag,
  ChefHat,
  X,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { LocationDisplay } from "./LocationDisplay";
import type { SearchSuggestion } from "@/lib/advancedSearchUtils";

interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

interface SearchHeaderProps {
  searchQuery: string;
  bookingFilters: BookingFilters;
  activeFilterCount: number;
  colorScheme: "light" | "dark";
  isCollapsed?: boolean;
  searchSuggestions?: SearchSuggestion[];
  onSearchChange: (query: string) => void;
  onShowDatePicker: () => void;
  onShowTimePicker: () => void;
  onShowPartySizePicker: () => void;
  onShowGeneralFilters: () => void;
  onShowBookingModal: () => void;
  onGenerateSuggestions?: (query: string) => void;
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
}

export const SearchHeader = ({
  searchQuery,
  bookingFilters,
  activeFilterCount,
  colorScheme,
  isCollapsed = false,
  searchSuggestions = [],
  onSearchChange,
  onShowDatePicker,
  onShowTimePicker,
  onShowPartySizePicker,
  onShowGeneralFilters,
  onShowBookingModal,
  onGenerateSuggestions,
  onSelectSuggestion,
}: SearchHeaderProps) => {
  // Separate animations for better performance
  const animatedHeight = React.useRef(new Animated.Value(1)).current;
  const animatedTransform = React.useRef(new Animated.Value(1)).current;

  // Search suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

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

  // Handle search input changes with debounced suggestions
  const handleSearchChange = useCallback(
    (text: string) => {
      onSearchChange(text);

      if (text.length >= 2 && onGenerateSuggestions) {
        onGenerateSuggestions(text);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    },
    [onSearchChange, onGenerateSuggestions],
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: SearchSuggestion) => {
      onSearchChange(suggestion.value);
      setShowSuggestions(false);
      searchInputRef.current?.blur();
      Keyboard.dismiss();

      if (onSelectSuggestion) {
        onSelectSuggestion(suggestion);
      }
    },
    [onSearchChange, onSelectSuggestion],
  );

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (searchQuery.length >= 2 && searchSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [searchQuery, searchSuggestions]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay hiding suggestions to allow for suggestion tap
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    onSearchChange("");
    setShowSuggestions(false);
    searchInputRef.current?.blur();
  }, [onSearchChange]);

  // Get icon for suggestion type
  const getSuggestionIcon = (type: SearchSuggestion["type"]) => {
    switch (type) {
      case "restaurant":
        return SearchIcon;
      case "cuisine":
        return ChefHat;
      case "tag":
        return Tag;
      case "location":
        return MapPin;
      default:
        return SearchIcon;
    }
  };

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

  const getTimeText = () => {
    if (bookingFilters.time === null) return "Any time";
    return bookingFilters.time;
  };

  const getFilterDisplayText = () => {
    const partyText = getPartySizeText();
    const dateText = getDateText();
    const timeText = getTimeText();

    // If all are "Any", show a simplified message
    if (
      bookingFilters.partySize === null &&
      bookingFilters.date === null &&
      bookingFilters.time === null
    ) {
      return "All restaurants";
    }

    // Build the display text based on what's set
    const parts = [];

    if (bookingFilters.partySize !== null) {
      parts.push(partyText);
    }

    if (bookingFilters.date !== null || bookingFilters.time !== null) {
      if (bookingFilters.date !== null && bookingFilters.time !== null) {
        parts.push(`${dateText}, ${timeText}`);
      } else if (bookingFilters.date !== null) {
        parts.push(`${dateText}, any time`);
      } else {
        parts.push(`any date, ${timeText}`);
      }
    }

    return parts.length > 0 ? parts.join(" • ") : "All restaurants";
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
            className={`border rounded-full px-3 py-2 flex-row items-center gap-2 ${
              bookingFilters.partySize === null &&
              bookingFilters.date === null &&
              bookingFilters.time === null
                ? "bg-muted border-border" // Muted when all are "Any"
                : "bg-primary/10 border-primary/20" // Active when filters are set
            }`}
          >
            <Users
              size={14}
              color={
                bookingFilters.partySize === null &&
                bookingFilters.date === null &&
                bookingFilters.time === null
                  ? "#666" // Muted icon
                  : colorScheme === "dark"
                    ? "#3b82f6"
                    : "#2563eb" // Active icon
              }
            />
            <Text
              className={`text-sm font-medium ${
                bookingFilters.partySize === null &&
                bookingFilters.date === null &&
                bookingFilters.time === null
                  ? "text-muted-foreground" // Muted text
                  : "text-primary" // Active text
              }`}
            >
              {getFilterDisplayText()}
            </Text>
          </Pressable>
        </View>

        {/* Search Input with Filter Button */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row items-center bg-muted rounded-lg px-3 py-2">
            <SearchIcon size={20} color="#666" />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Search restaurants, cuisines..."
              placeholderTextColor="#666"
              className="flex-1 ml-3 text-base text-foreground"
              returnKeyType="search"
              autoCorrect={false}
              autoComplete="off"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={handleClearSearch} className="ml-2">
                <X size={18} color="#666" />
              </Pressable>
            )}
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

      {/* Search Suggestions Dropdown */}
      {showSuggestions && searchSuggestions.length > 0 && (
        <View className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded-b-lg shadow-lg max-h-64">
          <ScrollView showsVerticalScrollIndicator={false}>
            {searchSuggestions.map((suggestion, index) => {
              const IconComponent = getSuggestionIcon(suggestion.type);
              return (
                <Pressable
                  key={`${suggestion.type}-${suggestion.value}-${index}`}
                  onPress={() => handleSuggestionSelect(suggestion)}
                  className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0 active:bg-muted"
                >
                  <IconComponent size={16} color="#666" />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm text-foreground font-medium">
                      {suggestion.label}
                    </Text>
                    <Text className="text-xs text-muted-foreground capitalize">
                      {suggestion.type}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Collapsible Content: Booking Filters */}
    </View>
  );
};
