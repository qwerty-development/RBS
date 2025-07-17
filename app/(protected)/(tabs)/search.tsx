// app/(protected)/(tabs)/search.tsx
import React, { useState, useCallback } from "react";
import { View, Modal } from "react-native";
import { Region } from "react-native-maps";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { useAuth } from "@/context/supabase-provider"; // Import useAuth
import { useColorScheme } from "@/lib/useColorScheme";
import { useSearchLogic } from "@/hooks/useSearchLogic";
import { DEFAULT_MAP_REGION } from "@/constants/searchConstants";
import { SearchHeader } from "@/components/search/SearchHeader";
import { ViewToggleTabs, ViewMode } from "@/components/search/ViewToggleTabs";
import { SearchContent } from "@/components/search/SearchContent";
import { BookingQuickModal } from "@/components/search/BookingQuickModal";
import { DatePickerModal } from "@/components/search/DatePickerModal";
import { TimePickerModal } from "@/components/search/TimePickerModal";
import { PartySizePickerModal } from "@/components/search/PartySizePickerModal";
import { GeneralFiltersModal } from "@/components/search/GeneralFiltersModal";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";

// --- New Guest Prompt Modal ---
// This modal appears when a guest tries to perform a protected action.
const GuestPromptModal = ({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/60">
        <View className="bg-background w-4/5 rounded-2xl p-6 items-center">
          <H3 className="mb-2 text-center">Save Your Finds</H3>
          <P className="text-muted-foreground text-center mb-6">
            Please sign up or log in to save restaurants to your favorites.
          </P>
          <Button onPress={onConfirm} className="w-full mb-3" size="lg">
            <Text className="font-bold text-white">Continue</Text>
          </Button>
          <Button onPress={onClose} variant="ghost" className="w-full">
            <Text>Not Now</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
};

export default function SearchScreen() {
  const { colorScheme } = useColorScheme();
  const { searchState, actions, handlers, computed } = useSearchLogic();

  // --- MODIFIED: Auth and Guest State ---
  const { user, isGuest, convertGuestToUser } = useAuth();
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Other modal visibility states
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);
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

  // --- NEW: Guest Guard Logic ---
  // This function wraps actions that are not available to guests.
  const runProtectedAction = (callback: () => void) => {
    if (isGuest) {
      // If user is a guest, show the prompt instead of running the action.
      setShowGuestPrompt(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (user) {
      // If user is logged in, run the action.
      callback();
    }
  };

  // --- NEW: Handler for the guest prompt's confirm button ---
  const handleConfirmGuestPrompt = async () => {
    setShowGuestPrompt(false);
    await convertGuestToUser();
    // The AuthProvider will automatically handle navigation to the welcome screen.
  };

  // --- MODIFIED: The favorite action is now wrapped by the guest guard ---
  const handleToggleFavoriteProtected = (restaurantId: string) => {
    runProtectedAction(() => actions.toggleFavorite(restaurantId));
  };

  // Unchanged handlers
  const handleScroll = useCallback(
    (event: any) => {
      if (searchState.viewMode === "map") return;
      const scrollY = event.nativeEvent.contentOffset.y;
      const shouldCollapse = scrollY > 20;
      if (shouldCollapse !== isHeaderCollapsed) {
        setIsHeaderCollapsed(shouldCollapse);
      }
    },
    [isHeaderCollapsed, searchState.viewMode],
  );

  const handleMapViewSelected = useCallback(() => {
    requestAnimationFrame(() => {
      if (!isHeaderCollapsed) {
        setIsHeaderCollapsed(true);
      }
    });
  }, [isHeaderCollapsed]);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      actions.setViewMode(mode);
      requestAnimationFrame(() => {
        if (mode === "list" && isHeaderCollapsed) {
          setIsHeaderCollapsed(false);
        }
      });
    },
    [actions, isHeaderCollapsed],
  );

  const handleMapRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
        onShowBookingModal={() => setShowBookingModal(true)}
      />

      <ViewToggleTabs
        viewMode={searchState.viewMode}
        colorScheme={colorScheme}
        onViewModeChange={handleViewModeChange}
        onMapViewSelected={handleMapViewSelected}
        restaurantCount={searchState.restaurants.length}
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
        onToggleFavorite={handleToggleFavoriteProtected} // MODIFIED: Use the protected handler
        onDirections={handlers.openDirections}
        onRestaurantPress={handlers.handleRestaurantPress}
        onRefresh={actions.handleRefresh}
        onClearFilters={actions.clearAllFilters}
        onMapRegionChange={handleMapRegionChange}
        onScroll={handleScroll}
      />

      {/* Modals */}
      <BookingQuickModal
        visible={showBookingModal}
        bookingFilters={searchState.bookingFilters}
        colorScheme={colorScheme}
        onClose={() => setShowBookingModal(false)}
        onApply={(filters) => {
          actions.updateBookingFilters(filters);
          setShowBookingModal(false);
        }}
      />

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

      {/* --- NEW: Guest prompt modal is added to the layout --- */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onConfirm={handleConfirmGuestPrompt}
      />
    </SafeAreaView>
  );
}