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
import { RestaurantCard } from "@/components/home/RestaurantCard";
import { SpecialOfferCard } from "@/components/home/SpecialOfferCard";
import { CuisineCategory } from "@/components/home/CuisineCategory";
import { SectionHeader } from "@/components/home/SectionHeader";
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
        className="absolute top-0 left-0 right-0 z-10 bg-background border-b border-border/20"
        onLayout={(event) => {
          setTotalHeaderHeight(event.nativeEvent.layout.height);
        }}
        style={{
          paddingTop: insets.top,
          transform: [{ translateY: headerTranslateY }],
        }}
      >
        <Animated.View
          onLayout={(event) => {
            setCollapsibleHeaderHeight(event.nativeEvent.layout.height);
          }}
          style={{ opacity: greetingOpacity }}
        >
          <View className="flex-row items-center justify-between px-4 pt-2">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                Hello {profile?.full_name?.split(" ")[0] || "there"}{" "}
                <Text className="text-2xl">👋</Text>
              </Text>
            </View>

            {/* Fixed Profile Picture - Now uses handleProfilePress from hook */}
            <Pressable
              onPress={()=> router.push('/(protected)/profile')}
              className="ml-3 p-1" // Added padding for better touch target
              style={({ pressed }) => ({ 
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }] // Added scale animation
              })}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increased touch area
            >
              <View className="relative">
                <Image
                  source={
                    profile?.avatar_url
                      ? { uri: profile.avatar_url }
                      : require("@/assets/default-avatar.jpeg")
                  }
                  className="w-10 h-10 rounded-full border-2 border-primary/20"
                  contentFit="cover"
                />
                {/* Online status indicator */}
                <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
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
                  params: { id: offer.restaurant.id, highlightOfferId: offer.id },
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