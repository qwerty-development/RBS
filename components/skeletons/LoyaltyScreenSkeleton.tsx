import React from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonPlaceholder from "./SkeletonPlaceholder";

const RewardCardSkeleton = () => (
  <View
    style={{
      marginBottom: 12,
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FFFFFF",
    }}
  >
    {/* Header */}
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <SkeletonPlaceholder width="70%" height={20} borderRadius={4} />
      <SkeletonPlaceholder width={60} height={20} borderRadius={4} />
    </View>

    {/* Description */}
    <SkeletonPlaceholder
      width="90%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 12 }}
    />
    <SkeletonPlaceholder
      width="60%"
      height={16}
      borderRadius={4}
      style={{ marginTop: 8 }}
    />

    {/* Tags */}
    <View style={{ flexDirection: "row", marginTop: 16 }}>
      <SkeletonPlaceholder width={100} height={24} borderRadius={12} />
      <SkeletonPlaceholder
        width={80}
        height={24}
        borderRadius={12}
        style={{ marginLeft: 8 }}
      />
    </View>
  </View>
);

const LoyaltyScreenSkeleton = () => {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#F5F5F5" }}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#E0E0E0",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <SkeletonPlaceholder width={32} height={32} borderRadius={16} />
          <SkeletonPlaceholder
            width={150}
            height={24}
            borderRadius={4}
            style={{ marginLeft: 12 }}
          />
        </View>

        {/* Points Display */}
        <View style={{ alignItems: "center" }}>
          <SkeletonPlaceholder
            width={100}
            height={32}
            borderRadius={4}
            style={{ marginBottom: 8 }}
          />
          <SkeletonPlaceholder
            width={200}
            height={16}
            borderRadius={4}
            style={{ marginBottom: 12 }}
          />
          <SkeletonPlaceholder width="100%" height={8} borderRadius={4} />
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        <RewardCardSkeleton />
        <RewardCardSkeleton />
        <RewardCardSkeleton />
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoyaltyScreenSkeleton;
