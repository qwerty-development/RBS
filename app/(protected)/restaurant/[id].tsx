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
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P } from "@/components/ui/typography";
import { Image } from "@/components/image";

import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { useRestaurant } from "@/hooks/useRestaurant";
import { RestaurantPlaylistIndicator } from "@/components/restaurant/RestaurantPlaylistIndicator";
import RestaurantDetailsScreenSkeleton from "@/components/skeletons/RestaurantDetailsScreenSkeleton";

// Type definitions (Unchanged)
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(SCREEN_HEIGHT * 0.4, 320);

// --- New Guest Prompt Modal ---
const GuestPromptModal = ({
  visible,
  onClose,
  onConfirm,
  feature,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  feature: string;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/60">
        <View className="bg-background w-4/5 rounded-2xl p-6 items-center">
          <H3 className="mb-2 text-center">Join to Unlock!</H3>
          <P className="text-muted-foreground text-center mb-6">
            Please sign up or log in to {feature}.
          </P>
          <Button onPress={onConfirm} className="w-full mb-3" size="lg">
            <Text className="font-bold text-white">Continue</Text>
          </Button>
          <Button onPress={onClose} variant="ghost" className="w-full">
            <Text>Not Now</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
};

// --- Sub-components (Unchanged) ---
const ImageGallery: React.FC<{
  /* ...props... */
}> = ({ images, onImagePress }) => {
  /* ...your existing component... */
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
const QuickActionsBar: React.FC<{
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onCall: () => void;
  onDirections: () => void;
  onAddToPlaylist: () => void; // MODIFIED: Renamed for clarity
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
  /* ...your existing component... */
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
      <Pressable
        onPress={onAddToPlaylist} // MODIFIED
        className="items-center gap-1 p-2"
      >
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

      <Pressable onPress={onDirections} className="items-center gap-1 p-2">
        <Navigation size={24} color="#666" />
        <Text className="text-xs text-muted-foreground">Directions</Text>
      </Pressable>
    </View>
  );
};
const RestaurantHeaderInfo: React.FC<{
  restaurant: Restaurant;
}> = ({ restaurant }) => {
  /* ...your existing component... */
  const isOpen = () => {
    return true;
  };

  return (
    <View className="p-4 bg-background">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <H1 className="text-2xl font-bold mb-1">{restaurant.name}</H1>
          <Text className="text-muted-foreground">
            {restaurant.cuisine_type}
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
        <View className="flex-row items-center gap-1">
          <MapPin size={14} color="#666" />
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {restaurant.location}
          </Text>
        </View>

        <Text className="text-muted-foreground">•</Text>

        <Text className="text-sm text-muted-foreground">
          {"$".repeat(restaurant.price_range || 2)}
        </Text>
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
const AboutSection: React.FC<{
  /* ...props... */
}> = ({ restaurant }) => {
  /* ...your existing component... */
  const [showFullDescription, setShowFullDescription] = useState(false);

  if (!restaurant.description) return null;

  const shouldTruncate = restaurant.description.length > 150;
  const displayText =
    shouldTruncate && !showFullDescription
      ? restaurant.description.substring(0, 150) + "..."
      : restaurant.description;

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">About</H3>
      <Text className="text-muted-foreground leading-6 mb-2">
        {displayText}
      </Text>
      {shouldTruncate && (
        <Pressable onPress={() => setShowFullDescription(!showFullDescription)}>
          <Text className="text-primary font-medium">
            {showFullDescription ? "Show less" : "Read more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
const FeaturesSection: React.FC<{
  /* ...props... */
}> = ({ restaurant }) => {
  /* ...your existing component... */
  const features = [];

  if (restaurant.parking_available) features.push("Parking available");
  if (restaurant.outdoor_seating) features.push("Outdoor seating");
  if (restaurant.dietary_options?.includes("vegetarian"))
    features.push("Vegetarian options");
  if (restaurant.dietary_options?.includes("vegan"))
    features.push("Vegan options");

  if (features.length === 0) return null;

  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Features</H3>
      <View className="flex-row flex-wrap gap-2">
        {features.map((feature, index) => (
          <View key={index} className="bg-primary/10 px-3 py-2 rounded-lg">
            <Text className="text-primary text-sm font-medium">{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
const MenuSection: React.FC<{
  /* ...props... */
}> = ({ restaurantId, onViewMenu }) => {
  /* ...your existing component... */
  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Menu</H3>
      <Pressable
        onPress={onViewMenu}
        className="bg-primary/10 p-4 rounded-lg flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-3">
          <BookOpen size={24} className="text-primary" />
          <View>
            <Text className="font-semibold text-foreground">Browse Menu</Text>
            <Text className="text-sm text-muted-foreground">
              View dishes, prices, and dietary options
            </Text>
          </View>
        </View>
        <ChevronRight size={20} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
};
const ContactInfo: React.FC<{
  /* ...props... */
}> = ({ restaurant, onCall, onWebsite }) => {
  /* ...your existing component... */
  return (
    <View className="p-4 border-b border-border">
      <H3 className="mb-3">Contact & Info</H3>

      {restaurant.phone_number && (
        <Pressable
          onPress={onCall}
          className="flex-row items-center gap-3 p-3 rounded-lg bg-muted/30 mb-3"
        >
          <Phone size={20} color="#3b82f6" />
          <View className="flex-1">
            <Text className="font-medium">Call restaurant</Text>
            <Text className="text-sm text-muted-foreground">
              {restaurant.phone_number}
            </Text>
          </View>
          <ChevronRight size={20} color="#666" />
        </Pressable>
      )}

      {restaurant.website_url && (
        <Pressable
          onPress={onWebsite}
          className="flex-row items-center gap-3 p-3 rounded-lg bg-muted/30"
        >
          <Globe size={20} color="#3b82f6" />
          <View className="flex-1">
            <Text className="font-medium">Visit website</Text>
            <Text className="text-sm text-muted-foreground">
              View menu and more info
            </Text>
          </View>
          <ExternalLink size={16} color="#666" />
        </Pressable>
      )}
    </View>
  );
};
const LocationMap: React.FC<{
  /* ...props... */
}> = ({ restaurant, onDirections }) => {
  /* ...your existing component... */
  const coordinates = {
    latitude: 33.8938, // Default to Beirut
    longitude: 35.5018,
  };

  return (
    <View className="p-4 border-b border-border">
      <View className="flex-row items-center justify-between mb-3">
        <H3>Location</H3>
        <Pressable
          onPress={onDirections}
          className="flex-row items-center gap-1"
        >
          <Text className="text-primary font-medium">Directions</Text>
          <Navigation size={16} color="#3b82f6" />
        </Pressable>
      </View>

      <View className="rounded-lg overflow-hidden h-48 mb-3">
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            ...coordinates,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={coordinates} />
        </MapView>
      </View>

      <Text className="text-muted-foreground">{restaurant.location}</Text>
    </View>
  );
};
const ReviewsSummary: React.FC<{
  /* ...props... */
}> = ({ restaurant, reviews, onViewAllReviews }) => {
  /* ...your existing component... */
  return (
    <View className="p-4 border-b border-border mb-7">
      <View className="flex-row items-center justify-between mb-3">
        <H3>Reviews</H3>
        <Pressable
          onPress={onViewAllReviews}
          className="flex-row items-center gap-1"
        >
          <Text className="text-primary font-medium">See all</Text>
          <ChevronRight size={16} color="#3b82f6" />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-4 mb-4">
        <View className="items-center">
          <Text className="text-3xl font-bold">
            {restaurant.average_rating?.toFixed(1) || "4.5"}
          </Text>
          <View className="flex-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                color="#f59e0b"
                fill={
                  star <= (restaurant.average_rating || 4.5)
                    ? "#f59e0b"
                    : "none"
                }
              />
            ))}
          </View>
          <Text className="text-sm text-muted-foreground">
            {restaurant.total_reviews || 0} reviews
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-sm text-muted-foreground mb-1">
            {restaurant.review_summary?.recommendation_percentage || 95}% would
            recommend
          </Text>
          <View className="bg-muted rounded-full h-2">
            <View
              className="bg-green-500 h-2 rounded-full"
              style={{
                width: `${
                  restaurant.review_summary?.recommendation_percentage || 95
                }%`,
              }}
            />
          </View>
        </View>
      </View>

      {reviews.slice(0, 2).map((review) => (
        <View key={review.id} className="mb-3 last:mb-0">
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
              <Text className="text-sm font-medium text-primary">
                {review.user.full_name.charAt(0)}
              </Text>
            </View>
            <Text className="font-medium">{review.user.full_name}</Text>
            <View className="flex-row">
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
      ))}
    </View>
  );
};
// Main Component
export default function RestaurantDetailsScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;

  // --- MODIFIED: Auth and Guest State ---
  const { user, isGuest, convertGuestToUser } = useAuth();
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [promptedFeature, setPromptedFeature] = useState("");

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

  // --- NEW: Guest Guard Logic ---
  const runProtectedAction = (callback: () => void, featureName: string) => {
    if (isGuest) {
      setPromptedFeature(featureName);
      setShowGuestPrompt(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (user) {
      callback();
    } else {
      // Fallback for an unlikely state where user is not a guest but also not logged in.
      router.push("/welcome");
    }
  };

  const handleConfirmGuestPrompt = async () => {
    setShowGuestPrompt(false);
    await convertGuestToUser();
    // The AuthProvider will automatically handle redirecting to the /welcome screen
  };

  // --- MODIFIED: Action Handlers with Guest Guards ---
  const handleToggleFavorite = () => {
    runProtectedAction(toggleFavorite, "save restaurants");
  };

  const handleAddToPlaylist = () => {
    runProtectedAction(
      () => setShowAddToPlaylist(true),
      "add restaurants to a playlist",
    );
  };

  const handleAttemptBooking = () => {
    runProtectedAction(handleBookTable, "book a table");
  };

  // Unchanged handlers
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
  }, [restaurant?.main_image_url, restaurant?.image_urls]);

  const handleWebsite = useCallback(() => {
    if (restaurant?.website_url) {
      // Your existing logic to open website
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
          <View className="flex-row items-center justify-between p-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="w-10 h-10 bg-black/50 rounded-full items-center justify-center"
            >
              <Share size={20} color="white" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageGallery images={allImages} onImagePress={() => {}} />

        {/* --- MODIFIED: Pass guarded actions --- */}
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

        {/* --- MODIFIED: Conditionally render playlist indicator --- */}
        {!isGuest && <RestaurantPlaylistIndicator restaurantId={restaurant.id} />}

        <AboutSection restaurant={restaurant} />
        <FeaturesSection restaurant={restaurant} />
        <ContactInfo
          restaurant={restaurant}
          onCall={() => handleCall(restaurant)}
          onWebsite={handleWebsite}
        />
        <MenuSection restaurantId={restaurant.id} onViewMenu={handleViewMenu} />
        <LocationMap
          restaurant={restaurant}
          onDirections={() => openDirections(restaurant)}
        />
        <ReviewsSummary
          restaurant={restaurant}
          reviews={reviews}
          onViewAllReviews={handleViewAllReviews}
        />
        <RestaurantPosts
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
        />

        <View className="h-24" />
      </ScrollView>

      {/* Floating Book Button --- MODIFIED with guest guard --- */}
      <View className="absolute bottom-0 left-0 right-0 mt-5">
        <SafeAreaView edges={["bottom"]}>
          <View className="p-4 bg-background border-t border-border">
            <Button
              onPress={handleAttemptBooking} // Use the guarded handler
              size="lg"
              className="w-full"
            >
              <View className="flex-row items-center justify-center gap-2">
                <Calendar size={20} color="white" />
                <Text className="text-white font-bold text-lg">
                  Book a Table
                </Text>
              </View>
            </Button>
          </View>
        </SafeAreaView>
      </View>

      {/* --- MODIFIED: Add modals to the layout --- */}
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
        onClose={() => setShowGuestPrompt(false)}
        onConfirm={handleConfirmGuestPrompt}
        feature={promptedFeature}
      />
    </View>
  );
}