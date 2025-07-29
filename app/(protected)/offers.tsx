// app/(protected)/offers.tsx
import React from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  Dimensions,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Tag,
  Clock,
  Calendar,
  Users,
  Percent,
  ChevronRight,
  Filter,
  Star,
  MapPin,
  Info,
  Sparkles,
  TrendingUp,
  Gift,
  X,
  Share2,
  CheckCircle,
  QrCode,
  ExternalLink,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { useColorScheme } from "@/lib/useColorScheme";
import { useOffers } from "@/hooks/useOffers";
import OffersScreenSkeleton from "@/components/skeletons/OffersScreenSkeleton";
import { getRefreshControlColor } from "@/lib/utils";
import { OptimizedList } from "@/components/ui/optimized-list";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SpecialOffersScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  // Use the useOffers hook for all offer logic
  const {
    offers,
    loading,
    error,
    selectedCategory,
    filters,
    claimOffer,
    useOffer,
    updateFilters,
    updateCategory,
    OFFER_CATEGORIES,
    fetchOffers,
  } = useOffers();

  // UI state
  const [processingOfferId, setProcessingOfferId] = React.useState<
    string | null
  >(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedOffer, setSelectedOffer] = React.useState<any | null>(null);
  const [showOfferDetails, setShowOfferDetails] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // Share offer
  const shareOffer = React.useCallback(async (offer: any) => {
    try {
      const message = `Check out this ${offer.discount_percentage}% off deal at ${offer.restaurant.name}! 🎉\n\n${offer.title}\n\nValid until ${new Date(offer.valid_until).toLocaleDateString()}`;
      await Share.share({
        message,
        title: `Special Offer: ${offer.title}`,
      });
    } catch (error) {
      console.error("Error sharing offer:", error);
    }
  }, []);

  // Navigate to restaurant
  const navigateToRestaurant = React.useCallback(
    (restaurantId: string, offerId?: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: {
          id: restaurantId,
          ...(offerId && { highlightOfferId: offerId }),
        },
      });
    },
    [router],
  );

  // FIXED: Book with offer - now goes through availability selection first
  const bookWithOffer = React.useCallback(
    (offer: any) => {
      // Check if offer is still valid and can be used
      if (!offer.canUse) {
        Alert.alert(
          "Offer Not Available",
          "This offer has expired or has already been used.",
          [{ text: "OK" }],
        );
        return;
      }

      // Navigate to availability selection with offer pre-selected
      router.push({
        pathname: "/booking/availability",
        params: {
          restaurantId: offer.restaurant_id,
          restaurantName: offer.restaurant.name,
          // Pass offer information to be carried through the booking flow
          preselectedOfferId: offer.id,
          offerTitle: offer.title,
          offerDiscount: offer.discount_percentage.toString(),
          redemptionCode: offer.redemptionCode || offer.id,
        },
      });
    },
    [router],
  );

  // Enhanced claim offer with better error handling
  const handleClaimOffer = React.useCallback(
    async (offer: any) => {
      if (processingOfferId === offer.id) return;

      setProcessingOfferId(offer.id);

      try {
        await claimOffer(offer.id);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );

        Alert.alert(
          "Offer Claimed! 🎉",
          `You've successfully claimed ${offer.discount_percentage}% off at ${offer.restaurant.name}. You can now use this offer when booking.`,
          [
            {
              text: "View Restaurant",
              onPress: () =>
                navigateToRestaurant(offer.restaurant_id, offer.id),
            },
            { text: "Book Now", onPress: () => bookWithOffer(offer) },
            { text: "OK", style: "cancel" },
          ],
        );
      } catch (err: any) {
        console.error("Error claiming offer:", err);
        Alert.alert(
          "Error",
          err.message || "Failed to claim offer. Please try again.",
        );
      } finally {
        setProcessingOfferId(null);
      }
    },
    [claimOffer, processingOfferId, navigateToRestaurant, bookWithOffer],
  );

  // Refresh handler
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOffers();
    setRefreshing(false);
  }, [fetchOffers]);

  // Apply filters
  const handleApplyFilters = React.useCallback(
    (newFilters: any) => {
      updateFilters(newFilters);
      setShowFilters(false);
    },
    [updateFilters],
  );

  // Enhanced offer card component
  const OfferCard = ({ offer }: { offer: any }) => {
    const handleCardPress = () => {
      if (offer.claimed) {
        setSelectedOffer(offer);
        setShowOfferDetails(true);
      } else {
        navigateToRestaurant(offer.restaurant_id, offer.id);
      }
    };

    // Get offer status for display
    const getOfferStatus = () => {
      if (offer.used) {
        return {
          component: (
            <View className="flex-row items-center bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
              <CheckCircle size={14} color="#16a34a" />
              <Text className="text-green-700 dark:text-green-300 text-sm ml-1">
                Used
              </Text>
            </View>
          ),
          canUse: false,
        };
      }

      if (offer.isExpired) {
        return {
          component: (
            <View className="flex-row items-center bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
              <Clock size={14} color="#dc2626" />
              <Text className="text-red-700 dark:text-red-300 text-sm ml-1">
                Expired
              </Text>
            </View>
          ),
          canUse: false,
        };
      }

      if (offer.claimed) {
        const daysLeft = offer.daysUntilExpiry || 0;
        return {
          component: (
            <View className="flex-row items-center bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              <Tag size={14} color="#2563eb" />
              <Text className="text-blue-700 dark:text-blue-300 text-sm ml-1">
                {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
              </Text>
            </View>
          ),
          canUse: true,
        };
      }

      return { component: null, canUse: false };
    };

    const status = getOfferStatus();

    return (
      <Pressable
        onPress={handleCardPress}
        className="bg-card border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden mb-6 shadow-lg shadow-black/5"
      >
        {/* Restaurant Image */}
        <View className="relative">
          <Image
            source={{ uri: offer.restaurant.main_image_url }}
            className="w-full h-44"
            contentFit="cover"
          />
          {/* Status overlay */}
          {status.component && (
            <View className="absolute top-3 left-3">{status.component}</View>
          )}
        </View>

        {/* Offer Details */}
        <View className="p-4">
          {/* Discount Badge - Overlapping */}
          <View className="absolute -top-8 right-4 bg-primary h-16 w-16 rounded-full items-center justify-center border-4 border-card">
            <Text className="text-primary-foreground font-extrabold text-2xl">
              {offer.discount_percentage}
            </Text>
            <Text className="text-primary-foreground font-bold text-xs -mt-1">
              %
            </Text>
          </View>

          {/* Restaurant Info */}
          <Pressable
            onPress={() => navigateToRestaurant(offer.restaurant_id)}
            className="flex-row items-center mb-3 mt-1"
          >
            <View className="flex-1">
              <Text className="font-bold text-2xl">
                {offer.restaurant.name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-sm font-medium ml-1">
                  {offer.restaurant.average_rating?.toFixed(1) || "4.5"}
                </Text>
                <Text className="text-sm text-muted-foreground ml-1">•</Text>
                <Text className="text-sm text-muted-foreground ml-1">
                  {offer.restaurant.cuisine_type}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#666" />
          </Pressable>

          <Text className="mb-2 text-lg font-semibold w-4/5">
            {offer.title}
          </Text>
          {offer.description && (
            <P className="text-sm text-muted-foreground mb-4" numberOfLines={2}>
              {offer.description}
            </P>
          )}

          {/* Metadata Chips */}
          <View className="flex-row flex-wrap mb-4">
            <View className="flex-row items-center bg-muted/50 rounded-full px-3 py-1 mr-2 mb-2">
              <Calendar
                size={14}
                color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
              />
              <Text className="text-xs text-muted-foreground ml-1.5">
                Ends {new Date(offer.valid_until).toLocaleDateString()}
              </Text>
            </View>
            {offer.minimum_party_size > 1 && (
              <View className="flex-row items-center bg-muted/50 rounded-full px-3 py-1 mr-2 mb-2">
                <Users
                  size={14}
                  color={colorScheme === "dark" ? "#a1a1aa" : "#3f3f46"}
                />
                <Text className="text-xs text-muted-foreground ml-1.5">
                  {offer.minimum_party_size}+ People
                </Text>
              </View>
            )}
            {offer.claimed && offer.redemptionCode && (
              <View className="flex-row items-center bg-blue-50 dark:bg-blue-900/30 rounded-full px-3 py-1 mr-2 mb-2">
                <QrCode size={14} color="#2563eb" />
                <Text className="text-xs text-blue-700 dark:text-blue-300 ml-1.5">
                  Code: {offer.redemptionCode.slice(-6).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View className="flex-row mt-2 gap-3">
            {!offer.claimed ? (
              <Button
                variant="default"
                onPress={(e) => {
                  e.stopPropagation();
                  handleClaimOffer(offer);
                }}
                disabled={processingOfferId === offer.id}
                className="flex-1 h-12"
              >
                {processingOfferId === offer.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Tag size={18} className="mr-2" />
                    <Text className="font-bold text-base text-white">
                      Claim Offer
                    </Text>
                  </>
                )}
              </Button>
            ) : status.canUse ? (
              <Button
                variant="default"
                onPress={(e) => {
                  e.stopPropagation();
                  bookWithOffer(offer);
                }}
                className="flex-1 h-12"
              >
                <Calendar size={18} className="mr-2" />
                <Text className="font-bold text-base text-white">
                  Book with Offer
                </Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                onPress={(e) => {
                  e.stopPropagation();
                  navigateToRestaurant(offer.restaurant_id);
                }}
                className="flex-1 h-12"
              >
                <ExternalLink size={18} className="mr-2" />
                <Text className="font-bold text-base">View Restaurant</Text>
              </Button>
            )}
            <Button
              variant="outline"
              onPress={(e) => {
                e.stopPropagation();
                shareOffer(offer);
              }}
              className="w-12 h-12"
            >
              <Share2 size={18} />
            </Button>
          </View>
        </View>
      </Pressable>
    );
  };

  // Category tabs component
  const CategoryTabs = () => (
    <View className="bg-background">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {OFFER_CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id;
          const claimedCount = offers.filter((o) => o.claimed).length;
          return (
            <Pressable
              key={category.id}
              onPress={() => {
                updateCategory(category.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className={`flex-row items-center py-3 px-4 border-b-2 ${
                isActive ? "border-primary" : "border-transparent"
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {category.label}
              </Text>
              {category.id === "claimed" && claimedCount > 0 && (
                <View className="px-2 py-0.5 rounded-full ml-2 bg-primary">
                  <Text className="text-xs font-medium text-primary-foreground">
                    {claimedCount}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  // Enhanced offer details modal
  const OfferDetailsModal = () => {
    if (!selectedOffer) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOfferDetails}
        onRequestClose={() => setShowOfferDetails(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-card rounded-t-2xl p-6"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <H3>Offer Details</H3>
              <Pressable
                onPress={() => setShowOfferDetails(false)}
                className="p-1"
              >
                <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
              </Pressable>
            </View>

            {/* Offer info */}
            <View className="mb-6">
              <Text className="font-bold text-xl mb-2">
                {selectedOffer.title}
              </Text>
              <Text className="text-muted-foreground mb-4">
                {selectedOffer.description}
              </Text>

              <View className="flex-row items-center mb-2">
                <MapPin size={16} color="#666" />
                <Text className="ml-2 font-medium">
                  {selectedOffer.restaurant.name}
                </Text>
              </View>

              <View className="flex-row items-center mb-4">
                <Percent size={16} color="#666" />
                <Text className="ml-2">
                  {selectedOffer.discount_percentage}% discount
                </Text>
              </View>

              {/* Status display */}
              <View className="mb-4">
                {selectedOffer.used ? (
                  <View className="flex-row items-center bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                    <CheckCircle size={14} color="#16a34a" />
                    <Text className="text-green-700 dark:text-green-300 text-sm ml-1">
                      Used
                    </Text>
                  </View>
                ) : selectedOffer.isExpired ? (
                  <View className="flex-row items-center bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
                    <Clock size={14} color="#dc2626" />
                    <Text className="text-red-700 dark:text-red-300 text-sm ml-1">
                      Expired
                    </Text>
                  </View>
                ) : selectedOffer.claimed ? (
                  <View className="flex-row items-center bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                    <Tag size={14} color="#2563eb" />
                    <Text className="text-blue-700 dark:text-blue-300 text-sm ml-1">
                      {selectedOffer.daysUntilExpiry === 0
                        ? "Expires today"
                        : `${selectedOffer.daysUntilExpiry}d left`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Redemption code */}
            {selectedOffer.claimed && selectedOffer.redemptionCode && (
              <View className="bg-muted/50 rounded-xl p-4 mb-6">
                <Text className="font-bold mb-2">Redemption Code</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-lg">
                    {selectedOffer.redemptionCode.toUpperCase()}
                  </Text>
                  <QrCode size={24} color="#666" />
                </View>
                <Text className="text-sm text-muted-foreground mt-2">
                  Show this code at the restaurant to redeem your offer
                </Text>
              </View>
            )}

            {/* Terms and conditions */}
            {selectedOffer.terms_conditions &&
              selectedOffer.terms_conditions.length > 0 && (
                <View className="mb-6">
                  <Text className="font-bold mb-2">Terms & Conditions</Text>
                  {selectedOffer.terms_conditions.map(
                    (term: string, index: number) => (
                      <Text
                        key={index}
                        className="text-sm text-muted-foreground mb-1"
                      >
                        • {term}
                      </Text>
                    ),
                  )}
                </View>
              )}

            {/* Action buttons */}
            <View className="flex-row gap-3">
              {selectedOffer.canUse && (
                <>
                  <Button
                    onPress={() => {
                      setShowOfferDetails(false);
                      bookWithOffer(selectedOffer);
                    }}
                    className="flex-1"
                  >
                    <Calendar size={16} className="mr-2" />
                    <Text className="text-white font-medium">Book Now</Text>
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => {
                      Alert.alert(
                        "Mark as Used",
                        "Have you used this offer at the restaurant?",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Yes, Mark as Used",
                            onPress: async () => {
                              try {
                                await useOffer(selectedOffer.id);
                                setShowOfferDetails(false);
                                await Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Success,
                                );
                              } catch (err: any) {
                                Alert.alert(
                                  "Error",
                                  err.message || "Failed to mark offer as used",
                                );
                              }
                            },
                          },
                        ],
                      );
                    }}
                    className="flex-none"
                  >
                    <CheckCircle size={16} />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onPress={() => shareOffer(selectedOffer)}
                className={selectedOffer.canUse ? "flex-none" : "flex-1"}
              >
                <Share2 size={16} />
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Filter sheet component
  const FilterSheet = ({
    isVisible,
    onClose,
    onApply,
    currentFilters,
  }: {
    isVisible: boolean;
    onClose: () => void;
    onApply: (f: any) => void;
    currentFilters: any;
  }) => {
    const [localFilters, setLocalFilters] = React.useState(currentFilters);
    const Cuisines = [
      "Italian",
      "Lebanese",
      "Japanese",
      "Indian",
      "French",
      "American",
    ];

    React.useEffect(() => {
      setLocalFilters(currentFilters);
    }, [currentFilters]);

    const toggleCuisine = (cuisine: string) => {
      setLocalFilters((prev: any) => {
        const newCuisines = new Set(prev.cuisineTypes);
        if (newCuisines.has(cuisine)) {
          newCuisines.delete(cuisine);
        } else {
          newCuisines.add(cuisine);
        }
        return { ...prev, cuisineTypes: Array.from(newCuisines) };
      });
    };

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={isVisible}
        onRequestClose={onClose}
      >
        <Pressable onPress={onClose} className="flex-1 bg-black/50 justify-end">
          <Pressable
            className="bg-card rounded-t-2xl p-6"
            style={{ paddingBottom: insets.bottom + 24 }}
          >
            <View className="flex-row justify-between items-center mb-6">
              <H3>Filters</H3>
              <Pressable onPress={onClose} className="p-1">
                <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
              </Pressable>
            </View>

            {/* Sort By */}
            <Text className="font-semibold mb-3">Sort By</Text>
            <View className="flex-row justify-between mb-6">
              {["discount", "popular", "newest", "expiry"].map((type) => (
                <Button
                  key={type}
                  variant={localFilters.sortBy === type ? "default" : "outline"}
                  onPress={() =>
                    setLocalFilters((f: any) => ({ ...f, sortBy: type }))
                  }
                  className="px-3"
                >
                  <Text className="capitalize">{type}</Text>
                </Button>
              ))}
            </View>

            {/* Minimum Discount */}
            <Text className="font-semibold mb-2">
              Minimum Discount: {localFilters.minDiscount}%
            </Text>
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={50}
              step={5}
              value={localFilters.minDiscount}
              onValueChange={(val) =>
                setLocalFilters((f: any) => ({ ...f, minDiscount: val }))
              }
              minimumTrackTintColor={
                colorScheme === "dark" ? "#3b82f6" : "#2563eb"
              }
              maximumTrackTintColor={
                colorScheme === "dark" ? "#4b5563" : "#d1d5db"
              }
              thumbTintColor={colorScheme === "dark" ? "#3b82f6" : "#2563eb"}
            />

            {/* Cuisine Types */}
            <Text className="font-semibold mb-3 mt-4">Cuisine</Text>
            <View className="flex-row flex-wrap">
              {Cuisines.map((cuisine) => (
                <Button
                  key={cuisine}
                  variant={
                    localFilters.cuisineTypes.includes(cuisine)
                      ? "default"
                      : "outline"
                  }
                  onPress={() => toggleCuisine(cuisine)}
                  className="mr-2 mb-2"
                >
                  <Text>{cuisine}</Text>
                </Button>
              ))}
            </View>

            {/* Apply Button */}
            <Button
              onPress={() => onApply(localFilters)}
              size="lg"
              className="mt-8"
            >
              <Text className="font-bold text-lg text-white">
                Apply Filters
              </Text>
            </Button>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  if (loading) {
    return <OffersScreenSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center px-4">
        <AlertCircle size={48} color="#ef4444" className="mb-4" />
        <H3 className="text-center mb-2">Something went wrong</H3>
        <Text className="text-center text-muted-foreground mb-4">{error}</Text>
        <Button onPress={handleRefresh}>
          <Text className="text-white">Try Again</Text>
        </Button>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!loading && offers.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View
          style={{ paddingTop: insets.top }}
          className="bg-background border-b border-border/50"
        >
          <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
            <View>
              <H2>Special Offers</H2>
              <Muted>No offers available</Muted>
            </View>
            <Pressable onPress={() => setShowFilters(true)} className="p-2">
              <Filter
                size={24}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>
          </View>
          <CategoryTabs />
        </View>

        <View className="flex-1 justify-center items-center px-4">
          <Gift size={48} color="#666" className="mb-4" />
          <H3 className="text-center mb-2">No offers found</H3>
          <Text className="text-center text-muted-foreground mb-4">
            Check back later for new deals or try adjusting your filters.
          </Text>
          <Button onPress={handleRefresh}>
            <Text className="text-white">Refresh</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={[]}>
      {/* Static Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-background border-b border-border/50"
      >
        {/* Header Content */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <H2>Special Offers</H2>
            <Muted>{offers.length} deals available</Muted>
          </View>
          <Pressable onPress={() => setShowFilters(true)} className="p-2">
            <Filter
              size={24}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
        </View>
        {/* Category Tabs */}
        <CategoryTabs />
      </View>

      {/* Content */}
      <OptimizedList
        data={offers}
        renderItem={({ item }) => <OfferCard offer={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
      />

      {/* Modals */}
      <FilterSheet
        isVisible={showFilters}
        onClose={() => setShowFilters(false)}
        currentFilters={filters}
        onApply={handleApplyFilters}
      />
      <OfferDetailsModal />
    </SafeAreaView>
  );
}
