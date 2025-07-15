import React from "react";
import { View, ScrollView } from "react-native";
import SkeletonPlaceholder from "./SkeletonPlaceholder";
import { SafeAreaView } from "react-native-safe-area-context";
import BookingCardSkeleton from "./BookingCardSkeleton";

const BookingsScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View style={{ padding: 16, marginBottom: 16 }}>
        <SkeletonPlaceholder
          width="60%"
          height={28}
          style={{ marginBottom: 8 }}
        />
        <SkeletonPlaceholder width="80%" height={18} />
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: "#eee",
          marginBottom: 16,
        }}
      >
        <SkeletonPlaceholder width="50%" height={50} />
        <SkeletonPlaceholder width="50%" height={50} />
      </View>

      {/* Booking Cards */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {[...Array(3)].map((_, index) => (
          <BookingCardSkeleton key={index} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingsScreenSkeleton;
