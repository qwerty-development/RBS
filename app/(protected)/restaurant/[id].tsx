// app/(protected)/restaurant/[id].tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Dimensions,
  Share,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Heart,
  Share2,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Users,
  Star,
  ChevronLeft,
  ChevronRight,
  Calendar,
  DollarSign,
  CheckCircle,
  Camera,
  X,
  ThumbsUp,
  MoreVertical,
  Gift,
  Trophy,
  Tag,
  Sparkles,
  Percent,
  QrCode,
  AlertCircle,
  ExternalLink,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { ReviewCard } from "@/components/restaurant/ReviewCard";
import { ReviewSummary } from "@/components/restaurant/ReviewSummary";
import { ImageGalleryModal } from "@/components/restaurant/ImageGalleryModal";
import { RestaurantHeaderInfo } from "@/components/restaurant/RestaurantHeaderInfo";
import { TabNavigation } from "@/components/restaurant/TabNavigation";
import { BookingWidget } from "@/components/restaurant/BookingWidget";
import { QuickActionsBar } from "@/components/restaurant/QuickActionsBar";
import { FeaturesAndAmenities } from "@/components/restaurant/FeaturesAndAmenities";
import { HoursSection } from "@/components/restaurant/HoursSection";
import { LocationSection } from "@/components/restaurant/LocationSection";
import { ContactSection } from "@/components/restaurant/ContactSection";
import { MenuTab } from "@/components/restaurant/MenuTab";
import { AboutSection } from "@/components/restaurant/AboutSection";
import { RestaurantImageGallery } from "@/components/restaurant/RestaurantImageGallery";
import { ReviewsTabContent } from "@/components/restaurant/ReviewsTabContent";
import { OverviewTabContent } from "@/components/restaurant/OverviewTabContent";
import { useRestaurantHelpers } from "@/hooks/useRestaurantHelpers";
import { useRestaurantData } from "@/hooks/useRestaurantData";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean>;
  happy_hour_times?: { start: string; end: string };
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  instagram_handle?: string;
  website_url?: string;
  whatsapp_number?: string;
  average_rating?: number;
  total_reviews?: number;
  review_summary?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  value_rating?: number;
  recommend_to_friend?: boolean;
  visit_again?: boolean;
  tags?: string[];
  photos?: string[];
};

type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
  claimed?: boolean;
  used?: boolean;
  redemptionCode?: string;
  isExpired?: boolean;
  canUse?: boolean;
};

// Screen configuration constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;

// Loyalty points card component
const LoyaltyPointsCard: React.FC<{
  restaurant: Restaurant;
  userTier: string;
  userPoints: number;
  calculateBookingPoints: (partySize: number, priceRange: number) => number;
  partySize: number;
}> = ({ restaurant, userTier, userPoints, calculateBookingPoints, partySize }) => {
  const { colorScheme } = useColorScheme();
  const earnablePoints = calculateBookingPoints(partySize, restaurant.price_range || 2);

  return (
    <View className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color="#3b82f6" />
          <Text className="font-bold text-lg ml-2">Loyalty Rewards</Text>
        </View>
        <View className="bg-primary/20 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-sm">{userTier.toUpperCase()}</Text>
        </View>
      </View>
      
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-muted-foreground">You'll earn</Text>
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-primary">{earnablePoints}</Text>
            <Text className="text-sm text-muted-foreground ml-1">points</Text>
          </View>
        </View>
        
        <View className="items-end">
          <Text className="text-sm text-muted-foreground">Current balance</Text>
          <Text className="text-lg font-bold">{userPoints} pts</Text>
        </View>
      </View>
      
      <Text className="text-xs text-muted-foreground mt-2">
        Points earned for dining here • Party size: {partySize}
      </Text>
    </View>
  );
};

// Special offers section component
const SpecialOffersSection: React.FC<{
  offers: SpecialOffer[];
  highlightOfferId?: string;
  onClaimOffer: (offerId: string) => void;
  onUseOffer: (offer: SpecialOffer) => void;
  onBookWithOffer: (offer: SpecialOffer) => void;
  processing: boolean;
}> = ({ offers, highlightOfferId, onClaimOffer, onUseOffer, onBookWithOffer, processing }) => {
  const { colorScheme } = useColorScheme();

  if (offers.length === 0) return null;

  return (
    <View className="px-4 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <H3>Special Offers</H3>
        <View className="bg-primary/10 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-sm">{offers.length} available</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-4">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              highlighted={offer.id === highlightOfferId}
              onClaim={() => onClaimOffer(offer.id)}
              onUse={() => onUseOffer(offer)}
              onBookWithOffer={() => onBookWithOffer(offer)}
              processing={processing}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// Individual offer card component
const OfferCard: React.FC<{
  offer: SpecialOffer;
  highlighted?: boolean;
  onClaim: () => void;
  onUse: () => void;
  onBookWithOffer: () => void;
  processing: boolean;
}> = ({ offer, highlighted, onClaim, onUse, onBookWithOffer, processing }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getOfferStatus = () => {
    if (offer.used) {
      return (
        <View className="flex-row items-center bg-green-100 px-2 py-1 rounded-full">
          <CheckCircle size={12} color="#16a34a" />
          <Text className="text-green-700 text-xs ml-1">Used</Text>
        </View>
      );
    }
    
    if (offer.isExpired) {
      return (
        <View className="flex-row items-center bg-red-100 px-2 py-1 rounded-full">
          <Clock size={12} color="#dc2626" />
          <Text className="text-red-700 text-xs ml-1">Expired</Text>
        </View>
      );
    }
    
    if (offer.claimed) {
      return (
        <View className="flex-row items-center bg-blue-100 px-2 py-1 rounded-full">
          <Tag size={12} color="#2563eb" />
          <Text className="text-blue-700 text-xs ml-1">Claimed</Text>
        </View>
      );
    }
    
    return null;
  };

  return (
    <View 
      className={`bg-card rounded-xl border-2 p-4 w-72 ${
        highlighted ? 'border-primary shadow-lg' : 'border-border'
      }`}
    >
      {/* Header */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="font-bold text-lg" numberOfLines={1}>
            {offer.title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {offer.description}
          </Text>
        </View>
        
        <View className="bg-primary rounded-full h-12 w-12 items-center justify-center ml-2">
          <Text className="text-white font-bold text-lg">{offer.discount_percentage}</Text>
          <Text className="text-white text-xs -mt-1">%</Text>
        </View>
      </View>

      {/* Status and expiry */}
      <View className="flex-row items-center justify-between mb-3">
        {getOfferStatus()}
        <Text className="text-xs text-muted-foreground">
          Until {formatDate(offer.valid_until)}
        </Text>
      </View>

      {/* Terms */}
      {offer.minimum_party_size > 1 && (
        <View className="flex-row items-center mb-3">
          <Users size={14} color="#666" />
          <Text className="text-xs text-muted-foreground ml-1">
            Min. {offer.minimum_party_size} people
          </Text>
        </View>
      )}

      {/* Action button */}
      <View>
        {!offer.claimed ? (
          <Button
            onPress={onClaim}
            disabled={processing}
            className="w-full"
            size="sm"
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Tag size={16} className="mr-2" />
                <Text className="text-white font-medium">Claim Offer</Text>
              </>
            )}
          </Button>
        ) : offer.canUse ? (
          <Button
            onPress={onBookWithOffer}
            className="w-full"
            size="sm"
          >
            <Calendar size={16} className="mr-2" />
            <Text className="text-white font-medium">Book with Offer</Text>
          </Button>
        ) : (
          <Button
            variant="outline"
            onPress={() => {}}
            disabled
            className="w-full"
            size="sm"
          >
            <Text className="text-muted-foreground">
              {offer.used ? "Already Used" : "Expired"}
            </Text>
          </Button>
        )}
      </View>
      
      {/* Redemption code for claimed offers */}
      {offer.claimed && offer.redemptionCode && (
        <View className="mt-3 bg-muted/50 rounded-lg p-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">Code:</Text>
            <QrCode size={16} color="#666" />
          </View>
          <Text className="font-mono text-sm font-bold">
            {offer.redemptionCode.slice(-6).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function RestaurantDetailsScreen() {
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();

  // Safe parameter extraction with multiple fallbacks
  let params;
  let id: string | undefined;

  try {
    params = useLocalSearchParams<{ id: string; highlightOfferId?: string }>();
    if (params && typeof params === "object") {
      id = params.id;
    }
  } catch (error) {
    console.error("Error getting route params:", error);
    params = {};
    id = undefined;
  }

  if (!params || typeof params !== "object") {
    params = {};
  }

  if (typeof id !== "string" || !id.trim()) {
    id = undefined;
  }

  const highlightOfferId = params.highlightOfferId;
  console.log("Restaurant Details - Params:", params, "ID:", id);

  // UI state
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews" | "offers">(
    highlightOfferId ? "offers" : "overview"
  );
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);

  // Use custom hooks
  const {
    extractLocationCoordinates,
    isRestaurantOpen,
    getDistanceText,
    handleCall,
    handleWhatsApp,
    openDirections,
    generateTimeSlots,
  } = useRestaurantHelpers();

  const {
    restaurant,
    reviews,
    isFavorite,
    loading,
    availableSlots,
    loadingSlots,
    fetchAvailableSlots,
    toggleFavorite,
    handleShare,
    handleBooking,
    navigateToCreateReview,
  } = useRestaurantData(id, generateTimeSlots);

  // Loyalty and offers hooks
  const {
    userPoints,
    userTier,
    calculateBookingPoints,
    awardPoints,
  } = useLoyalty();

  const {
    offers,
    claimOffer,
    useOffer,
    loading: offersLoading,
  } = useOffers();

  // Filter offers for this restaurant
  const restaurantOffers = offers.filter(offer => offer.restaurant_id === id);

  // Handle offer claiming
  const handleClaimOffer = useCallback(async (offerId: string) => {
    setProcessingOfferId(offerId);
    
    try {
      await claimOffer(offerId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Offer Claimed!",
        "The offer has been added to your account. You can use it when booking or dining at this restaurant.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to claim offer");
    } finally {
      setProcessingOfferId(null);
    }
  }, [claimOffer]);

  // Handle offer usage
  const handleUseOffer = useCallback(async (offer: SpecialOffer) => {
    try {
      await useOffer(offer.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Offer marked as used!");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to use offer");
    }
  }, [useOffer]);

  // Handle booking with offer
  const handleBookWithOffer = useCallback((offer: SpecialOffer) => {
    router.push({
      pathname: "/booking/create",
      params: {
        restaurantId: id!,
        restaurantName: restaurant?.name || "",
        offerId: offer.id,
        offerTitle: offer.title,
        redemptionCode: offer.redemptionCode,
        discount: offer.discount_percentage.toString(),
      },
    });
  }, [router, id, restaurant]);

  // Enhanced booking handler with loyalty integration
  const handleEnhancedBooking = useCallback(async () => {
    if (!restaurant) return;

    try {
      // Calculate points that will be earned
      const earnablePoints = calculateBookingPoints(partySize, restaurant.price_range || 2);
      
      // Navigate to booking with loyalty info
      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: id!,
          restaurantName: restaurant.name,
          selectedDate: selectedDate.toISOString(),
          selectedTime,
          partySize: partySize.toString(),
          earnablePoints: earnablePoints.toString(),
        },
      });
    } catch (error) {
      console.error("Error with enhanced booking:", error);
      // Fallback to regular booking
      handleBooking(selectedDate, selectedTime, partySize);
    }
  }, [restaurant, calculateBookingPoints, partySize, router, id, selectedDate, selectedTime, handleBooking]);

  const openImageGallery = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
  }, []);

  // Lifecycle Management - fetch availability when dependencies change
  useEffect(() => {
    if (restaurant && id) {
      fetchAvailableSlots(selectedDate, partySize);
    }
  }, [selectedDate, partySize, restaurant, fetchAvailableSlots, id]);

  // Auto-scroll to highlighted offer
  useEffect(() => {
    if (highlightOfferId && activeTab === "offers") {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 800, animated: true });
      }, 500);
    }
  }, [highlightOfferId, activeTab]);

  // Loading and Error States
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Text className="mt-4 text-muted-foreground">Loading restaurant...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!id) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Invalid Restaurant</H3>
          <P className="text-center text-muted-foreground mb-4">
            The restaurant ID is missing or invalid.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <P className="text-center text-muted-foreground mb-4">
            The restaurant you're looking for doesn't exist or has been removed.
          </P>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const allImages = [
    restaurant.main_image_url,
    ...(restaurant.image_urls || []),
  ];

  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  // Enhanced tab navigation with offers
  const enhancedTabs = [
    { id: "overview", label: "Overview" },
    { id: "menu", label: "Menu" },
    { id: "reviews", label: "Reviews" },
    ...(restaurantOffers.length > 0 ? [{ id: "offers", label: "Offers" }] : []),
  ];

  return (
    <View className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Image Gallery with Parallax Effect */}
        <RestaurantImageGallery
          images={allImages}
          imageIndex={imageIndex}
          isRestaurantOpen={isRestaurantOpen(restaurant)}
          onImageIndexChange={setImageIndex}
          onBackPress={() => router.back()}
          onCameraPress={() => openImageGallery(imageIndex)}
        />

        {/* Quick Actions Bar */}
        <QuickActionsBar
          restaurant={restaurant}
          isFavorite={isFavorite}
          colorScheme={colorScheme}
          onToggleFavorite={toggleFavorite}
          onShare={handleShare}
          onCall={() => handleCall(restaurant)}
          onWhatsApp={() => handleWhatsApp(restaurant)}
          onDirections={() => openDirections(restaurant)}
        />

        {/* Restaurant Header Info */}
        <RestaurantHeaderInfo
          restaurant={restaurant}
          highlightOfferId={highlightOfferId}
        />

        {/* Special Offers Highlight (if coming from offers) */}
        {highlightOfferId && restaurantOffers.length > 0 && (
          <View className="px-4 mb-4">
            <View className="bg-primary/10 border-2 border-primary/30 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <Sparkles size={20} color="#3b82f6" />
                <Text className="font-bold text-primary ml-2">Featured Offer</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                You came here from a special offer! Check out the offers tab to claim and use it.
              </Text>
            </View>
          </View>
        )}

        {/* Loyalty Points Card */}
        {profile && (
          <View className="px-4">
            <LoyaltyPointsCard
              restaurant={restaurant}
              userTier={userTier}
              userPoints={userPoints}
              calculateBookingPoints={calculateBookingPoints}
              partySize={partySize}
            />
          </View>
        )}

        {/* Tab Navigation */}
        <View className="bg-background border-b border-border">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row px-4">
              {enhancedTabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-4 border-b-2 ${
                    activeTab === tab.id ? "border-primary" : "border-transparent"
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                    {tab.id === "offers" && restaurantOffers.length > 0 && (
                      <Text className="text-xs"> ({restaurantOffers.length})</Text>
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <OverviewTabContent
            restaurant={restaurant as any}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            partySize={partySize}
            availableSlots={availableSlots}
            loadingSlots={loadingSlots}
            showFullDescription={showFullDescription}
            mapCoordinates={mapCoordinates}
            mapRef={mapRef}
            onDateChange={setSelectedDate}
            onTimeChange={setSelectedTime}
            onPartySizeChange={setPartySize}
            onBooking={handleEnhancedBooking}
            onToggleDescription={() =>
              setShowFullDescription(!showFullDescription)
            }
            onCall={() => handleCall(restaurant)}
            onWhatsApp={() => handleWhatsApp(restaurant)}
            onDirectionsPress={() => openDirections(restaurant)}
            isRestaurantOpen={() => isRestaurantOpen(restaurant)}
          />
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && <MenuTab restaurant={restaurant} />}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <ReviewsTabContent
            reviewSummary={restaurant.review_summary!}
            reviews={reviews}
            showAllReviews={showAllReviews}
            currentUserId={profile?.id}
            onToggleShowAllReviews={() => setShowAllReviews(!showAllReviews)}
            onWriteReview={navigateToCreateReview}
          />
        )}

        {/* Offers Tab */}
        {activeTab === "offers" && (
          <View className="py-6">
            {restaurantOffers.length > 0 ? (
              <SpecialOffersSection
                offers={restaurantOffers}
                highlightOfferId={highlightOfferId}
                onClaimOffer={handleClaimOffer}
                onUseOffer={handleUseOffer}
                onBookWithOffer={handleBookWithOffer}
                processing={!!processingOfferId}
              />
            ) : (
              <View className="px-4 py-8 items-center">
                <Gift size={48} color="#666" />
                <H3 className="mt-4 text-center">No Offers Available</H3>
                <Text className="text-center text-muted-foreground mt-2">
                  This restaurant doesn't have any special offers at the moment.
                  Check back later or explore other restaurants.
                </Text>
                <Button
                  className="mt-4"
                  onPress={() => router.push("/offers")}
                >
                  <Text className="text-white">Browse All Offers</Text>
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Image Gallery Modal */}
      {showImageGallery && (
        <ImageGalleryModal
          images={allImages}
          selectedImageIndex={selectedImageIndex}
          onClose={() => setShowImageGallery(false)}
          onImageIndexChange={setSelectedImageIndex}
        />
      )}

      {/* Floating Action Buttons */}
      <View className="absolute bottom-6 right-4 gap-3">
        {/* Review FAB */}
        {activeTab !== "reviews" && (
          <Pressable
            onPress={navigateToCreateReview}
            className="bg-muted rounded-full p-3 shadow-lg"
          >
            <Star size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
        )}

        {/* Loyalty FAB */}
        {activeTab !== "overview" && (
          <Pressable
            onPress={() => router.push("/profile/loyalty")}
            className="bg-primary rounded-full p-3 shadow-lg"
          >
            <Trophy size={20} color="white" />
          </Pressable>
        )}
      </View>

      {/* Enhanced Booking Bar (sticky bottom) */}
      {activeTab === "overview" && (
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">
                Party of {partySize} • {selectedTime || "Select time"}
              </Text>
              <Text className="font-bold">
                Earn {calculateBookingPoints(partySize, restaurant.price_range || 2)} points
              </Text>
            </View>
            <Button
              onPress={handleEnhancedBooking}
              disabled={!selectedTime}
              className="px-6"
            >
              <Calendar size={16} className="mr-2" />
              <Text className="text-white font-bold">Book Table</Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}