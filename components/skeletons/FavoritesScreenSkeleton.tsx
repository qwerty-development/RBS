import React from 'react';
import { View, ScrollView } from 'react-native';
import FavoritesGridCardSkeleton from './FavoritesGridCardSkeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkeletonPlaceholder from './SkeletonPlaceholder';

const FavoritesScreenSkeleton = () => {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="p-4">
        <SkeletonPlaceholder width="50%" height={28} />
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-4">
        <SkeletonPlaceholder width={100} height={36} style={{ marginRight: 12 }} />
        <SkeletonPlaceholder width={100} height={36} />
      </View>

      {/* Filter Button */}
      <View className="px-4 mb-4">
        <SkeletonPlaceholder width={80} height={32} />
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8 }}>
        {[...Array(3)].map((_, rowIndex) => (
          <View key={rowIndex} className="flex-row">
            <FavoritesGridCardSkeleton />
            <FavoritesGridCardSkeleton />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

export default FavoritesScreenSkeleton;