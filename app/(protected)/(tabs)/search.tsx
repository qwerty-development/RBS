// app/(protected)/(tabs)/search.tsx
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

export default function SearchScreen() {
  const { colorScheme } = useColorScheme();

  // Use the main search logic hook
  const { searchState, actions, handlers, computed } = useSearchLogic();

  // Modal visibility state (local to this component)
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);

  // Map region state (separate from search logic)
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);

  // Map region change handler
  const handleMapRegionChange = useCallback(
    (region: Region) => {
      const deltaThreshold = 0.01;
      if (
        Math.abs(region.latitude - mapRegion.latitude) > deltaThreshold ||
        Math.abs(region.longitude - mapRegion.longitude) > deltaThreshold
      ) {
        setMapRegion(region);
      }
    },
    [mapRegion]
  );

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
    </SafeAreaView>
  );
}
