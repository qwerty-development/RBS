// app/(protected)/waiting-list.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Filter, ChevronDown } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { WaitingListCard } from "@/components/waiting-list/WaitingListCard";
import { useAuth } from "@/context/supabase-provider";
import { useWaitingListStore } from "@/stores";

// Filter options
const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'notified', label: 'Available' },
] as const;

type FilterValue = typeof FILTER_OPTIONS[number]['value'];

export default function WaitingListScreen() {
  const { profile } = useAuth();
  const {
    waitingList,
    isLoading,
    error,
    fetchWaitingList,
    removeWaitingListEntry,
  } = useWaitingListStore();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch waiting list on screen focus
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        fetchWaitingList(profile.id);
      }
    }, [profile?.id, fetchWaitingList])
  );

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    if (!profile?.id) return;
    
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await fetchWaitingList(profile.id);
    } finally {
      setRefreshing(false);
    }
  }, [profile?.id, fetchWaitingList]);

  // Filter waiting list entries
  const filteredEntries = waitingList.filter(entry => {
    if (filter === 'all') return true;
    if (filter === 'active') return entry.status === 'active';
    if (filter === 'notified') return entry.status === 'notified';
    return true;
  });

  // Handle navigation to restaurant
  const handleNavigateToRestaurant = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };

  // Handle entry cancellation
  const handleCancelEntry = (entryId: string) => {
    removeWaitingListEntry(entryId);
  };

  // Toggle filters
  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Apply filter
  const handleFilterSelect = (filterValue: FilterValue) => {
    setFilter(filterValue);
    setShowFilters(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Get stats for different statuses
  const activeCount = waitingList.filter(entry => entry.status === 'active').length;
  const notifiedCount = waitingList.filter(entry => entry.status === 'notified').length;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-2 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <H1 className="text-2xl font-bold">Waiting List</H1>
            <Text className="text-muted-foreground">
              {waitingList.length === 0 
                ? "No waiting list entries" 
                : `${waitingList.length} ${waitingList.length === 1 ? 'entry' : 'entries'}`
              }
              {activeCount > 0 && ` • ${activeCount} active`}
              {notifiedCount > 0 && ` • ${notifiedCount} available`}
            </Text>
          </View>
          
          {/* Filter Button */}
          {waitingList.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onPress={handleToggleFilters}
              className="flex-row items-center gap-2"
            >
              <Filter size={16} />
              <Text className="text-sm">{FILTER_OPTIONS.find(f => f.value === filter)?.label}</Text>
              <ChevronDown size={16} />
            </Button>
          )}
        </View>

        {/* Filter Options */}
        {showFilters && (
          <View className="mt-3 flex-row gap-2">
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                onPress={() => handleFilterSelect(option.value)}
                className="px-3"
              >
                <Text className={`text-sm ${filter === option.value ? 'text-white' : 'text-foreground'}`}>
                  {option.label}
                </Text>
              </Button>
            ))}
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3b82f6"]}
            tintColor="#3b82f6"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {isLoading && !refreshing && waitingList.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="text-muted-foreground mt-4">Loading waiting list...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
            <Text className="text-red-600 dark:text-red-400 font-medium mb-2">
              Unable to load waiting list
            </Text>
            <Text className="text-red-600 dark:text-red-400 text-sm mb-3">
              {error}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onPress={() => profile?.id && fetchWaitingList(profile.id)}
              className="self-start"
            >
              <Text>Try Again</Text>
            </Button>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredEntries.length === 0 && waitingList.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-20 h-20 bg-muted rounded-full items-center justify-center mb-4">
              <Clock size={32} color="#6b7280" />
            </View>
            <Text className="text-xl font-semibold mb-2">No Waiting List Entries</Text>
            <Text className="text-muted-foreground text-center mb-6 max-w-xs">
              When restaurants are fully booked, you can join their waiting list to get notified when tables become available.
            </Text>
            <Button
              onPress={() => router.push("/search")}
              className="px-6"
            >
              <Text className="text-white font-medium">Find Restaurants</Text>
            </Button>
          </View>
        )}

        {/* Filtered Empty State */}
        {!isLoading && !error && filteredEntries.length === 0 && waitingList.length > 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <View className="w-20 h-20 bg-muted rounded-full items-center justify-center mb-4">
              <Filter size={32} color="#6b7280" />
            </View>
            <Text className="text-xl font-semibold mb-2">No {FILTER_OPTIONS.find(f => f.value === filter)?.label} Entries</Text>
            <Text className="text-muted-foreground text-center mb-6 max-w-xs">
              Try changing the filter to see more entries.
            </Text>
            <Button
              variant="outline"
              onPress={() => handleFilterSelect('all')}
            >
              <Text>Show All Entries</Text>
            </Button>
          </View>
        )}

        {/* Waiting List Entries */}
        {filteredEntries.map((entry) => (
          <WaitingListCard
            key={entry.id}
            entry={entry}
            onNavigateToRestaurant={handleNavigateToRestaurant}
            onCancel={handleCancelEntry}
            className="mb-4"
          />
        ))}

        {/* Bottom Spacing */}
        <View className="h-6" />
      </ScrollView>

      {/* Stats Banner */}
      {notifiedCount > 0 && (
        <View className="bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800 px-4 py-3">
          <Text className="text-green-800 dark:text-green-200 font-medium text-center">
            🎉 {notifiedCount} table{notifiedCount === 1 ? ' is' : 's are'} now available!
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}