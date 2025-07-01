import React, { useRef, useState } from "react";
import {
  Animated,
  View,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/lib/useColorScheme";
import { Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { RestaurantCard } from "@/components/restaurant/RestaurantCard";
import { SpecialOfferCard } from "@/components/home/SpecialOfferCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/ui/section-header";
import { LoyaltyWidget } from "@/components/home/LoyaltyWidget";
import { LocationHeader } from "@/components/home/LocationHeader";
import { useHomeScreenLogic } from "@/hooks/useHomeScreenLogic";
import { useOffers } from "@/hooks/useOffers";
import { CUISINE_CATEGORIES } from "@/constants/homeScreenData";
import { SpecialOffersCarousel } from "@/components/home/SpecialOffersCarousel";

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Muted className="mt-4">
            Loading your personalized experience...
          </Muted>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Animated.View
        className="absolute top-0 left-0 right-0 bg-background border-b border-border/20"
        onLayout={(event) => {
          setTotalHeaderHeight(event.nativeEvent.layout.height);
        }}
        style={{
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
          zIndex: 100, // Lower z-index than profile picture
          elevation: 100, // Android elevation
        }}
        // Ensure child elements can receive touch events
        pointerEvents="box-none"
      >
        <Animated.View
          onLayout={(event) => {
            setCollapsibleHeaderHeight(event.nativeEvent.layout.height);
          }}
          style={{ opacity: greetingOpacity }}
          // Allow touch events to pass through to child elements
          pointerEvents="box-none"
        >
          <View
            className="flex-row items-center justify-between px-4 pt-2"
            // Allow touch events for child elements
            pointerEvents="box-none"
          >
            <View
              className="flex-1"
              // Prevent this container from capturing touch events meant for the profile picture
              pointerEvents="none"
            >
              <Text className="text-2xl font-bold text-foreground">
                Hello {profile?.full_name?.split(" ")[0] || "there"}{" "}
                <Text className="text-2xl">👋</Text>
              </Text>
            </View>

            <Pressable
              onPress={() => {
                router.push("/profile");
              }}
              style={({ pressed }) => ({
                marginLeft: 12,
                padding: 4,
                zIndex: 999,
                elevation: 999,
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              pointerEvents="box-only"
            >
              <View
                style={{
                  position: "relative",
                  zIndex: 999,
                  elevation: 999,
                }}
              >
                <Image
                  source={
                    profile?.avatar_url
                      ? { uri: profile.avatar_url }
                      : require("@/assets/default-avatar.jpeg")
                  }
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor:
                      colorScheme === "dark"
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.2)",
                  }}
                  contentFit="cover"
                />
                {/* Online status indicator */}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    backgroundColor: "#22c55e",
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: colorScheme === "dark" ? "#000" : "#fff",
                    zIndex: 1000,
                    elevation: 1000,
                  }}
                />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <View className="-mt-12">
          <LocationHeader
            location={location}
            onLocationPress={handleLocationPress}
            getGreeting={function (): string {
              throw new Error("Function not implemented.");
            }}
          />
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
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

        {specialOffers.length > 0 && (
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
        )}

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
