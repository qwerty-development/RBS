import React from "react";
import { View } from "react-native";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";

// Test data to show the location display
const mockRestaurant = {
  id: "test-1",
  name: "Sakura Japanese Restaurant",
  address: "123 Main Street, Downtown",
  cuisine_type: "Japanese",
  average_rating: 4.5,
  total_reviews: 128,
  price_range: 3,
  main_image_url: "https://example.com/sakura-image.jpg",
  featured: true,
  // Add other required fields from the Database type
  description: "Authentic Japanese cuisine",
  location: null, // PostGIS field
  opening_time: "11:00:00",
  closing_time: "22:00:00",
  booking_policy: "request" as const,
  phone_number: "+1234567890",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export default function TestRestaurantCardLocation() {
  return (
    <View style={{ padding: 16, backgroundColor: "#f5f5f5" }}>
      {/* Test compact variant */}
      <RestaurantCard
        restaurant={mockRestaurant}
        variant="compact"
        showFavorite={true}
        showAddToPlaylistButton={true}
      />

      <View style={{ height: 20 }} />

      {/* Test featured variant */}
      <RestaurantCard
        restaurant={mockRestaurant}
        variant="featured"
        showFavorite={true}
        showAddToPlaylistButton={true}
      />

      <View style={{ height: 20 }} />

      {/* Test horizontal variant */}
      <RestaurantCard
        restaurant={mockRestaurant}
        variant="horizontal"
        showFavorite={true}
        showAddToPlaylistButton={true}
      />
    </View>
  );
}
