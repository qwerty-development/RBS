import React from "react";
import { View, ScrollView, Pressable } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "react-native";

const RestaurantDetailsScreenSkeleton = () => {
  const router = useRouter();
  
  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header - Keep visible during loading */}
      <View className="absolute top-0 left-0 right-0 z-50">
        <SafeAreaView edges={["top"]}>
          <View className="p-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
      
      {/* Favorite, Playlist, and Share Button placeholders */}
      <View className="absolute top-20 right-4 flex-row gap-3 z-50">
        <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"></View>
        <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"></View>
        <View className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"></View>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={{ height: 250 }}>
          <SkeletonPlaceholder width="100%" height="100%" />
        </View>

        {/* Quick Actions */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          }}
        >
          <SkeletonPlaceholder width={60} height={40} />
          <SkeletonPlaceholder width={60} height={40} />
          <SkeletonPlaceholder width={60} height={40} />
          <SkeletonPlaceholder width={60} height={40} />
        </View>

        {/* Header Info */}
        <View style={{ padding: 16 }}>
          <SkeletonPlaceholder
            width="80%"
            height={28}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder
            width="50%"
            height={20}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder width="100%" height={30} />
        </View>

        {/* About Section */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder
            width="40%"
            height={22}
            style={{ marginBottom: 12 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={16}
            style={{ marginBottom: 6 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={16}
            style={{ marginBottom: 6 }}
          />
          <SkeletonPlaceholder width="80%" height={16} />
        </View>

        {/* Menu Section */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder width="100%" height={80} borderRadius={8} />
        </View>

        {/* Location Map */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder width="100%" height={200} borderRadius={8} />
        </View>

        {/* Reviews */}
        <View
          style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#eee" }}
        >
          <SkeletonPlaceholder
            width="40%"
            height={22}
            style={{ marginBottom: 16 }}
          />
          <SkeletonPlaceholder
            width="100%"
            height={60}
            style={{ marginBottom: 12 }}
          />
          <SkeletonPlaceholder width="100%" height={60} />
        </View>
      </ScrollView>
    </View>
  );
};

export default RestaurantDetailsScreenSkeleton;
