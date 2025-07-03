// components/search/SearchResultsHeader.tsx
import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import type { BookingFilters } from "@/types/search";

interface SearchResultsHeaderProps {
  restaurantCount: number;
  loading: boolean;
  bookingFilters: BookingFilters;
}

export const SearchResultsHeader = React.memo(
  ({ restaurantCount, loading, bookingFilters }: SearchResultsHeaderProps) => {
    const { location } = useLocationWithDistance();

    const getLocationText = () => {
      if (!location) return "";
      
      if (location.district && location.city && location.district !== location.city) {
        return ` in ${location.district}, ${location.city}`;
      }
      return ` in ${location.city}`;
    };

    return (
      <View className="px-4 py-2 border-b border-border">
        <Text className="text-sm text-muted-foreground">
          {loading ? (
            "Searching restaurants..."
          ) : (
            <>
              {restaurantCount} restaurant{restaurantCount !== 1 ? 's' : ''} found{getLocationText()}
              {bookingFilters.availableOnly
                ? ` • Showing only available for ${bookingFilters.time}`
                : ` • Showing availability for ${
                    bookingFilters.date.toDateString() ===
                    new Date().toDateString()
                      ? "today"
                      : bookingFilters.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                  } at ${bookingFilters.time}`}
            </>
          )}
        </Text>
      </View>
    );
  }
);