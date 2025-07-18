import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";

const RestaurantDetailsScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
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
    </SafeAreaView>
  );
};

export default RestaurantDetailsScreenSkeleton;
