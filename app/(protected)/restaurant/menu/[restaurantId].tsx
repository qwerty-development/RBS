// app/(protected)/restaurant/menu/[restaurantId].tsx

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Dimensions,
  SectionList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Search,
  Filter,
  X,
  Clock,
  Flame,
  Leaf,
  Wheat,
  Info,
  ChevronLeft,
  Share2,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/lib/useColorScheme";
import { useMenu } from "@/hooks/useMenu";
import { MenuItem, MenuCategory, DIETARY_TAGS } from "@/types/menu";
import { MenuScreenSkeleton } from "@/components/skeletons/MenuScreenSkeleton";
// TEMP DISABLED: Share functionality requires deeplink
// import { useShare } from "@/hooks/useShare";
// import { ShareModal } from "@/components/ui/share-modal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Dietary tag icons mapping
const DIETARY_ICONS: Record<string, any> = {
  vegetarian: Leaf,
  vegan: Leaf,
  "gluten-free": Wheat,
  spicy: Flame,
};

export default function MenuScreen() {
  const [isMounted, setIsMounted] = useState(false);
  // TEMP DISABLED: Share functionality requires deeplink
  // const [showShareModal, setShowShareModal] = useState(false);

  // TEMP DISABLED: Share functionality requires deeplink
  // const { shareRestaurantMenu } = useShare();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const router = useRouter();
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const handleBack = useCallback(() => {
    if (router.canGoBack && router.canGoBack()) {
      router.back();
      return;
    }
    if (restaurantId) {
      router.replace({
        pathname: "/restaurant/[id]",
        params: { id: restaurantId },
      });
    } else {
      router.replace("/");
    }
  }, [router, restaurantId]);
  const { colorScheme } = useColorScheme();

  const {
    categories,
    loading,
    error,
    refreshing,
    filters,
    filteredItems,
    setFilters,
    refresh,
    featuredItems,
  } = useMenu({ restaurantId: restaurantId! });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Prepare sections for SectionList
  const sections = useMemo(() => {
    if (filters.searchQuery || filters.dietary_tags.length > 0) {
      // Show filtered items in a single section when filtering
      return [
        {
          title: "Search Results",
          data: filteredItems,
        },
      ];
    }

    // Otherwise show categories
    return categories
      .filter((cat) => cat.items && cat.items.length > 0)
      .map((cat) => ({
        title: cat.name,
        data: cat.items || [],
        description: cat.description,
      }));
  }, [categories, filteredItems, filters]);

  const renderMenuItem = useCallback(
    ({ item }: { item: MenuItem }) => (
      <View className="bg-card p-4 mb-3 mx-4 rounded-lg border border-border">
        <View className="flex-row">
          {item.image_url && (
            <Image
              source={{ uri: item.image_url }}
              className="w-24 h-24 rounded-lg mr-4"
              resizeMode="cover"
            />
          )}

          <View className="flex-1">
            <View className="flex-row justify-between items-start mb-1">
              <H3 className="flex-1 mr-2">{item.name}</H3>
              <Text className="text-lg font-semibold text-primary">
                ${item.price.toFixed(2)}
              </Text>
            </View>

            {item.description && (
              <P className="text-muted-foreground mb-2 text-sm">
                {item.description}
              </P>
            )}

            <View className="flex-row flex-wrap gap-2">
              {(item.dietary_tags || []).map((tag) => {
                const Icon = DIETARY_ICONS[tag];
                return (
                  <View
                    key={tag}
                    className="flex-row items-center bg-primary/10 px-2 py-1 rounded-full"
                  >
                    {Icon && <Icon size={12} className="mr-1 text-primary" />}
                    <Text className="text-xs text-primary capitalize">
                      {tag.replace("-", " ")}
                    </Text>
                  </View>
                );
              })}

              {item.preparation_time && (
                <View className="flex-row items-center bg-muted px-2 py-1 rounded-full">
                  <Clock size={12} className="mr-1 text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">
                    {item.preparation_time} min
                  </Text>
                </View>
              )}
            </View>

            {!item.is_available && (
              <Text className="text-xs text-destructive mt-2">
                Currently unavailable
              </Text>
            )}
          </View>
        </View>
      </View>
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: any }) => (
      <View className="bg-background px-4 py-3 border-b border-border">
        <H2 className="text-lg">{section.title}</H2>
        {section.description && (
          <Muted className="text-sm mt-1">{section.description}</Muted>
        )}
      </View>
    ),
    [],
  );

  const renderFilterButton = useCallback(
    () => (
      <Pressable
        onPress={() => setShowFilters(true)}
        className="bg-primary/10 p-2 rounded-lg flex-row items-center"
      >
        <Filter size={20} className="text-primary mr-1" />
        {filters.dietary_tags.length > 0 && (
          <View className="bg-primary px-2 py-0.5 rounded-full ml-1">
            <Text className="text-xs text-primary-foreground">
              {filters.dietary_tags.length}
            </Text>
          </View>
        )}
      </Pressable>
    ),
    [filters.dietary_tags.length],
  );

  if (loading) {
    return <MenuScreenSkeleton />;
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center p-4">
        <Text className="text-destructive text-center mb-4">{error}</Text>
        <Button onPress={refresh}>
          <Text>Try Again</Text>
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header with Back + Search + Filter */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="bg-primary/10 p-2 rounded-lg flex-row items-center"
          >
            <ChevronLeft size={20} className="text-primary mr-1" />
          </Pressable>
          <View className="flex-1 bg-muted rounded-lg px-3 py-2 flex-row items-center">
            <Search size={20} className="text-muted-foreground mr-2" />
            <TextInput
              value={filters.searchQuery}
              onChangeText={(text) => setFilters({ searchQuery: text })}
              placeholder="Search menu items..."
              placeholderTextColor="#999"
              className="flex-1 text-foreground"
            />
          </View>
          {renderFilterButton()}
          {/* TEMP DISABLED: Share functionality requires deeplink */}
          {/* <Pressable
            onPress={() => setShowShareModal(true)}
            className="bg-primary/10 p-2 rounded-lg flex-row items-center"
          >
            <Share2 size={20} className="text-primary mr-1" />
          </Pressable> */}
        </View>
      </View>

      {/* Featured Items (optional) */}
      {featuredItems.length > 0 && !filters.searchQuery && (
        <View className="mb-4">
          <H2 className="px-4 py-2">Featured Items</H2>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={featuredItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="w-48 mr-3 first:ml-4 last:mr-4">
                <Image
                  source={{
                    uri: item.image_url || "https://via.placeholder.com/200",
                  }}
                  className="w-full h-32 rounded-lg mb-2"
                  resizeMode="cover"
                />
                <Text className="font-semibold" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-primary font-medium">
                  ${item.price.toFixed(2)}
                </Text>
              </View>
            )}
          />
        </View>
      )}

      {/* Menu Items */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderMenuItem}
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        stickySectionHeadersEnabled={true}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-20 px-4">
            <Text className="text-6xl mb-4">😞</Text>
            <Text className="text-center text-lg font-medium text-foreground mb-2">
              Oops restaurant did not upload menu
            </Text>
            <Text className="text-center text-muted-foreground">
              Check back later or contact the restaurant
            </Text>
          </View>
        )}
      />

      {/* Filters Modal */}
      {showFilters && (
        <FilterModal
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={filters}
          onApplyFilters={setFilters}
        />
      )}

      {/* TEMP DISABLED: Share Modal requires deeplink functionality */}
      {/* <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Menu"
        description="Check out this restaurant menu!"
        shareOptions={{
          title: "Restaurant Menu",
          message: "Check out this restaurant menu!",
        }}
        showNativeShare={true}
        showCopyLink={true}
        customActions={[
          {
            id: "share-menu",
            title: "Share Menu",
            description: "Share restaurant menu with friends",
            icon: Share2,
            onPress: async () => {
              await shareRestaurantMenu(restaurantId!);
            },
          },
        ]}
      /> */}
    </SafeAreaView>
  );
}

// Filter Modal Component
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: any;
  onApplyFilters: (filters: any) => void;
}

function FilterModal({
  visible,
  onClose,
  filters,
  onApplyFilters,
}: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const dietaryOptions = [
    { value: DIETARY_TAGS.VEGETARIAN, label: "Vegetarian" },
    { value: DIETARY_TAGS.VEGAN, label: "Vegan" },
    { value: DIETARY_TAGS.GLUTEN_FREE, label: "Gluten Free" },
    { value: DIETARY_TAGS.DAIRY_FREE, label: "Dairy Free" },
    { value: DIETARY_TAGS.HALAL, label: "Halal" },
    { value: DIETARY_TAGS.SPICY, label: "Spicy" },
  ];

  const toggleDietaryTag = (tag: string) => {
    setLocalFilters((prev: any) => ({
      ...prev,
      dietary_tags: prev.dietary_tags.includes(tag)
        ? prev.dietary_tags.filter((t: string) => t !== tag)
        : [...prev.dietary_tags, tag],
    }));
  };

  const applyFilters = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const clearFilters = () => {
    const clearedFilters = {
      dietary_tags: [],
      maxPrice: null,
      searchQuery: filters.searchQuery,
      showUnavailable: false,
    };
    setLocalFilters(clearedFilters);
    onApplyFilters(clearedFilters);
  };

  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/50 z-50">
      <Pressable className="flex-1" onPress={onClose} />
      <View className="bg-card rounded-t-3xl p-6 pb-8">
        <View className="flex-row justify-between items-center mb-6">
          <H2>Filters</H2>
          <Pressable onPress={onClose}>
            <X size={24} className="text-muted-foreground" />
          </Pressable>
        </View>

        <View className="mb-6">
          <H3 className="mb-3">Dietary Preferences</H3>
          <View className="flex-row flex-wrap gap-2">
            {dietaryOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => toggleDietaryTag(option.value)}
                className={`px-4 py-2 rounded-full border ${
                  localFilters.dietary_tags.includes(option.value)
                    ? "bg-primary border-primary"
                    : "bg-card border-border"
                }`}
              >
                <Text
                  className={
                    localFilters.dietary_tags.includes(option.value)
                      ? "text-primary-foreground"
                      : "text-foreground"
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="flex-row gap-3">
          <Button variant="outline" onPress={clearFilters} className="flex-1">
            <Text>Clear All</Text>
          </Button>
          <Button onPress={applyFilters} className="flex-1">
            <Text>Apply Filters</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
