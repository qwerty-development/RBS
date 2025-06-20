// app/(protected)/restaurant/[id].tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  Users,
  Star,
  Calendar,
  CheckCircle,
  Gift,
  Trophy,
  Tag,
  Sparkles,
  QrCode,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import MapView from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P } from "@/components/ui/typography";

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

// Import hooks - these should be available in your codebase
// If any of these don't exist, you'll need to create them or remove the functionality
import { useRestaurantHelpers } from "@/hooks/useRestaurantHelpers";
import { useRestaurantData } from "@/hooks/useRestaurantData";
import { useLoyalty } from "@/hooks/useLoyalty";
import { useOffers } from "@/hooks/useOffers";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[] | null;
  ambiance_tags?: string[] | null;
  parking_available?: boolean | null;
  valet_parking?: boolean | null;
  outdoor_seating?: boolean | null;
  shisha_available?: boolean | null;
  live_music_schedule?: Record<string, boolean> | null;
  happy_hour_times?: { start: string; end: string } | null;
  booking_window_days?: number | null;
  cancellation_window_hours?: number | null;
  table_turnover_minutes?: number | null;
  instagram_handle?: string | null;
  website_url?: string | null;
  whatsapp_number?: string | null;
  average_rating?: number | null;
  total_reviews?: number | null;
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
  } | null;
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
  food_rating?: number | null;
  service_rating?: number | null;
  ambiance_rating?: number | null;
  value_rating?: number | null;
  recommend_to_friend?: boolean | null;
  visit_again?: boolean | null;
  tags?: string[] | null;
  photos?: string[] | null;
};

type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant?: Restaurant;
  claimed?: boolean;
  used?: boolean;
  redemptionCode?: string;
  isExpired?: boolean;
  canUse?: boolean;
};

// Screen configuration constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;

// COMPONENT DEFINITIONS OUTSIDE MAIN COMPONENT
// Loyalty Points Card Component
const LoyaltyPointsCard = React.memo<{
  restaurant: Restaurant;
  userTier: string;
  userPoints: number;
  earnablePoints: number;
  partySize: number;
}>(({ restaurant, userTier, userPoints, earnablePoints, partySize }) => {
  return (
    <View className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-4 mb-4 border border-primary/20">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color="#3b82f6" />
          <Text className="font-bold text-lg ml-2">Loyalty Rewards</Text>
        </View>
        <View className="bg-primary/20 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-sm">
            {(userTier || "bronze").toUpperCase()}
          </Text>
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
          <Text className="text-lg font-bold">{userPoints || 0} pts</Text>
        </View>
      </View>
      
      <Text className="text-xs text-muted-foreground mt-2">
        Points earned for dining here • Party size: {partySize}
      </Text>
    </View>
  );
});

// Offer Status Component
const OfferStatus = React.memo<{ offer: SpecialOffer }>(({ offer }) => {
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
});

// Individual Offer Card Component
const OfferCard = React.memo<{
  offer: SpecialOffer;
  highlighted?: boolean;
  onClaim: () => void;
  onUse: () => void;
  onBookWithOffer: () => void;
  processing: boolean;
}>(({ offer, highlighted = false, onClaim, onUse, onBookWithOffer, processing }) => {
  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.warn("Error formatting date:", error);
      return "Invalid date";
    }
  }, []);

  if (!offer || typeof offer !== 'object') {
    console.warn("Invalid offer data:", offer);
    return null;
  }

  const {
    title = "Special Offer",
    description = "",
    discount_percentage = 0,
    valid_until = "",
    minimum_party_size = 1,
    claimed = false,
    used = false,
    canUse = false,
    redemptionCode = ""
  } = offer;

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
            {title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {description}
          </Text>
        </View>
        
        <View className="bg-primary rounded-full h-12 w-12 items-center justify-center ml-2">
          <Text className="text-white font-bold text-lg">{discount_percentage}</Text>
          <Text className="text-white text-xs -mt-1">%</Text>
        </View>
      </View>

      {/* Status and expiry */}
      <View className="flex-row items-center justify-between mb-3">
        <OfferStatus offer={offer} />
        <Text className="text-xs text-muted-foreground">
          Until {valid_until ? formatDate(valid_until) : "N/A"}
        </Text>
      </View>

      {/* Terms */}
      {minimum_party_size > 1 && (
        <View className="flex-row items-center mb-3">
          <Users size={14} color="#666" />
          <Text className="text-xs text-muted-foreground ml-1">
            Min. {minimum_party_size} people
          </Text>
        </View>
      )}

      {/* Action button */}
      <View>
        {!claimed ? (
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
        ) : canUse ? (
          <Button
            onPress={onBookWithOffer}
            className="w-full"
            size="default"
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
              {used ? "Already Used" : "Expired"}
            </Text>
          </Button>
        )}
      </View>
      
      {/* Redemption code for claimed offers */}
      {claimed && redemptionCode && (
        <View className="mt-3 bg-muted/50 rounded-lg p-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">Code:</Text>
            <QrCode size={16} color="#666" />
          </View>
          <Text className="font-mono text-sm font-bold">
            {redemptionCode.slice(-6).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
});

// Special Offers Section Component
const SpecialOffersSection = React.memo<{
  offers: SpecialOffer[];
  highlightOfferId?: string;
  onClaimOffer: (offerId: string) => void;
  onUseOffer: (offer: SpecialOffer) => void;
  onBookWithOffer: (offer: SpecialOffer) => void;
  processing: boolean;
}>(({ offers, highlightOfferId, onClaimOffer, onUseOffer, onBookWithOffer, processing }) => {
  const safeOffers = Array.isArray(offers) ? offers.filter(offer => offer && typeof offer === 'object' && offer.id) : [];

  if (safeOffers.length === 0) {
    return (
      <View className="px-4 py-8 items-center">
        <Gift size={48} color="#666" />
        <H3 className="mt-4 text-center">No Offers Available</H3>
        <Text className="text-center text-muted-foreground mt-2">
          This restaurant doesn't have any special offers at the moment.
          Check back later or explore other restaurants.
        </Text>
      </View>
    );
  }

  return (
    <View className="px-4 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <H3>Special Offers</H3>
        <View className="bg-primary/10 px-3 py-1 rounded-full">
          <Text className="text-primary font-bold text-sm">
            {safeOffers.length} available
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-4">
          {safeOffers.map((offer) => (
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
});

// Error Boundary Component for Offers
const OffersErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [children]);

  if (hasError) {
    return (
      <View className="px-4 py-8 items-center">
        {fallback || (
          <>
            <AlertCircle size={48} color="#666" />
            <H3 className="mt-4 text-center">Something went wrong</H3>
            <Text className="text-center text-muted-foreground mt-2">
              Unable to load offers. Please try again later.
            </Text>
            <Button
              className="mt-4"
              onPress={() => setHasError(false)}
              variant="outline"
            >
              <Text>Try Again</Text>
            </Button>
          </>
        )}
      </View>
    );
  }

  try {
    return <>{children}</>;
  } catch (error) {
    console.error("Offers render error:", error);
    setHasError(true);
    return null;
  }
};

// MAIN COMPONENT WITH FIXED HOOK ORDER
export default function RestaurantDetailsScreen() {
  // =============================================================================
  // HOOK EXECUTION SECTION - ALL HOOKS MUST BE CALLED HERE IN FIXED ORDER
  // =============================================================================
  
  // 1. CORE REACT HOOKS (always first)
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const router = useRouter();
  
  // 2. EXPO ROUTER HOOKS
  const params = useLocalSearchParams<{ id: string; highlightOfferId?: string }>();
  
  // 3. STATE HOOKS (all useState calls)
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews" | "offers">("overview");
  const [pendingHighlightOfferId, setPendingHighlightOfferId] = useState<string | undefined>(highlightOfferId);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  
  // 4. REF HOOKS
  const scrollViewRef = useRef<ScrollView>(null);
  const mapRef = useRef<MapView>(null);
  
  // 5. CUSTOM HOOKS (always called, never conditional)
  const restaurantHelpers = useRestaurantHelpers();
  const loyalty = useLoyalty();
  const offersHook = useOffers();
  
  // 6. DERIVED VALUES AND MEMOS
  const id = React.useMemo(() => {
    if (!params || typeof params !== 'object') return undefined;
    const paramId = params.id;
    return (typeof paramId === 'string' && paramId.trim()) ? paramId : undefined;
  }, [params]);
  
  const highlightOfferId = React.useMemo(() => {
    return params?.highlightOfferId || undefined;
  }, [params]);
  
  const generateTimeSlots = React.useMemo(() => {
    return restaurantHelpers?.generateTimeSlots || (() => []);
  }, [restaurantHelpers]);
  
  // 7. DEPENDENT CUSTOM HOOKS (with stable parameters)
  const restaurantData = useRestaurantData(id, generateTimeSlots);
  
  // 8. EXTRACT VALUES FROM CUSTOM HOOKS
  const {
    extractLocationCoordinates = () => null,
    isRestaurantOpen = () => false,
    getDistanceText = () => '',
    handleCall = () => {},
    handleWhatsApp = () => {},
    openDirections = () => {},
  } = restaurantHelpers || {};
  
  const {
    restaurant = null,
    reviews = [],
    isFavorite = false,
    loading = true,
    availableSlots = [],
    loadingSlots = false,
    fetchAvailableSlots = () => {},
    toggleFavorite = () => {},
    handleShare = () => {},
    handleBooking = () => {},
    navigateToCreateReview = () => {},
  } = restaurantData || {};
  
  const {
    userPoints = 0,
    userTier = "bronze",
    calculateBookingPoints = () => 0,
    awardPoints = () => {},
  } = loyalty || {};
  
  const {
    offers = [],
    claimOffer = async () => {},
    useOffer = async () => {},
    loading: offersLoading = false,
  } = offersHook || {};
  
  // 9. COMPUTED VALUES
  const restaurantOffers = React.useMemo(() => {
    if (!Array.isArray(offers) || !id) return [];
    return offers.filter(offer => 
      offer && typeof offer === 'object' && offer.restaurant_id === id
    );
  }, [offers, id]);
  
  const earnablePoints = React.useMemo(() => {
    if (!restaurant || !calculateBookingPoints) return 0;
    try {
      return calculateBookingPoints(partySize, restaurant.price_range || 2);
    } catch (error) {
      console.warn("Error calculating booking points:", error);
      return 0;
    }
  }, [calculateBookingPoints, partySize, restaurant]);
  
  const allImages = React.useMemo(() => {
    if (!restaurant) return [];
    const images = [restaurant.main_image_url];
    if (Array.isArray(restaurant.image_urls)) {
      images.push(...restaurant.image_urls);
    }
    return images.filter(Boolean);
  }, [restaurant?.main_image_url, restaurant?.image_urls]);
  
  const mapCoordinates = React.useMemo(() => {
    if (!restaurant || !extractLocationCoordinates) {
      return { latitude: 33.8938, longitude: 35.5018 };
    }
    return extractLocationCoordinates(restaurant.location) || {
      latitude: 33.8938,
      longitude: 35.5018,
    };
  }, [extractLocationCoordinates, restaurant?.location]);
  
  const enhancedTabs = React.useMemo(() => {
    const baseTabs = [
      { id: "overview", label: "Overview" },
      { id: "menu", label: "Menu" },
      { id: "reviews", label: "Reviews" },
    ];
    
    // FIXED: Only add offers tab when data is loaded and offers exist
    if (!offersLoading && restaurantOffers.length > 0) {
      baseTabs.push({ id: "offers", label: "Offers" });
    }
    
    return baseTabs;
  }, [offersLoading, restaurantOffers.length]);
  
  // 10. CALLBACK HOOKS (all useCallback calls)
  const handleClaimOffer = useCallback(async (offerId: string) => {
    if (!claimOffer || processingOfferId) return;

    setProcessingOfferId(offerId);
    
    try {
      await claimOffer(offerId);
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Offer Claimed!",
        "The offer has been added to your account. You can use it when booking or dining at this restaurant.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error claiming offer:", error);
      Alert.alert("Error", error?.message || "Failed to claim offer");
    } finally {
      setProcessingOfferId(null);
    }
  }, [claimOffer, processingOfferId]);

  const handleUseOffer = useCallback(async (offer: SpecialOffer) => {
    if (!useOffer || !offer?.id) return;

    try {
      await useOffer(offer.id);
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Success", "Offer marked as used!");
    } catch (error: any) {
      console.error("Error using offer:", error);
      Alert.alert("Error", error?.message || "Failed to use offer");
    }
  }, [useOffer]);

  const handleBookWithOffer = useCallback((offer: SpecialOffer) => {
    if (!offer || !restaurant) return;

    try {
      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: id!,
          restaurantName: restaurant.name || "",
          offerId: offer.id || "",
          offerTitle: offer.title || "",
          redemptionCode: offer.redemptionCode || "",
          discount: (offer.discount_percentage || 0).toString(),
        },
      });
    } catch (error) {
      console.error("Error navigating to booking:", error);
      Alert.alert("Error", "Failed to navigate to booking");
    }
  }, [router, id, restaurant]);

  const handleEnhancedBooking = useCallback(async () => {
    if (!restaurant) return;

    try {
      router.push({
        pathname: "/booking/create",
        params: {
          restaurantId: id!,
          restaurantName: restaurant.name || "",
          selectedDate: selectedDate.toISOString(),
          selectedTime: selectedTime || "",
          partySize: partySize.toString(),
          earnablePoints: earnablePoints.toString(),
        },
      });
    } catch (error) {
      console.error("Error with enhanced booking:", error);
      if (handleBooking) {
        handleBooking(selectedDate, selectedTime, partySize);
      }
    }
  }, [restaurant, router, id, selectedDate, selectedTime, partySize, earnablePoints, handleBooking]);

  const openImageGallery = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
  }, []);
  
  // 11. EFFECT HOOKS (all useEffect calls)
  useEffect(() => {
    // FIXED: Only switch to offers tab after data is loaded and offers exist
    if (pendingHighlightOfferId && !offersLoading && restaurantOffers.length > 0) {
      const offerExists = restaurantOffers.some(offer => offer.id === pendingHighlightOfferId);
      if (offerExists) {
        setActiveTab("offers");
        setPendingHighlightOfferId(undefined); // Clear pending state
      }
    }
  }, [pendingHighlightOfferId, offersLoading, restaurantOffers]);
  
  useEffect(() => {
    if (restaurant && id && fetchAvailableSlots) {
      try {
        fetchAvailableSlots(selectedDate, partySize);
      } catch (error) {
        console.error("Error fetching available slots:", error);
      }
    }
  }, [selectedDate, partySize, restaurant, fetchAvailableSlots, id]);

  useEffect(() => {
    if (activeTab === "offers" && highlightOfferId) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 800, animated: true });
      }, 500);
    }
  }, [activeTab, highlightOfferId]);
  
  // =============================================================================
  // END OF HOOK EXECUTION SECTION
  // =============================================================================
  
  // CONDITIONAL LOGIC AND EARLY RETURNS (after all hooks)
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

  // MAIN RENDER (no hooks called here)
  return (
    <View className="flex-1 bg-background" edges={["top"]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Image Gallery with Parallax Effect */}
        {RestaurantImageGallery && (
          <RestaurantImageGallery
            images={allImages}
            imageIndex={imageIndex}
            isRestaurantOpen={isRestaurantOpen(restaurant)}
            onImageIndexChange={setImageIndex}
            onBackPress={() => router.back()}
            onCameraPress={() => openImageGallery(imageIndex)}
          />
        )}

        {/* Quick Actions Bar */}
        {QuickActionsBar && (
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
        )}

        {/* Restaurant Header Info */}
        {RestaurantHeaderInfo && (
          <RestaurantHeaderInfo
            restaurant={restaurant}
            highlightOfferId={highlightOfferId}
          />
        )}

        {/* Special Offers Highlight - FIXED: Only show when data is loaded and offer exists */}
        {highlightOfferId && !offersLoading && restaurantOffers.length > 0 && 
         restaurantOffers.some(offer => offer.id === highlightOfferId) && (
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
        {profile && restaurant && (
          <View className="px-4">
            <LoyaltyPointsCard
              restaurant={restaurant}
              userTier={userTier}
              userPoints={userPoints}
              earnablePoints={earnablePoints}
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
        {activeTab === "overview" && OverviewTabContent && (
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
            onToggleDescription={() => setShowFullDescription(!showFullDescription)}
            onCall={() => handleCall(restaurant)}
            onWhatsApp={() => handleWhatsApp(restaurant)}
            onDirectionsPress={() => openDirections(restaurant)}
            isRestaurantOpen={() => isRestaurantOpen(restaurant)}
          />
        )}

        {/* Menu Tab */}
        {activeTab === "menu" && MenuTab && (
          <MenuTab restaurant={restaurant} />
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && ReviewsTabContent && restaurant.review_summary && (
          <ReviewsTabContent
            reviewSummary={restaurant.review_summary}
            reviews={reviews}
            showAllReviews={showAllReviews}
            currentUserId={profile?.id}
            onToggleShowAllReviews={() => setShowAllReviews(!showAllReviews)}
            onWriteReview={navigateToCreateReview}
          />
        )}

        {/* Offers Tab with Enhanced Error Handling */}
        {activeTab === "offers" && (
          <View className="py-6">
            {offersLoading ? (
              <View className="px-4 py-8 items-center">
                <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
                <Text className="mt-4 text-muted-foreground">Loading offers...</Text>
              </View>
            ) : (
              <OffersErrorBoundary>
                <SpecialOffersSection
                  offers={restaurantOffers}
                  highlightOfferId={highlightOfferId}
                  onClaimOffer={handleClaimOffer}
                  onUseOffer={handleUseOffer}
                  onBookWithOffer={handleBookWithOffer}
                  processing={!!processingOfferId}
                />
              </OffersErrorBoundary>
            )}
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-20" />
      </ScrollView>

      {/* Image Gallery Modal */}
      {showImageGallery && ImageGalleryModal && (
        <ImageGalleryModal
          images={allImages}
          selectedImageIndex={selectedImageIndex}
          onClose={() => setShowImageGallery(false)}
          onImageIndexChange={setSelectedImageIndex}
        />
      )}

      {/* Floating Action Buttons */}
      <View className="absolute bottom-6 right-4 gap-3">
        {activeTab !== "reviews" && navigateToCreateReview && (
          <Pressable
            onPress={navigateToCreateReview}
            className="bg-muted rounded-full p-3 shadow-lg"
          >
            <Star size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
        )}

        {activeTab !== "overview" && (
          <Pressable
            onPress={() => router.push("/profile/loyalty")}
            className="bg-primary rounded-full p-3 shadow-lg"
          >
            <Trophy size={20} color="white" />
          </Pressable>
        )}
      </View>

      {/* Enhanced Booking Bar */}
      {activeTab === "overview" && (
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">
                Party of {partySize} • {selectedTime || "Select time"}
              </Text>
              <Text className="font-bold">
                Earn {earnablePoints} points
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