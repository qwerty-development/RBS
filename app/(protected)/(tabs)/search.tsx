// app/(protected)/(tabs)/search.tsx - Updated with debug panel
import React, { useState, useCallback } from "react";
import { View } from "react-native";
import { Region } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { useSearchLogic } from "@/hooks/useSearchLogic";
import { DEFAULT_MAP_REGION } from "@/constants/searchConstants";
import { SearchHeader } from "@/components/search/SearchHeader";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";
import { SearchContent } from "@/components/search/SearchContent";
import { DatePickerModal } from "@/components/search/DatePickerModal";
import { TimePickerModal } from "@/components/search/TimePickerModal";
import { PartySizePickerModal } from "@/components/search/PartySizePickerModal";
import { GeneralFiltersModal } from "@/components/search/GeneralFiltersModal";
import { DebugPanel } from "@/components/debug/DebugPanel"; // Temporary debug component
import { Text } from "@/components/ui/text";

export default function SearchScreen() {
  const { colorScheme } = useColorScheme();

  // Use the updated search logic hook with new location system
  const { searchState, actions, handlers, computed, location } = useSearchLogic();

  // Modal visibility state (local to this component)
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);

  // Map region state - initialize with user location if available
  const [mapRegion, setMapRegion] = useState<Region>(() => {
    if (searchState.userLocation) {
      return {
        latitude: searchState.userLocation.latitude,
        longitude: searchState.userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return DEFAULT_MAP_REGION;
  });

  // Update map region when user location changes
  React.useEffect(() => {
    if (searchState.userLocation) {
      console.log("🗺️ Search screen: Updating map region with user location:", searchState.userLocation);
      setMapRegion((prev) => ({
        ...prev,
        latitude: searchState.userLocation!.latitude,
        longitude: searchState.userLocation!.longitude,
      }));
    }
  }, [searchState.userLocation]);

  // Map region change handler
  const handleMapRegionChange = useCallback(
    (region: Region) => {
      const deltaThreshold = 0.01;
      if (
        Math.abs(region.latitude - mapRegion.latitude) > deltaThreshold ||
        Math.abs(region.longitude - mapRegion.longitude) > deltaThreshold
      ) {
        console.log("🗺️ Search screen: Map region changed:", region);
        setMapRegion(region);
      }
    },
    [mapRegion]
  );

  // Debug logging
  React.useEffect(() => {
    console.log("🔍 Search screen state update:", {
      restaurantCount: searchState.restaurants.length,
      userLocation: searchState.userLocation,
      loading: searchState.loading,
      viewMode: searchState.viewMode,
      locationDisplayName: location.displayName
    });
  }, [searchState, location.displayName]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SearchHeader
        searchQuery={searchState.searchQuery}
        bookingFilters={searchState.bookingFilters}
        viewMode={searchState.viewMode}
        activeFilterCount={computed.activeFilterCount}
        colorScheme={colorScheme}
        onSearchChange={actions.setSearchQuery}
        onShowDatePicker={() => setShowDatePicker(true)}
        onShowTimePicker={() => setShowTimePicker(true)}
        onShowPartySizePicker={() => setShowPartySizePicker(true)}
        onToggleAvailableOnly={handlers.toggleAvailableOnly}
        onViewModeChange={actions.setViewMode}
        onShowGeneralFilters={() => setShowGeneralFilters(true)}
      />

      <SearchResultsHeader
        restaurantCount={searchState.restaurants.length}
        loading={searchState.loading}
        bookingFilters={searchState.bookingFilters}
      />

      <SearchContent
        viewMode={searchState.viewMode}
        restaurants={searchState.restaurants}
        favorites={searchState.favorites}
        loading={searchState.loading}
        refreshing={searchState.refreshing}
        bookingFilters={searchState.bookingFilters}
        colorScheme={colorScheme}
        mapRegion={mapRegion}
        onToggleFavorite={actions.toggleFavorite}
        onDirections={handlers.openDirections}
        onRestaurantPress={handlers.handleRestaurantPress}
        onRefresh={actions.handleRefresh}
        onClearFilters={actions.clearAllFilters}
        onMapRegionChange={handleMapRegionChange}
      />



      {/* Modals */}
      <DatePickerModal
        visible={showDatePicker}
        bookingFilters={searchState.bookingFilters}
        onDateSelect={(date) => actions.updateBookingFilters({ date })}
        onClose={() => setShowDatePicker(false)}
      />
      <TimePickerModal
        visible={showTimePicker}
        bookingFilters={searchState.bookingFilters}
        onTimeSelect={(time) => actions.updateBookingFilters({ time })}
        onClose={() => setShowTimePicker(false)}
      />
      <PartySizePickerModal
        visible={showPartySizePicker}
        bookingFilters={searchState.bookingFilters}
        onPartySizeSelect={(partySize) =>
          actions.updateBookingFilters({ partySize })
        }
        onClose={() => setShowPartySizePicker(false)}
      />
      <GeneralFiltersModal
        visible={showGeneralFilters}
        generalFilters={searchState.generalFilters}
        onApplyFilters={(filters) => {
          actions.updateGeneralFilters(filters);
          setShowGeneralFilters(false);
        }}
        onClose={() => setShowGeneralFilters(false)}
      />

      {/* Debug info for location in development */}
      
    </SafeAreaView>
  );
}