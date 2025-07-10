
import React from 'react';
import SkeletonContent from 'react-native-skeleton-content';
import { View } from 'react-native';

const FavoritesGridCardSkeleton = () => {
  return (
    <View style={{ flex: 1, margin: 8 }}>
      <SkeletonContent
        containerStyle={{ width: '100%' }}
        isLoading={true}
        layout={[
          { key: 'image', width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
          { key: 'title', width: '90%', height: 18, marginBottom: 4 },
          { key: 'subtitle', width: '70%', height: 14 },
        ]}
      />
    </View>
  );
};

export default FavoritesGridCardSkeleton;
