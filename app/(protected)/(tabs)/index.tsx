import React from "react";
import {
  ScrollView,
  View,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useColorScheme } from "@/lib/useColorScheme";
import { Muted } from "@/components/ui/typography";
import { RestaurantCard } from "@/components/home/RestaurantCard";
import { SpecialOfferCard } from "@/components/home/SpecialOfferCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/home/SectionHeader";
import { LoyaltyWidget } from "@/components/home/LoyaltyWidget";
import { LocationHeader } from "@/components/home/LocationHeader";
import { useHomeScreenLogic } from "@/hooks/useHomeScreenLogic";
import { CUISINE_CATEGORIES } from "@/constants/homeScreenData";

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();

  // Use custom hook for all business logic
  const {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    specialOffers,
    location,
    refreshing,
    loading,
    profile,
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleCuisinePress,
    handleOfferPress,
    handleOffersPress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
    getGreeting,
  } = useHomeScreenLogic();

  // Loading State Component
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator
          size="large"
          color={colorScheme === "dark" ? "#fff" : "#000"}
        />
        <Muted className="mt-4">Loading your personalized experience...</Muted>
      </View>
    );
  }

  // Main Render
  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colorScheme === "dark" ? "#fff" : "#000"}
        />
      }
    >
      {/* Header Section with Location */}
      <LocationHeader
        userName={profile?.full_name?.split(" ")[0]}
        location={location}
        onLocationPress={handleLocationPress}
        getGreeting={getGreeting}
      />

      <View className="mb-6">
        <SectionHeader
          title="Explore Cuisines"
          subtitle="What are you craving today?"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="pl-4"
        >
          <View className="flex-row gap-3 pr-4">
            {CUISINE_CATEGORIES.map((cuisine) => (
              <CuisineCategory
                key={cuisine.id}
                cuisine={cuisine}
                onPress={handleCuisinePress}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Special Offers Banner */}
      {specialOffers.length > 0 && (
        <View className="mb-6">
          <SectionHeader
            title="Special Offers"
            subtitle="Limited time deals"
            actionLabel="View All"
            onAction={handleOffersPress}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {specialOffers.map((offer) => (
              <SpecialOfferCard
                key={offer.id}
                offer={offer}
                onPress={handleOfferPress}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Featured Restaurants */}
      {featuredRestaurants.length > 0 && (
        <View className="mb-6">
          <SectionHeader
            title="Featured This Week"
            subtitle="Hand-picked restaurants just for you"
            actionLabel="See All"
            onAction={handleSearchPress}
          />
          <FlatList
            horizontal
            data={featuredRestaurants}
            renderItem={({ item }) => (
              <RestaurantCard
                item={item}
                variant="featured"
                onPress={handleRestaurantPress}
              />
            )}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
      )}

      {/* New Restaurants */}
      {newRestaurants.length > 0 && (
        <View className="mb-6">
          <SectionHeader
            title="New to the Platform"
            subtitle="Recently added restaurants"
            actionLabel="Explore"
            onAction={() => handleSearchWithParams({ sortBy: "newest" })}
          />
          <FlatList
            horizontal
            data={newRestaurants}
            renderItem={({ item }) => (
              <RestaurantCard
                item={item}
                variant="compact"
                onPress={handleRestaurantPress}
              />
            )}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
      )}

      {/* Top Rated */}
      {topRatedRestaurants.length > 0 && (
        <View className="mb-6">
          <SectionHeader
            title="Top Rated"
            subtitle="Highest rated by diners"
            actionLabel="View All"
            onAction={() => handleSearchWithParams({ sortBy: "rating" })}
          />
          <FlatList
            horizontal
            data={topRatedRestaurants}
            renderItem={({ item }) => (
              <RestaurantCard
                item={item}
                variant="compact"
                onPress={handleRestaurantPress}
              />
            )}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        </View>
      )}

      {/* Loyalty Points Widget */}
      <LoyaltyWidget
        loyaltyPoints={profile?.loyalty_points || 0}
        onPress={handleProfilePress}
        colorScheme={colorScheme}
      />
    </ScrollView>
  );
}
