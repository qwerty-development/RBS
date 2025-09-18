// app/(protected)/restaurant/[id].tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  BookOpen,
  FolderPlus,
  ChevronLeft,
  Heart,
  Star,
  MapPin,
  Phone,
  Globe,
  Calendar,
  ChevronRight,
  Edit3,
  Car,
  Leaf,
  TreePine,
  CheckCircle,
  Send,
  Timer,
  X,
  Share2,
} from "lucide-react-native";
import {
  ScrollView,
  View,
  Pressable,
  Alert,
  Dimensions,
  StatusBar,
  Modal,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MapView, { Marker } from "react-native-maps";
import { RestaurantPosts } from "@/components/restaurant/RestaurantPosts";
import { AddToPlaylistModal } from "@/components/playlists/AddToPlaylistModal";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { RestaurantHoursDisplay } from "@/components/restaurant/RestaurantHoursDisplay";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { LocationService } from "@/lib/locationService";
import { RestaurantLoyaltyRules } from "@/components/booking/LoyaltyPointsDisplay";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useRestaurantReviews } from "@/hooks/useRestaurantReviews";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import {
  useBookingPress,
  useQuickActionPress,
  useModalPress,
} from "@/hooks/useHapticPress";

import { DirectionsButton } from "@/components/restaurant/DirectionsButton";
import { useShare } from "@/hooks/useShare";
import { ShareModal } from "@/components/ui/share-modal";
import RestaurantDetailsScreenSkeleton from "@/components/skeletons/RestaurantDetailsScreenSkeleton";
import { Database } from "@/types/supabase";
import {
  getAgeRestrictionMessage,
  isAgeRestricted,
} from "@/utils/ageVerification";
import { useBookingEligibility } from "@/hooks/useBookingEligibility";

// Type definitions - Extended to match actual database schema
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[] | null;
  ambiance_tags?: string[] | null;
  parking_available?: boolean | null;
  outdoor_seating?: boolean | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  staticCoordinates?: { lat: number; lng: number };
  coordinates?: { latitude: number; longitude: number };
  review_summary?: {
    average_rating: number;
    total_reviews: number;
    recommendation_percentage: number;
  } | null;
  // Additional fields that exist in the database but not in the types
  main_image_url?: string | null;
  image_urls?: string[] | null;
  website_url?: string | null;
  booking_policy?: "instant" | "request" | null;
  cuisine_type?: string | null;
  address?: string | null;
  location?: any;
  phone_number?: string | null;
  description?: string | null;
  price_range?: number | null;
  // Add any additional fields that might be missing
  [key: string]: any;
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
  overall_rating?: number; // Add this field to match the usage
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

// Custom hook for restaurant location - Updated to handle different location formats
const useRestaurantLocation = (location: any, restaurant?: Restaurant) => {
  const [address, setAddress] = useState<string>("Loading...");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);

    // Use LocationService to extract coordinates from any format
    const coords = LocationService.extractCoordinates(location);

    if (coords) {
      setCoordinates(coords);
    } else {
      // Default to Beirut coordinates if no valid coordinates found
      setCoordinates({
        latitude: 33.8938,
        longitude: 35.5018,
      });
    }

    // Use the actual restaurant address instead of placeholder text
    if (restaurant?.address) {
      setAddress(restaurant.address);
    } else {
      setAddress("Address not available");
    }
    setIsLoading(false);
  }, [location, restaurant]);

  return { address, coordinates, isLoading };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 400);

// Image Gallery Modal Component
const ImageGalleryModal: React.FC<{
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}> = ({ visible, images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const { handlePress: handleModalPress } = useModalPress();

  const goToPrevious = () => {
    handleModalPress(() => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    });
  };

  const goToNext = () => {
    handleModalPress(() => {
      setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    });
  };

  const handleClose = () => {
    handleModalPress(onClose);
  };

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black">
        <StatusBar barStyle="light-content" backgroundColor="black" />

        {/* Header with close button */}
        <View className="absolute top-0 left-0 right-0 z-50 pt-12">
          <View className="flex-row items-center justify-between p-4">
            <Pressable
              onPress={handleClose}
              className="w-12 h-12 bg-black/70 rounded-full items-center justify-center"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={24} color="white" />
            </Pressable>
            <Text className="text-white font-medium">
              {currentIndex + 1} of {images.length}
            </Text>
            <View className="w-12" />
          </View>
        </View>

        {/* Image Display */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: currentIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            );
            setCurrentIndex(index);
          }}
        >
          {images.map((image, index) => (
            <View
              key={index}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
              className="items-center justify-center"
            >
              <Image
                source={{ uri: image }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Navigation Controls */}
        {images.length > 1 && (
          <>
            <Pressable
              onPress={goToPrevious}
              className="absolute left-4 top-1/2 w-12 h-12 bg-black/50 rounded-full items-center justify-center"
              style={{ marginTop: -24 }}
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
            <Pressable
              onPress={goToNext}
              className="absolute right-4 top-1/2 w-12 h-12 bg-black/50 rounded-full items-center justify-center"
              style={{ marginTop: -24 }}
            >
              <ChevronRight size={24} color="white" />
            </Pressable>
          </>
        )}

        {/* Image Indicators */}
        {images.length > 1 && (
          <View className="absolute bottom-0 left-0 right-0">
            <SafeAreaView edges={["bottom"]}>
              <View className="flex-row justify-center py-4">
                <View className="flex-row bg-black/50 rounded-full px-3 py-2 gap-1">
                  {images.map((_, index) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === currentIndex ? "bg-white" : "bg-white/40"
                      }`}
                    />
                  ))}
                </View>
              </View>
            </SafeAreaView>
          </View>
        )}
      </View>
    </Modal>
  );
};

// Image Gallery Component - FIXED: Moved buttons outside ScrollView
const ImageGallery: React.FC<{
  images: string[];
  onImagePress: (index: number) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToPlaylist: () => void;
}> = ({
  images,
  onImagePress,
  isFavorite,
  onToggleFavorite,
  onAddToPlaylist,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images.length) return null;

  return (
    <View style={{ height: IMAGE_HEIGHT }} className="relative">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setActiveIndex(index);
        }}
      >
        {images.map((image, index) => (
          <Pressable
            key={index}
            onPress={() => onImagePress(index)}
            style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
          >
            <Image
              source={{ uri: image }}
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Image Indicators */}
      {images.length > 1 && (
        <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
          <View className="flex-row bg-black/20 rounded-full px-2 py-0.5 gap-0.5">
            {images.map((_, index) => (
              <View
                key={index}
                className={`w-1.5 h-1.5 rounded-full ${
                  index === activeIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

// Restaurant Header Info - Updated to use new hours system
const RestaurantHeaderInfo: React.FC<{
  restaurant: Restaurant;
  restaurantId: string;
}> = ({ restaurant, restaurantId }) => {
  const { address, isLoading } = useRestaurantLocation(
    restaurant.location,
    restaurant,
  );

  return (
    <View className="p-4 bg-background">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <H1 className="text-2xl font-bold mb-1">{restaurant.name}</H1>
          <Text className="text-muted-foreground">
            {restaurant.cuisine_type} •{" "}
            {"$".repeat(restaurant.price_range || 2)}
          </Text>
          {isAgeRestricted(restaurant) && (
            <View className="mt-2">
              <View className="inline-flex flex-row items-center px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  {getAgeRestrictionMessage(restaurant)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View className="items-end">
          <View className="flex-row items-center gap-1 mb-1">
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text className="font-semibold">
              {restaurant.average_rating && restaurant.average_rating > 0
                ? restaurant.average_rating.toFixed(1)
                : "-"}
            </Text>
            <Text className="text-muted-foreground">
              ({restaurant.total_reviews || 0})
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-4 mb-3">
        <View className="flex-row items-center gap-1 flex-1">
          <MapPin size={14} color="#666" />
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {isLoading ? "Loading location..." : address}
          </Text>
        </View>
      </View>
    </View>
  );
};

// About Section
const AboutSection: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => {
  const [showFullDescription, setShowFullDescription] = useState(false);

  if (!restaurant.description) return null;

  const shouldTruncate = restaurant.description.length > 120;
  const displayText =
    shouldTruncate && !showFullDescription
      ? restaurant.description.substring(0, 120) + "..."
      : restaurant.description;

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-2 text-foreground">
        About
      </Text>
      <Text className="text-sm text-muted-foreground leading-5 mb-1">
        {displayText}
      </Text>
      {shouldTruncate && (
        <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
          <Text className="text-primary text-sm font-medium">
            {showFullDescription ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

// Features Section
const FeaturesSection: React.FC<{ restaurant: Restaurant }> = ({
  restaurant,
}) => {
  const features = [];

  if (restaurant.parking_available)
    features.push({ icon: Car, text: "Parking" });
  if (restaurant.outdoor_seating)
    features.push({ icon: TreePine, text: "Outdoor seating" });
  if (restaurant.dietary_options?.includes("vegetarian"))
    features.push({ icon: Leaf, text: "Vegetarian" });
  if (restaurant.dietary_options?.includes("vegan"))
    features.push({ icon: Leaf, text: "Vegan" });

  if (features.length === 0) return null;

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-3 text-foreground">
        Features
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {features.map((feature, index) => {
          const IconComponent = feature.icon;
          return (
            <View
              key={index}
              className="flex-row items-center bg-muted/30 px-3 py-2 rounded-full"
            >
              <IconComponent size={14} color="#666" />
              <Text className="text-sm text-muted-foreground ml-1.5">
                {feature.text}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Quick Actions Section - Combined Contact, Website, and Menu
const QuickActionsSection: React.FC<{
  restaurant: Restaurant;
  onCall: () => void;
  onWebsite: () => void;
  onViewMenu: () => void;
}> = ({ restaurant, onCall, onWebsite, onViewMenu }) => {
  const actions = [];

  // Add call action if phone number exists
  if (restaurant.phone_number) {
    actions.push({
      id: "call",
      icon: Phone,
      label: "Call",
      onPress: onCall,
      color: "#3b82f6",
    });
  }

  // Add website action if website exists
  if (restaurant.website_url) {
    actions.push({
      id: "website",
      icon: Globe,
      label: "Website",
      onPress: onWebsite,
      color: "#3b82f6",
    });
  }

  // Always add menu action
  actions.push({
    id: "menu",
    icon: BookOpen,
    label: "Menu",
    onPress: onViewMenu,
    color: "#3b82f6",
  });

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-3 text-foreground">
        Quick Actions
      </Text>

      <View className="flex-row gap-3">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              className="flex-1 flex-row items-center justify-center gap-2 p-3 rounded-xl border border-border bg-background"
            >
              <View className="w-6 h-6 items-center justify-center">
                <IconComponent size={16} color={action.color} />
              </View>
              <Text className="text-sm font-medium text-foreground">
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// Location Map
const LocationMap: React.FC<{
  restaurant: Restaurant;
}> = ({ restaurant }) => {
  const { address, coordinates, isLoading } = useRestaurantLocation(
    restaurant.location,
    restaurant,
  );

  // Default coordinates for Beirut
  const defaultCoordinates: Coordinates = {
    latitude: 33.8938,
    longitude: 35.5018,
  };

  // Use parsed coordinates if available and valid, otherwise use default
  const mapCoordinates =
    coordinates &&
    !isNaN(coordinates.latitude) &&
    !isNaN(coordinates.longitude) &&
    coordinates.latitude !== 0 &&
    coordinates.longitude !== 0
      ? coordinates
      : defaultCoordinates;

  const mapRegion = {
    latitude: mapCoordinates.latitude,
    longitude: mapCoordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View className="px-4 py-3 border-b border-border/50">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-foreground">
          Location
        </Text>
        <DirectionsButton restaurant={restaurant} variant="button" size="sm" />
      </View>

      <View className="rounded-xl overflow-hidden h-40 mb-2 bg-gray-100 border border-border/50">
        <MapView
          style={{ flex: 1 }}
          initialRegion={mapRegion}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => {}}
        >
          <Marker
            coordinate={mapCoordinates}
            title={restaurant.name}
            description={address !== "Loading..." ? address : undefined}
          />
        </MapView>
      </View>

      <View className="flex-row items-center gap-2">
        <MapPin size={14} color="#666" />
        <Text className="text-sm text-muted-foreground flex-1">
          {isLoading ? "Loading location..." : address}
        </Text>
      </View>
    </View>
  );
};

// Reviews Summary
interface ReviewsSummaryProps {
  restaurant: Restaurant;
  reviews: Review[];
  onViewAllReviews: () => void;
  onWriteReview: () => void;
}

const ReviewsSummary: React.FC<ReviewsSummaryProps> = ({
  restaurant,
  reviews,
  onViewAllReviews,
  onWriteReview,
}) => {
  return (
    <View className="px-4 py-3 border-b border-border/50 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-semibold text-foreground">
          Reviews ({restaurant.total_reviews || 0})
        </Text>
        <Pressable
          onPress={onViewAllReviews}
          className="flex-row items-center gap-1"
        >
          <Text className="text-primary text-sm font-medium">See all</Text>
          <ChevronRight size={14} color="#3b82f6" />
        </Pressable>
      </View>

      {/* Rating Overview */}
      <View className="flex-row items-center gap-4 mb-4 p-3 bg-muted/20 rounded-xl">
        <View className="items-center">
          <Text className="text-2xl font-bold text-foreground">
            {restaurant.average_rating && restaurant.average_rating > 0
              ? restaurant.average_rating.toFixed(1)
              : "-"}
          </Text>
          <View className="flex-row mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                color="#f59e0b"
                fill={
                  star <= (restaurant.average_rating || 0) ? "#f59e0b" : "none"
                }
              />
            ))}
          </View>
        </View>

        <View className="flex-1">
          <Text className="text-xs text-muted-foreground mb-1">
            {restaurant.review_summary?.recommendation_percentage &&
            restaurant.review_summary.recommendation_percentage > 0
              ? `${restaurant.review_summary.recommendation_percentage}% recommend`
              : "No recommendation yet"}
          </Text>
          <View className="bg-border rounded-full h-1.5">
            <View
              className="bg-green-500 h-1.5 rounded-full"
              style={{
                width: `${
                  restaurant.review_summary?.recommendation_percentage || 0
                }%`,
              }}
            />
          </View>
        </View>
      </View>

      {/* Write a Review Button */}
      <Button variant="outline" onPress={onWriteReview} className="mb-4">
        <View className="flex-row items-center">
          <Edit3 size={16} color="#3b82f6" />
          <Text className="font-semibold text-primary ml-2">
            Write a Review
          </Text>
        </View>
      </Button>

      {/* Recent Reviews */}
      {reviews.length > 0 ? (
        reviews.slice(0, 2).map((review) => (
          <View
            key={review.id}
            className="mb-3 last:mb-0 p-3 bg-muted/10 rounded-xl"
          >
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-7 h-7 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-xs font-medium text-primary">
                  {review?.user?.full_name?.charAt(0)}
                </Text>
              </View>
              <Text className="text-sm font-medium text-foreground">
                {review?.user?.full_name}
              </Text>
              <View className="flex-row ml-auto">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    color="#f59e0b"
                    fill={star <= (review.rating || 0) ? "#f59e0b" : "none"}
                  />
                ))}
              </View>
            </View>
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {review.comment}
            </Text>
          </View>
        ))
      ) : (
        <View className="items-center py-4">
          <Muted>Be the first to review this restaurant!</Muted>
        </View>
      )}
    </View>
  );
};

// Main Component
export default function RestaurantDetailsScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;

  // State for non-protected UI elements
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);

  // Hooks
  const { shareRestaurant, shareRestaurantMenu } = useShare();

  // Guest Guard Hook
  const {
    isGuest,
    showGuestPrompt,
    promptedFeature,
    runProtectedAction,
    handleClosePrompt,
    handleSignUpFromPrompt,
  } = useGuestGuard();

  // Restaurant data hook
  const {
    restaurant,
    reviews,
    isFavorite,
    loading,
    toggleFavorite,
    handleCall,
  } = useRestaurant(id);

  // Booking eligibility check (only when restaurant is loaded)
  const bookingEligibility = useBookingEligibility(
    restaurant || ({} as Restaurant),
  );

  // Restaurant reviews hook for write review functionality
  const { handleWriteReview: handleWriteReviewFromReviews } =
    useRestaurantReviews(id!);

  // Haptic press hooks
  const { handlePress: handleBookingPress } = useBookingPress();
  const { handlePress: handleQuickActionPress } = useQuickActionPress();

  // Action Handlers with Guest Guard
  const handleToggleFavorite = useCallback(() => {
    handleQuickActionPress(() => {
      runProtectedAction(toggleFavorite, "save restaurants");
    });
  }, [runProtectedAction, toggleFavorite, handleQuickActionPress]);

  const handleAddToPlaylist = useCallback(() => {
    handleQuickActionPress(() => {
      runProtectedAction(
        () => setShowAddToPlaylist(true),
        "add restaurants to a playlist",
      );
    });
  }, [runProtectedAction, handleQuickActionPress]);

  const handleShare = useCallback(() => {
    handleQuickActionPress(() => {
      setShowShareModal(true);
    });
  }, [handleQuickActionPress]);

  const handleWriteReview = useCallback(() => {
    if (!restaurant) return;
    handleQuickActionPress(() => {
      runProtectedAction(
        () => handleWriteReviewFromReviews(),
        "write a review",
      );
    });
  }, [
    runProtectedAction,
    handleWriteReviewFromReviews,
    restaurant,
    handleQuickActionPress,
  ]);

  // FIXED: Navigate to availability screen instead of using BookingWidget
  const handleBookTable = useCallback(() => {
    if (!restaurant) return;
    router.push({
      pathname: "/booking/availability",
      params: {
        restaurantId: id!,
        restaurantName: restaurant.name,
      },
    });
  }, [router, id, restaurant]);

  const handleAttemptBooking = useCallback(() => {
    handleBookingPress(() => {
      // Check booking eligibility first
      if (!bookingEligibility.isEligible) {
        Alert.alert(
          "Booking Not Available",
          bookingEligibility.blockedReason || "Unable to proceed with booking",
          [
            { text: "OK", style: "default" },
            ...(bookingEligibility.actionText
              ? [
                  {
                    text: bookingEligibility.actionText,
                    style: "default",
                    onPress: () => {
                      if (bookingEligibility.actionRequired === "sign_up") {
                        router.push("/sign-up");
                      } else if (
                        bookingEligibility.actionRequired ===
                        "add_date_of_birth"
                      ) {
                        router.push("/profile/edit");
                      }
                    },
                  },
                ]
              : []),
          ],
        );
        return;
      }

      runProtectedAction(handleBookTable, "book a table");
    });
  }, [
    runProtectedAction,
    handleBookTable,
    handleBookingPress,
    bookingEligibility,
    router,
  ]);

  const handleAddToPlaylistSuccess = useCallback(
    (playlistName: string) => {
      Alert.alert(
        "Added to Playlist",
        `${restaurant?.name} has been added to "${playlistName}"`,
        [{ text: "OK" }],
      );
    },
    [restaurant?.name],
  );

  const allImages = React.useMemo(() => {
    if (!restaurant) return [];
    const images: string[] = [];

    // Add main image if it exists - using type assertion for now
    if ((restaurant as any).main_image_url) {
      images.push((restaurant as any).main_image_url);
    }

    // Add additional images if they exist - using type assertion for now
    if (Array.isArray((restaurant as any).image_urls)) {
      images.push(...(restaurant as any).image_urls);
    }

    return images.filter(Boolean);
  }, [restaurant]);

  const handleWebsite = useCallback(() => {
    handleQuickActionPress(() => {
      if ((restaurant as any)?.website_url) {
        Linking.openURL((restaurant as any).website_url);
      }
    });
  }, [(restaurant as any)?.website_url, handleQuickActionPress]);

  const handleViewAllReviews = useCallback(() => {
    handleQuickActionPress(() => {
      router.push({
        pathname: "/restaurant/[id]/reviews",
        params: { id: id! },
      });
    });
  }, [router, id, handleQuickActionPress]);

  const handleViewMenu = useCallback(() => {
    if (!restaurant) return;
    handleQuickActionPress(() => {
      router.push(`/restaurant/menu/${restaurant.id}`);
    });
  }, [router, restaurant?.id, handleQuickActionPress]);

  const { handlePress: handleModalPress } = useModalPress();

  const handleImagePress = useCallback(
    (index: number) => {
      handleModalPress(() => {
        setSelectedImageIndex(index);
        setShowImageGallery(true);
      });
    },
    [handleModalPress],
  );

  // Loading and Error States
  if (loading) {
    return <RestaurantDetailsScreenSkeleton />;
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

  return (
    <View className="flex-1 bg-background">
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-50">
        <SafeAreaView edges={["top"]}>
          <View className="p-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      {/* Favorite, Playlist, and Share Buttons - Outside ScrollView for proper touch handling */}
      <View className="absolute top-20 right-4 flex-row gap-3 z-50">
        <Pressable
          onPress={handleShare}
          className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ elevation: 10, zIndex: 50 }}
        >
          <Share2 size={20} color="white" />
        </Pressable>
        <Pressable
          onPress={handleToggleFavorite}
          className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ elevation: 10, zIndex: 50 }}
        >
          <Heart
            size={20}
            color={isFavorite ? "#ef4444" : "white"}
            fill={isFavorite ? "#ef4444" : "none"}
          />
        </Pressable>
        <Pressable
          onPress={handleAddToPlaylist}
          className="w-12 h-12 bg-black/60 rounded-full items-center justify-center shadow-lg backdrop-blur-sm"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ elevation: 10, zIndex: 50 }}
        >
          <FolderPlus size={20} color="white" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        className="mb-40"
      >
        <ImageGallery
          images={allImages}
          onImagePress={handleImagePress}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onAddToPlaylist={handleAddToPlaylist}
        />

        {/* 1. Name, cuisine, etc. */}
        <RestaurantHeaderInfo restaurant={restaurant} restaurantId={id!} />

        {/* 2. Quick Actions - Contact, Website, Menu */}
        <QuickActionsSection
          restaurant={restaurant}
          onCall={() => handleCall(restaurant)}
          onWebsite={handleWebsite}
          onViewMenu={handleViewMenu}
        />

        {/* 3. Hours */}
        <View className="px-4 py-3 border-b border-border/50">
          <RestaurantHoursDisplay restaurantId={restaurant.id} />
        </View>

        {/* 4. Location */}
        <LocationMap restaurant={restaurant} />

        {/* 5. About and Features */}
        <AboutSection restaurant={restaurant} />
        <FeaturesSection restaurant={restaurant} />
        <RestaurantLoyaltyRules restaurantId={id as string} />

        {/* 6. Reviews */}
        <ReviewsSummary
          restaurant={restaurant}
          reviews={reviews}
          onViewAllReviews={handleViewAllReviews}
          onWriteReview={handleWriteReview}
        />

        {/* <RestaurantPosts
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        /> */}
      </ScrollView>

      {/* Floating Book Button - No BookingWidget */}
      <View className="absolute bottom-0 left-0 right-0 mt-5">
        <SafeAreaView edges={["bottom"]}>
          <View className="p-4 bg-background border-t border-border">
            {/* Booking Policy Info */}
            {(restaurant as any).booking_policy === "request" && (
              <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-3">
                <View className="flex-row items-center gap-2">
                  <Timer size={16} color="#f97316" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Request Booking Restaurant
                    </Text>
                    <Text className="text-xs text-orange-700 dark:text-orange-300">
                      Submit a request • Response within 2 hours
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Button
              onPress={handleAttemptBooking}
              size="lg"
              className="w-full"
              variant={bookingEligibility.isEligible ? "default" : "secondary"}
              disabled={!bookingEligibility.isEligible}
            >
              <View className="flex-row items-center justify-center gap-2">
                {!bookingEligibility.isEligible ? (
                  <>
                    <Calendar size={20} color="#666" />
                    <Text className="text-muted-foreground font-bold text-lg">
                      {bookingEligibility.actionText || "Not Available"}
                    </Text>
                  </>
                ) : (restaurant as any).booking_policy === "request" ? (
                  <>
                    <Send size={20} color="white" />
                    <Text className="text-white font-bold text-lg">
                      Request a Table
                    </Text>
                  </>
                ) : (
                  <>
                    <Calendar size={20} color="white" />
                    <Text className="text-white font-bold text-lg">
                      Book a Table
                    </Text>
                  </>
                )}
              </View>
            </Button>

            {/* Instant Booking Badge */}
            {(restaurant as any).booking_policy === "instant" && (
              <View className="flex-row items-center justify-center gap-2 mt-2">
                <CheckCircle size={14} color="#10b981" />
                <Text className="text-xs text-muted-foreground">
                  Instant confirmation available
                </Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Modals */}
      {!isGuest && restaurant && (
        <AddToPlaylistModal
          visible={showAddToPlaylist}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          onClose={() => setShowAddToPlaylist(false)}
          onSuccess={handleAddToPlaylistSuccess}
        />
      )}

      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={handleClosePrompt}
        onSignUp={handleSignUpFromPrompt}
        featureName={promptedFeature}
      />

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        visible={showImageGallery}
        images={allImages}
        initialIndex={selectedImageIndex}
        onClose={() => setShowImageGallery(false)}
      />

      {/* Share Modal */}
      {restaurant && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          title={`Share ${restaurant.name}`}
          description="Share this restaurant with your friends"
          shareOptions={{
            url: `https://plate-app.com/restaurant/${restaurant.id}`,
            title: restaurant.name,
            message: `Check out ${restaurant.name} on Plate! ${restaurant.cuisine_type} • ${"$".repeat(restaurant.price_range || 2)}`,
            subject: `${restaurant.name} - Plate`,
          }}
          customActions={[
            {
              id: "share-menu",
              title: "Share Menu",
              description: "Share the restaurant's menu",
              icon: BookOpen,
              onPress: async () => {
                await shareRestaurantMenu(restaurant.id, restaurant.name);
              },
            },
          ]}
        />
      )}
    </View>
  );
}
