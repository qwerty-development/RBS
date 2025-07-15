import React, { useRef, useState } from "react";
import {
  Animated,
  View,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { Muted } from "@/components/ui/typography";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { SpecialOfferCard } from "@/components/home/SpecialOfferCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/ui/section-header";
import { LoyaltyWidget } from "@/components/home/LoyaltyWidget";
import { LocationHeader } from "@/components/home/LocationHeader";
import { HomeHeader } from "@/components/home/HomeHeader";
import { useHomeScreenLogic } from "@/hooks/useHomeScreenLogic";
import { useOffers } from "@/hooks/useOffers";
import { CUISINE_CATEGORIES } from "@/constants/homeScreenData";
import { SpecialOffersCarousel } from "@/components/home/SpecialOffersCarousel";
import { SpecialOfferBannerCarousel } from "@/components/home/SpecialOfferBannerCarousel";
import HomeScreenSkeleton from "@/components/skeletons/HomeScreenSkeleton";

// Global ref for scroll to top functionality
export const homeScrollRef = { current: null as any };

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  const {
    featuredRestaurants,
    newRestaurants,
    topRatedRestaurants,
    location,
    refreshing,
    loading,
    profile,
    handleRefresh,
    handleLocationPress,
    handleRestaurantPress,
    handleCuisinePress,
    handleSearchPress,
    handleSearchWithParams,
    handleProfilePress,
  } = useHomeScreenLogic();

  const { offers: specialOffers, loading: offersLoading } = useOffers();

  const scrollY = useRef(new Animated.Value(0)).current;
  const [totalHeaderHeight, setTotalHeaderHeight] = useState(0);
  const [collapsibleHeaderHeight, setCollapsibleHeaderHeight] = useState(0);

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, collapsibleHeaderHeight],
    outputRange: [0, -collapsibleHeaderHeight],
    extrapolate: "clamp",
  });

  const greetingOpacity = scrollY.interpolate({
    inputRange: [0, collapsibleHeaderHeight / 2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  if (loading || offersLoading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <View className="flex-1 bg-background">
      <HomeHeader
        profile={profile}
        location={location}
        headerTranslateY={headerTranslateY}
        greetingOpacity={greetingOpacity}
        setTotalHeaderHeight={setTotalHeaderHeight}
        setCollapsibleHeaderHeight={setCollapsibleHeaderHeight}
        onLocationPress={handleLocationPress}
      />

      <Animated.ScrollView
        ref={(ref) => {
          homeScrollRef.current = ref;
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
            progressViewOffset={totalHeaderHeight}
          />
        }
      >
        <View style={{ height: totalHeaderHeight }} />

        <View className="mb-6 mt-4">
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

        {/* Special Offer Banners - Large banners for offers with custom images */}
        <SpecialOfferBannerCarousel offers={specialOffers} />

        {/* {specialOffers.length > 0 && (
          <View className="mb-6">
            <SectionHeader
              title="Special Offers"
              subtitle="Limited time deals"
              actionLabel="View All"
              onAction={() => router.push("/offers")}
            />

            <SpecialOffersCarousel
              offers={specialOffers}
              onPress={(offer) => {
                router.push({
                  pathname: "/restaurant/[id]",
                  params: {
                    id: offer.restaurant.id,
                    highlightOfferId: offer.id,
                  },
                });
              }}
            />
          </View>
        )} */}

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

        <LoyaltyWidget
          loyaltyPoints={profile?.loyalty_points || 0}
          onPress={handleProfilePress}
          colorScheme={colorScheme}
        />
        <View className="h-4" />
      </Animated.ScrollView>
    </View>
  );
}
