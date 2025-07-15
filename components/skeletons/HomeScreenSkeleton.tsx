import React from "react";
import { View, ScrollView } from "react-native";
import CuisineCategorySkeleton from "./CuisineCategorySkeleton";
import SpecialOfferCardSkeleton from "./SpecialOfferCardSkeleton";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton";
import { SectionHeader } from "../ui/section-header";
import { SafeAreaView } from "react-native-safe-area-context";

const HomeScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-6 mt-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pl-4"
          >
            <View className="flex-row gap-3 pr-4">
              {[...Array(5)].map((_, index) => (
                <CuisineCategorySkeleton key={index} />
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="mb-6">
          <SectionHeader
            title="Special Offers"
            subtitle="Limited time deals"
            actionLabel="View All"
            onAction={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {[...Array(3)].map((_, index) => (
              <SpecialOfferCardSkeleton key={index} />
            ))}
          </ScrollView>
        </View>

        <View className="mb-6">
          <SectionHeader
            title="Featured This Week"
            subtitle="Hand-picked restaurants just for you"
            actionLabel="See All"
            onAction={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {[...Array(3)].map((_, index) => (
              <RestaurantCardSkeleton key={index} />
            ))}
          </ScrollView>
        </View>

        <View className="mb-6">
          <SectionHeader
            title="New to the Platform"
            subtitle="Recently added restaurants"
            actionLabel="Explore"
            onAction={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {[...Array(3)].map((_, index) => (
              <RestaurantCardSkeleton key={index} />
            ))}
          </ScrollView>
        </View>

        <View className="mb-6">
          <SectionHeader
            title="Top Rated"
            subtitle="Highest rated by diners"
            actionLabel="View All"
            onAction={() => {}}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {[...Array(3)].map((_, index) => (
              <RestaurantCardSkeleton key={index} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreenSkeleton;
