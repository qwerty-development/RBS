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
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
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
  // ENHANCED: Review summary integration
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
  // Extended fields from enhanced schema
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  value_rating?: number;
  recommend_to_friend?: boolean;
  visit_again?: boolean;
  tags?: string[];
  photos?: string[];
};

type TimeSlot = {
  time: string;
  available: boolean;
  availableCapacity: number;
};

// SCREEN CONFIGURATION CONSTANTS
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = 300;

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
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "reviews">(
    "overview"
  );
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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

  const openImageGallery = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
  }, []);

  // Wrapper for handleBooking to match expected signature
  const onBooking = useCallback(() => {
    handleBooking(selectedDate, selectedTime, partySize);
  }, [handleBooking, selectedDate, selectedTime, partySize]);

  // Lifecycle Management - fetch availability when dependencies change
  useEffect(() => {
    if (restaurant && id) {
      fetchAvailableSlots(selectedDate, partySize);
    }
  }, [selectedDate, partySize, restaurant, fetchAvailableSlots, id]);

  // 13. Loading and Error States (Preserved)
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
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

  // 14. Image Gallery Modal (Preserved)

  const mapCoordinates = extractLocationCoordinates(restaurant.location) || {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  // 15. MAIN RENDER WITH ENHANCED REVIEW INTEGRATION
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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

        {/* Tab Navigation */}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

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
            onBooking={onBooking}
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

        {/* Reviews Tab with Full Integration */}
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

      {/* ENHANCED: Floating Action Button for Reviews */}
      {activeTab === "overview" && (
        <View className="absolute bottom-4 right-4">
          <Pressable
            onPress={navigateToCreateReview}
            className="bg-primary rounded-full p-3 shadow-lg"
          >
            <Star size={24} color="white" />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
