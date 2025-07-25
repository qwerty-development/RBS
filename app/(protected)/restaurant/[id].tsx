// app/(protected)/restaurant/[id].tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  BookOpen,
  FolderPlus,
  ChevronLeft,
  Share,
  Heart,
  Star,
  MapPin,
  Clock,
  Phone,
  Globe,
  Calendar,
  ChevronRight,
  Camera,
  ExternalLink,
  Navigation,
  Edit3,
  Car,
  Utensils,
  Leaf,
  TreePine,
  CheckCircle,
  Send,
  Timer,
} from "lucide-react-native";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MapView, { Marker } from "react-native-maps";
import { RestaurantPosts } from "@/components/restaurant/RestaurantPosts";
import { AddToPlaylistModal } from "@/components/playlists/AddToPlaylistModal";
import { GuestPromptModal } from "@/components/guest/GuestPromptModal";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import {
  postgisToAddress,
  parsePostGISGeometry,
} from "../../../lib/locationConverter";
import { RestaurantLoyaltyRules } from '@/components/booking/LoyaltyPointsDisplay';
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useRestaurant } from "@/hooks/useRestaurant";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { RestaurantPlaylistIndicator } from "@/components/restaurant/RestaurantPlaylistIndicator";
import RestaurantDetailsScreenSkeleton from "@/components/skeletons/RestaurantDetailsScreenSkeleton";
import { Database } from "@/types/supabase";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[] | null;
  ambiance_tags?: string[] | null;
  parking_available?: boolean | null;
  outdoor_seating?: boolean | null;
  average_rating?: number | null;
  total_reviews?: number | null;
  review_summary?: {
    average_rating: number;
    total_reviews: number;
    recommendation_percentage: number;
  } | null;
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

// Custom hook for restaurant location
const useRestaurantLocation = (postgisGeometry: string | null) => {
  const [address, setAddress] = useState<string>("Loading...");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (postgisGeometry) {
      setIsLoading(true);

      // First get coordinates for map
      try {
        const coords = parsePostGISGeometry(postgisGeometry);

        if (coords && !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
          const coordinatesObj = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          setCoordinates(coordinatesObj);
        }
      } catch (error) {
        console.error("Error parsing coordinates:", error);
      }

      // Then get readable address
      postgisToAddress(postgisGeometry)
        .then((result) => {
          setAddress(result);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Address error:", error);
          setAddress("Location unavailable");
          setIsLoading(false);
        });
    } else {
      setAddress("No location data");
      setIsLoading(false);
    }
  }, [postgisGeometry]);

  return { address, coordinates, isLoading };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.4, 320);

// Image Gallery Component
const ImageGallery: React.FC<{
  images: string[];
  onImagePress: (index: number) => void;
}> = ({ images, onImagePress }) => {
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
      <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
        <View className="flex-row bg-black/50 rounded-full px-3 py-1 gap-1">
          {images.map((_, index) => (
            <View
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === activeIndex ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </View>
      </View>

      {/* Camera Button */}
      <Pressable
        onPress={() => onImagePress(activeIndex)}
        className="absolute bottom-4 right-4 bg-black/50 rounded-full p-3"
      >
        <Camera size={20} color="white" />
      </Pressable>
    </View>
  );
};

// Quick Actions Bar
const QuickActionsBar: React.FC<{
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onCall: () => void;
  onDirections: () => void;
  onAddToPlaylist: () => void;
  colorScheme: any;
}> = ({
  restaurant,
  isFavorite,
  onToggleFavorite,
  onShare,
  onCall,
  onDirections,
  onAddToPlaylist,
  colorScheme,
}) => {
  return (
    <View className="flex-row justify-around py-4 border-b border-border bg-background">
      <Pressable onPress={onToggleFavorite} className="items-center gap-1 p-2">
        <Heart
          size={24}
          color={isFavorite ? "#ef4444" : "#666"}
          fill={isFavorite ? "#ef4444" : "none"}
        />
        <Text className="text-xs text-muted-foreground">
          {isFavorite ? "Saved" : "Save"}
        </Text>
      </Pressable>
      <Pressable onPress={onAddToPlaylist} className="items-center gap-1 p-2">
        <FolderPlus
          size={24}
          color={colorScheme === "dark" ? "#fff" : "#000"}
        />
        <Text className="text-xs text-muted-foreground">Add</Text>
      </Pressable>

      <Pressable onPress={onShare} className="items-center gap-1 p-2">
        <Share size={24} color="#666" />
        <Text className="text-xs text-muted-foreground">Share</Text>
      </Pressable>

      {restaurant.phone_number && (
        <Pressable onPress={onCall} className="items-center gap-1 p-2">
          <Phone size={24} color="#666" />
          <Text className="text-xs text-muted-foreground">Call</Text>
        </Pressable>
      )}
    </View>
  );
};

// Restaurant Header Info
const RestaurantHeaderInfo: React.FC<{ restaurant: Restaurant }> = ({
  restaurant,
}) => {
  const { address, isLoading } = useRestaurantLocation(restaurant.location);

  const isOpen = () => {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();

    if (restaurant.opening_time && restaurant.closing_time) {
      const openTime = parseInt(restaurant.opening_time.replace(":", ""));
      const closeTime = parseInt(restaurant.closing_time.replace(":", ""));

      if (closeTime < openTime) {
        // Crosses midnight
        return currentTime >= openTime || currentTime <= closeTime;
      } else {
        return currentTime >= openTime && currentTime <= closeTime;
      }
    }

    return true; // Default to open if no hours specified
  };

  return (
    <View className="p-4 bg-background">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <H1 className="text-2xl font-bold mb-1">{restaurant.name}</H1>
          <Text className="text-muted-foreground">
            {restaurant.cuisine_type} •{" "}
            {"$".repeat(restaurant.price_range || 2)}
          </Text>
        </View>

        <View className="items-end">
          <View className="flex-row items-center gap-1 mb-1">
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text className="font-semibold">
              {restaurant.average_rating?.toFixed(1) || "4.5"}
            </Text>
            <Text className="text-muted-foreground">
              ({restaurant.total_reviews || 0})
            </Text>
          </View>
          <View
            className={`px-2 py-1 rounded-full ${
              isOpen() ? "bg-green-100" : "bg-red-100"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                isOpen() ? "text-green-800" : "text-red-800"
              }`}
            >
              {isOpen() ? "Open now" : "Closed"}
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

      {restaurant.ambiance_tags && restaurant.ambiance_tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {restaurant.ambiance_tags.slice(0, 3).map((tag, index) => (
            <View key={index} className="bg-muted/50 px-2 py-1 rounded-full">
              <Text className="text-xs text-muted-foreground">{tag}</Text>
            </View>
          ))}
        </View>
      )}
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

// Menu Section
const MenuSection: React.FC<{ onViewMenu: () => void }> = ({ onViewMenu }) => {
  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-3 text-foreground">Menu</Text>
      <Pressable
        onPress={onViewMenu}
        className="flex-row items-center justify-between p-3 border border-border rounded-xl"
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center">
            <BookOpen size={18} color="#3b82f6" />
          </View>
          <View>
            <Text className="text-sm font-medium text-foreground">
              Browse Menu
            </Text>
            <Text className="text-xs text-muted-foreground">
              View dishes & prices
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color="#666" />
      </Pressable>
    </View>
  );
};

// Contact Info
const ContactInfo: React.FC<{
  restaurant: Restaurant;
  onCall: () => void;
  onWebsite: () => void;
}> = ({ restaurant, onCall, onWebsite }) => {
  return (
    <View className="px-4 py-3 border-b border-border/50">
      <Text className="text-base font-semibold mb-3 text-foreground">
        Contact
      </Text>

      <View className="gap-2">
        {restaurant.phone_number && (
          <Pressable
            onPress={onCall}
            className="flex-row items-center gap-3 p-3 rounded-xl border border-border"
          >
            <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
              <Phone size={16} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Call</Text>
              <Text className="text-xs text-muted-foreground">
                {restaurant.phone_number}
              </Text>
            </View>
            <ChevronRight size={16} color="#666" />
          </Pressable>
        )}

        {restaurant.website_url && (
          <Pressable
            onPress={onWebsite}
            className="flex-row items-center gap-3 p-3 rounded-xl border border-border"
          >
            <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
              <Globe size={16} color="#3b82f6" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">
                Website
              </Text>
              <Text className="text-xs text-muted-foreground">
                View online menu
              </Text>
            </View>
            <ExternalLink size={14} color="#666" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

// Location Map
const LocationMap: React.FC<{
  restaurant: Restaurant;
  onDirections: () => void;
}> = ({ restaurant, onDirections }) => {
  const { address, coordinates, isLoading } = useRestaurantLocation(
    restaurant.location,
  );
  const [mapReady, setMapReady] = useState(false);

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
        <Pressable
          onPress={onDirections}
          className="flex-row items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full"
        >
          <Navigation size={14} color="#3b82f6" />
          <Text className="text-primary text-sm font-medium">Directions</Text>
        </Pressable>
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
          onMapReady={() => setMapReady(true)}
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
            {restaurant.average_rating?.toFixed(1) || "4.5"}
          </Text>
          <View className="flex-row mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={14}
                color="#f59e0b"
                fill={
                  star <= (restaurant.average_rating || 4.5)
                    ? "#f59e0b"
                    : "none"
                }
              />
            ))}
          </View>
          <Text className="text-xs text-muted-foreground">
            {restaurant.total_reviews || 0} reviews
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-xs text-muted-foreground mb-1">
            {restaurant.review_summary?.recommendation_percentage || 95}%
            recommend
          </Text>
          <View className="bg-border rounded-full h-1.5">
            <View
              className="bg-green-500 h-1.5 rounded-full"
              style={{
                width: `${
                  restaurant.review_summary?.recommendation_percentage || 95
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
                  {review.user.full_name.charAt(0)}
                </Text>
              </View>
              <Text className="text-sm font-medium text-foreground">
                {review.user.full_name}
              </Text>
              <View className="flex-row ml-auto">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={12}
                    color="#f59e0b"
                    fill={star <= review.overall_rating ? "#f59e0b" : "none"}
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;

  // State for non-protected UI elements
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

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
    handleShare,
    handleCall,
    openDirections,
  } = useRestaurant(id);

  // Action Handlers with Guest Guard
  const handleToggleFavorite = useCallback(() => {
    runProtectedAction(toggleFavorite, "save restaurants");
  }, [runProtectedAction, toggleFavorite]);

  const handleAddToPlaylist = useCallback(() => {
    runProtectedAction(
      () => setShowAddToPlaylist(true),
      "add restaurants to a playlist",
    );
  }, [runProtectedAction]);

  const handleWriteReview = useCallback(() => {
    if (!restaurant) return;
    runProtectedAction(
      () => router.push(`/restaurant/${restaurant.id}/write-review`),
      "write a review",
    );
  }, [runProtectedAction, router, restaurant]);

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
    runProtectedAction(handleBookTable, "book a table");
  }, [runProtectedAction, handleBookTable]);

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
    const images = [restaurant.main_image_url];
    if (Array.isArray(restaurant.image_urls)) {
      images.push(...restaurant.image_urls);
    }
    return images.filter(Boolean) as string[];
  }, [restaurant]);

  const handleWebsite = useCallback(() => {
    if (restaurant?.website_url) {
      // Logic to open website
    }
  }, [restaurant?.website_url]);

  const handleViewAllReviews = useCallback(() => {
    router.push({
      pathname: "/restaurant/[id]/reviews",
      params: { id: id! },
    });
  }, [router, id]);

  const handleViewMenu = useCallback(() => {
    if (!restaurant) return;
    router.push(`/restaurant/menu/${restaurant.id}`);
  }, [router, restaurant?.id]);

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <ImageGallery images={allImages} onImagePress={() => {}} />

        <QuickActionsBar
          restaurant={restaurant}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onShare={handleShare}
          onCall={() => handleCall(restaurant)}
          onDirections={() => openDirections(restaurant)}
          colorScheme={colorScheme}
          onAddToPlaylist={handleAddToPlaylist}
        />

        <RestaurantHeaderInfo restaurant={restaurant} />

        {!isGuest && (
          <RestaurantPlaylistIndicator restaurantId={restaurant.id} />
        )}

        <AboutSection restaurant={restaurant} />
        <FeaturesSection restaurant={restaurant} />
        <RestaurantLoyaltyRules restaurantId={id as string} />
        <ContactInfo
          restaurant={restaurant}
          onCall={() => handleCall(restaurant)}
          onWebsite={handleWebsite}
        />
        <MenuSection onViewMenu={handleViewMenu} />
        <LocationMap
          restaurant={restaurant}
          onDirections={() => openDirections(restaurant)}
        />
        <ReviewsSummary
          restaurant={restaurant}
          reviews={reviews}
          onViewAllReviews={handleViewAllReviews}
          onWriteReview={handleWriteReview}
        />
        <RestaurantPosts
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        />

        <View className="h-24" />
      </ScrollView>

      {/* Floating Book Button */}
      <View className="absolute bottom-0 left-0 right-0 mt-5">
        <SafeAreaView edges={["bottom"]}>
          <View className="p-4 bg-background border-t border-border">
            {/* Booking Policy Info */}
            {restaurant.booking_policy === "request" && (
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

            <Button onPress={handleAttemptBooking} size="lg" className="w-full">
              <View className="flex-row items-center justify-center gap-2">
                {restaurant.booking_policy === "request" ? (
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
            {restaurant.booking_policy === "instant" && (
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
    </View>
  );
}
