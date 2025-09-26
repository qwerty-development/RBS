import React from "react";
import SkeletonPlaceholder from "react-native-skeleton-placeholder";

const PlaylistCardSkeleton = () => {
  return (
    <SkeletonPlaceholder>
      <SkeletonPlaceholder.Item
        width="100%"
        paddingHorizontal={16}
        paddingVertical={16}
        borderRadius={8}
        marginBottom={16}
      >
        <SkeletonPlaceholder.Item
          width="100%"
          height={120}
          borderRadius={8}
          marginBottom={12}
        />
        <SkeletonPlaceholder.Item
          width="80%"
          height={18}
          marginBottom={6}
        />
        <SkeletonPlaceholder.Item
          width="60%"
          height={14}
        />
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder>
  );
};

export default PlaylistCardSkeleton;
