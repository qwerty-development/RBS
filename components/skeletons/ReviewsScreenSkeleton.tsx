import React from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Card } from "@/components/ui/card";

const SkeletonPlaceholder = ({ style }: { style?: any }) => (
  <View style={[styles.skeleton, style]} />
);

const ReviewCardSkeleton = () => (
  <Card style={styles.reviewCard}>
    <View style={styles.ratingContainer}>
      <SkeletonPlaceholder style={styles.star} />
      <SkeletonPlaceholder style={styles.star} />
      <SkeletonPlaceholder style={styles.star} />
      <SkeletonPlaceholder style={styles.star} />
      <SkeletonPlaceholder style={styles.star} />
    </View>
    <SkeletonPlaceholder style={styles.commentLine1} />
    <SkeletonPlaceholder style={styles.commentLine2} />
    <SkeletonPlaceholder style={styles.date} />
  </Card>
);

export function ReviewsScreenSkeleton() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <SkeletonPlaceholder style={styles.backButton} />
        <SkeletonPlaceholder style={styles.headerTitle} />
      </View>

      {/* List Skeleton */}
      <View style={styles.content}>
        {Array.from({ length: 5 }).map((_, index) => (
          <ReviewCardSkeleton key={index} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 16,
  },
  headerTitle: {
    width: "40%",
    height: 24,
  },
  content: {
    padding: 16,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  star: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  commentLine1: {
    width: "90%",
    height: 16,
    marginBottom: 8,
  },
  commentLine2: {
    width: "60%",
    height: 16,
    marginBottom: 12,
  },
  date: {
    width: "30%",
    height: 12,
  },
});
