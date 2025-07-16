// app/(protected)/(tabs)/search.tsx - Updated with collapsible header
import React, { useState, useCallback } from "react";
import { View } from "react-native";
import { Region } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { useColorScheme } from "@/lib/useColorScheme";
import { useSearchLogic } from "@/hooks/useSearchLogic";
import { DEFAULT_MAP_REGION } from "@/constants/searchConstants";
import { SearchHeader } from "@/components/search/SearchHeader";
import { ViewToggleTabs } from "@/components/search/ViewToggleTabs";
import { SearchContent } from "@/components/search/SearchContent";
import { DatePickerModal } from "@/components/search/DatePickerModal";
import { TimePickerModal } from "@/components/search/TimePickerModal";
import { PartySizePickerModal } from "@/components/search/PartySizePickerModal";
import { GeneralFiltersModal } from "@/components/search/GeneralFiltersModal";

export default function SearchScreen() {
  const { colorScheme } = useColorScheme();

  const { searchState, actions, handlers, computed, location } =
    useSearchLogic();

  // Modal visibility state
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);

  // Header collapse state
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Map region state
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
      setMapRegion((prev) => ({
        ...prev,
        latitude: searchState.userLocation!.latitude,
        longitude: searchState.userLocation!.longitude,
      }));
    }
  }, [searchState.userLocation]);

  // Handle scroll to determine header collapse
  const handleScroll = useCallback((event: any) => {
    // Don't handle scroll collapse if in map view (it should stay collapsed)
    if (searchState.viewMode === "map") return;
    
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldCollapse = scrollY > 30; // More sensitive threshold for better push feeling
    
    if (shouldCollapse !== isHeaderCollapsed) {
      setIsHeaderCollapsed(shouldCollapse);
    }
  }, [isHeaderCollapsed, searchState.viewMode]);

  // Auto-collapse header when switching to map view
  const handleMapViewSelected = useCallback(() => {
    setIsHeaderCollapsed(true);
  }, []);

  // Auto-expand header when switching back to list view
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    actions.setViewMode(mode);
    if (mode === "list") {
      setIsHeaderCollapsed(false);
    }
  }, [actions]);

  // Map region change handler
  const handleMapRegionChange = useCallback(
    (region: Region) => {
      setMapRegion(region);
    },
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Collapsible Search Header */}
      <SearchHeader
        searchQuery={searchState.searchQuery}
        bookingFilters={searchState.bookingFilters}
        activeFilterCount={computed.activeFilterCount}
        colorScheme={colorScheme}
        isCollapsed={isHeaderCollapsed}
        onSearchChange={actions.setSearchQuery}
        onShowDatePicker={() => setShowDatePicker(true)}
        onShowTimePicker={() => setShowTimePicker(true)}
        onShowPartySizePicker={() => setShowPartySizePicker(true)}
        onShowGeneralFilters={() => setShowGeneralFilters(true)}
      />

      {/* View Toggle Tabs - Always visible below header */}
      <ViewToggleTabs
        viewMode={searchState.viewMode}
        colorScheme={colorScheme}
        onViewModeChange={handleViewModeChange}
        onMapViewSelected={handleMapViewSelected}
        restaurantCount={searchState.restaurants.length}
      />

      {/* Search Content with Scroll Handling */}
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
        onScroll={handleScroll} // Pass scroll handler
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
    </SafeAreaView>
  );
}