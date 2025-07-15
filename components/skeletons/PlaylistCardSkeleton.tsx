import React from "react";
import SkeletonContent from "react-native-skeleton-content";
import { View } from "react-native";

const PlaylistCardSkeleton = () => {
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: "#fff",
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <SkeletonContent
        containerStyle={{ width: "100%" }}
        isLoading={true}
        layout={[
          {
            key: "image",
            width: "100%",
            height: 120,
            borderRadius: 8,
            marginBottom: 12,
          },
          { key: "title", width: "80%", height: 18, marginBottom: 6 },
          { key: "subtitle", width: "60%", height: 14 },
        ]}
      />
    </View>
  );
};

export default PlaylistCardSkeleton;
