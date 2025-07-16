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
  date: Date;
  time: string;
  partySize: number;
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
}: SearchHeaderProps) => {
  // Animation for collapsible content
  const animatedHeight = React.useRef(new Animated.Value(1)).current;
  const shadowOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isCollapsed ? 0 : 1,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(shadowOpacity, {
        toValue: isCollapsed ? 0.1 : 0,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  }, [isCollapsed]);

  return (
    <Animated.View 
      className="bg-background border-b border-border"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: shadowOpacity,
        shadowRadius: 4,
        elevation: isCollapsed ? 4 : 0,
      }}
    >
      {/* Always visible: Location + Search + Filter */}
      <View className="p-4">
        {/* Location Header */}
        <View className="flex-row items-center justify-between mb-4">
          <LocationDisplay />
          <Text className="text-xs text-muted-foreground">
            Tap to change location
          </Text>
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
      <Animated.View
        style={{
          height: animatedHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 100], // Reduced height since we removed availability toggle
          }),
          opacity: animatedHeight,
          overflow: 'hidden',
          transform: [{
            translateY: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [-30, 0], // More pronounced upward push effect
            })
          }, {
            scaleY: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1], // Subtle scale effect for smooth collapse
            })
          }]
        }}
      >
        <View className="px-4 pb-4">
          {/* Prominent booking filters */}
          <View className="flex-row gap-2 mb-4">
            {/* Date */}
            <Pressable
              onPress={onShowDatePicker}
              className="flex-1 bg-muted rounded-lg p-3"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">Date</Text>
                  <Text className="font-medium">
                    {bookingFilters.date.toDateString() ===
                    new Date().toDateString()
                      ? "Today"
                      : bookingFilters.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                  </Text>
                </View>
                <Calendar size={16} color="#666" />
              </View>
            </Pressable>

            {/* Time */}
            <Pressable
              onPress={onShowTimePicker}
              className="flex-1 bg-muted rounded-lg p-3"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">Time</Text>
                  <Text className="font-medium">{bookingFilters.time}</Text>
                </View>
                <Clock size={16} color="#666" />
              </View>
            </Pressable>

            {/* Party Size */}
            <Pressable
              onPress={onShowPartySizePicker}
              className="bg-muted rounded-lg p-3"
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs text-muted-foreground mb-1">People</Text>
                  <Text className="font-medium">{bookingFilters.partySize}</Text>
                </View>
                <Users size={16} color="#666" />
              </View>
            </Pressable>
          </View>


        </View>
      </Animated.View>
    </Animated.View>
  );
};