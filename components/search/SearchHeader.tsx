// components/search/SearchHeader.tsx
import React from "react";
import { View, Pressable, TextInput } from "react-native";
import {
  Search as SearchIcon,
  Map,
  List,
  Filter,
  Calendar,
  Clock,
  Users,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { LocationDisplay } from "./LocationDisplay";
import { LocationTestButton } from "../debug/LocationTestButton";

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

type ViewMode = "list" | "map";

interface SearchHeaderProps {
  searchQuery: string;
  bookingFilters: BookingFilters;
  viewMode: ViewMode;
  activeFilterCount: number;
  colorScheme: "light" | "dark";
  onSearchChange: (query: string) => void;
  onShowDatePicker: () => void;
  onShowTimePicker: () => void;
  onShowPartySizePicker: () => void;
  onToggleAvailableOnly: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onShowGeneralFilters: () => void;
}

export const SearchHeader = ({
  searchQuery,
  bookingFilters,
  viewMode,
  activeFilterCount,
  colorScheme,
  onSearchChange,
  onShowDatePicker,
  onShowTimePicker,
  onShowPartySizePicker,
  onToggleAvailableOnly,
  onViewModeChange,
  onShowGeneralFilters,
}: SearchHeaderProps) => {
  return (
    <View className="p-4 border-b border-border">
      {/* Location Header */}
      <View className="flex-row items-center justify-between mb-4">
        <LocationDisplay />
        <Text className="text-xs text-muted-foreground">
          Tap to change location
        </Text>
      </View>

      {/* Search Input */}
      <View className="flex-row items-center gap-3 bg-muted rounded-lg px-3 py-2 mb-4">
        <SearchIcon size={20} color="#666" />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search restaurants, cuisines..."
          placeholderTextColor="#666"
          className="flex-1 text-base text-foreground"
          returnKeyType="search"
        />
      </View>
      
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
                {bookingFilters.date.toDateString() === new Date().toDateString() 
                  ? "Today" 
                  : bookingFilters.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
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
      
      {/* Secondary filters */}
      <View className="flex-row items-center justify-between">
        {/* Availability toggle */}
        <Pressable
          onPress={onToggleAvailableOnly}
          className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
            bookingFilters.availableOnly 
              ? "bg-green-100 dark:bg-green-900/20 border-green-500" 
              : "bg-background border-border"
          }`}
        >
          <Text className={`text-sm font-medium ${
            bookingFilters.availableOnly ? "text-green-800 dark:text-green-200" : ""
          }`}>
            Available Now
          </Text>
        </Pressable>
        
        {/* View toggle */}
        <View className="flex-row bg-muted rounded-lg p-1">
          <Pressable
            onPress={() => onViewModeChange("list")}
            className={`flex-row items-center gap-2 px-3 py-1 rounded-md ${
              viewMode === "list" ? "bg-background" : ""
            }`}
          >
            <List size={16} color={viewMode === "list" ? (colorScheme === "dark" ? "#fff" : "#000") : "#666"} />
          </Pressable>
          <Pressable
            onPress={() => onViewModeChange("map")}
            className={`flex-row items-center gap-2 px-3 py-1 rounded-md ${
              viewMode === "map" ? "bg-background" : ""
            }`}
          >
            <Map size={16} color={viewMode === "map" ? (colorScheme === "dark" ? "#fff" : "#000") : "#666"} />
          </Pressable>
        </View>
        
        {/* More filters */}
        <Pressable
          onPress={onShowGeneralFilters}
          className="flex-row items-center gap-2 bg-primary px-3 py-2 rounded-lg"
        >
          <Filter size={16} color="#fff" />
          <Text className="text-primary-foreground font-medium">Filters</Text>
          {activeFilterCount > 0 && (
            <View className="bg-white rounded-full px-2 py-0.5 ml-1">
              <Text className="text-xs text-primary font-medium">
                {activeFilterCount}
              </Text>
            </View>
          )}
        </Pressable>

      </View>
    </View>
  );
};