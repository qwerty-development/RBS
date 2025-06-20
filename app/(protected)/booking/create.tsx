// app/(protected)/booking/create.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Gift,
  ChevronLeft,
  Info,
  CheckCircle,
  Utensils,
  Star,
  Trophy,
  Tag,
  Sparkles,
  Crown,
  Award,
  X,
  AlertCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Enhanced Type Definitions
interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

interface UserOfferWithDetails {
  id: string; // user_offer id
  user_id: string;
  offer_id: string; // special_offer id
  claimed_at: string;
  used_at?: string;
  expires_at: string;
  special_offer: {
    id: string;
    title: string;
    description: string;
    discount_percentage: number;
    valid_until: string;
    restaurant_id: string;
    minimum_party_size?: number;
    terms_conditions?: string[];
  };
}

// Tier Configuration
const TIER_CONFIG = {
  bronze: {
    name: "Bronze",
    color: "#CD7F32",
    icon: Award,
    pointsMultiplier: 1,
  },
  silver: {
    name: "Silver", 
    color: "#C0C0C0",
    icon: Star,
    pointsMultiplier: 1.1,
  },
  gold: {
    name: "Gold",
    color: "#FFD700", 
    icon: Crown,
    pointsMultiplier: 1.2,
  },
  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    icon: Sparkles,
    pointsMultiplier: 1.5,
  },
} as const;

type TierType = keyof typeof TIER_CONFIG;

// Form Validation Schema
const bookingFormSchema = z.object({
  specialRequests: z.string().max(500, "Maximum 500 characters").optional(),
  occasion: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).default([]),
  tablePreferences: z.array(z.string()).default([]),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "You must accept the booking terms"),
});

// Configuration Constants
const OCCASIONS = [
  { id: "none", label: "No Special Occasion", icon: null },
  { id: "birthday", label: "Birthday", icon: "🎂" },
  { id: "anniversary", label: "Anniversary", icon: "💑" },
  { id: "business", label: "Business Meeting", icon: "💼" },
  { id: "date", label: "Date Night", icon: "❤️" },
  { id: "engagement", label: "Engagement", icon: "💍" },
  { id: "graduation", label: "Graduation", icon: "🎓" },
  { id: "other", label: "Other Celebration", icon: "🎉" },
];

const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan", 
  "Halal Only",
  "Gluten-Free",
  "Nut Allergy",
  "Dairy-Free",
  "Shellfish Allergy",
  "Kosher",
];

const TABLE_PREFERENCES = [
  "Window Seat",
  "Outdoor Seating",
  "Quiet Area",
  "Near Bar",
  "Private Room",
  "High Chair Needed",
  "Wheelchair Accessible",
];

// Custom Textarea Component
const CustomTextarea: React.FC<{
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  numberOfLines?: number;
  maxLength?: number;
}> = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  description, 
  error,
  numberOfLines = 4,
  maxLength
}) => {
  return (
    <View className="mb-4">
      <Text className="font-medium text-base mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        className={`border-2 rounded-lg px-4 py-3 text-base ${
          error ? "border-red-500" : "border-border"
        } bg-background text-foreground`}
        placeholderTextColor="#9ca3af"
        style={{ height: numberOfLines * 24 + 24, textAlignVertical: 'top' }}
      />
      {description && (
        <Text className="text-sm text-muted-foreground mt-1">{description}</Text>
      )}
      {maxLength && (
        <Text className="text-xs text-muted-foreground mt-1">
          {value.length}/{maxLength} characters
        </Text>
      )}
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
};

// Loyalty Tier Display Component
const LoyaltyTierDisplay: React.FC<{
  userTier: TierType;
  userPoints: number;
  earnablePoints: number;
}> = ({ userTier, userPoints, earnablePoints }) => {
  const tierConfig = TIER_CONFIG[userTier] || TIER_CONFIG.bronze;
  const IconComponent = tierConfig.icon;

  return (
    <View className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Trophy size={20} color="#f59e0b" />
          <Text className="font-bold text-lg text-amber-800 dark:text-amber-200">
            Loyalty Rewards
          </Text>
        </View>
        <View className="flex-row items-center bg-amber-200 dark:bg-amber-800 px-3 py-1 rounded-full">
          <IconComponent size={14} color={tierConfig.color} />
          <Text className="font-bold text-sm ml-1 text-amber-800 dark:text-amber-200">
            {tierConfig.name.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-amber-700 dark:text-amber-300">You'll earn</Text>
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-amber-800 dark:text-amber-200">
              +{earnablePoints}
            </Text>
            <Text className="text-sm text-amber-700 dark:text-amber-300 ml-1">points</Text>
          </View>
        </View>
        
        <View className="items-end">
          <Text className="text-sm text-amber-700 dark:text-amber-300">Current balance</Text>
          <Text className="text-lg font-bold text-amber-800 dark:text-amber-200">
            {userPoints} pts
          </Text>
        </View>
      </View>
      
      <Text className="text-xs text-amber-700 dark:text-amber-300 mt-2">
        Points are automatically awarded after your successful dining experience
      </Text>
    </View>
  );
};

// Enhanced Offer Card Component
const OfferCard: React.FC<{
  offer: UserOfferWithDetails;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  partySize: number;
}> = ({ offer, isSelected, onSelect, onDeselect, partySize }) => {
  const formatDate = useCallback((dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Soon";
    }
  }, []);

  // Check if offer is valid for current party size
  const isValidForPartySize = !offer.special_offer.minimum_party_size || 
    partySize >= offer.special_offer.minimum_party_size;

  // Check if offer is expired
  const isExpired = new Date(offer.expires_at) < new Date();

  const canUse = isValidForPartySize && !isExpired && !offer.used_at;

  return (
    <Pressable
      onPress={canUse ? (isSelected ? onDeselect : onSelect) : undefined}
      className={`border-2 rounded-xl p-4 ${
        !canUse 
          ? "border-gray-300 bg-gray-50 dark:bg-gray-900/50 opacity-60"
          : isSelected 
            ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
            : "border-border bg-card"
      }`}
    >
      {/* Header with discount badge */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="font-bold text-lg mb-1" numberOfLines={1}>
            {offer.special_offer.title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {offer.special_offer.description}
          </Text>
        </View>
        
        <View className="relative">
          <View className={`rounded-full h-12 w-12 items-center justify-center ${
            canUse ? "bg-green-500" : "bg-gray-400"
          }`}>
            <Text className="text-white font-bold text-lg">
              {offer.special_offer.discount_percentage}
            </Text>
            <Text className="text-white text-xs -mt-1">%</Text>
          </View>
          
          {isSelected && canUse && (
            <View className="absolute -top-1 -right-1 bg-green-600 rounded-full p-1">
              <CheckCircle size={16} color="white" />
            </View>
          )}
        </View>
      </View>

      {/* Validation messages */}
      {!canUse && (
        <View className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <View className="flex-row items-center gap-2">
            <AlertCircle size={16} color="#dc2626" />
            <Text className="text-sm text-red-700 dark:text-red-300">
              {isExpired 
                ? "This offer has expired"
                : !isValidForPartySize 
                  ? `Minimum ${offer.special_offer.minimum_party_size} guests required`
                  : offer.used_at 
                    ? "This offer has already been used" 
                    : "Cannot use this offer"
              }
            </Text>
          </View>
        </View>
      )}

      {/* Offer details */}
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">
          Expires {formatDate(offer.expires_at)}
        </Text>
        
        <View className="bg-muted/50 rounded px-2 py-1">
          <Text className="text-xs font-mono">
            Code: {offer.id.slice(-6).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Minimum party size info */}
      {offer.special_offer.minimum_party_size && offer.special_offer.minimum_party_size > 1 && (
        <View className="mt-2 flex-row items-center gap-2">
          <Users size={14} color="#666" />
          <Text className="text-xs text-muted-foreground">
            Minimum {offer.special_offer.minimum_party_size} guests
          </Text>
        </View>
      )}

      {isSelected && canUse && (
        <View className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Text className="text-green-800 dark:text-green-200 text-sm font-medium">
            ✓ This offer will be applied to your booking
          </Text>
        </View>
      )}
    </Pressable>
  );
};

// Offers Selection Section
const OffersSelection: React.FC<{
  availableOffers: UserOfferWithDetails[];
  selectedOfferUserId: string | null;
  onSelectOffer: (userOfferId: string | null) => void;
  partySize: number;
}> = ({ availableOffers, selectedOfferUserId, onSelectOffer, partySize }) => {
  if (availableOffers.length === 0) {
    return null; // Don't show anything if no offers
  }

  // Filter valid offers for this party size
  const validOffers = availableOffers.filter(offer => 
    !offer.used_at && 
    new Date(offer.expires_at) > new Date() &&
    (!offer.special_offer.minimum_party_size || partySize >= offer.special_offer.minimum_party_size)
  );

  return (
    <View className="bg-card border border-border rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3">
          <Gift size={20} color="#10b981" />
          <Text className="font-bold text-lg">Apply Special Offer</Text>
        </View>
        <View className="bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
          <Text className="text-green-800 dark:text-green-200 font-bold text-sm">
            {validOffers.length} available
          </Text>
        </View>
      </View>

      {/* No offer option */}
      <Pressable
        onPress={() => onSelectOffer(null)}
        className={`mb-4 p-4 border-2 rounded-lg ${
          selectedOfferUserId === null 
            ? "border-primary bg-primary/10" 
            : "border-border bg-background"
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-medium">No Special Offer</Text>
            <Text className="text-sm text-muted-foreground">Pay regular price</Text>
          </View>
          {selectedOfferUserId === null && (
            <CheckCircle size={20} color="#3b82f6" />
          )}
        </View>
      </Pressable>

      {/* Available offers */}
      <View className="gap-4">
        {availableOffers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            isSelected={selectedOfferUserId === offer.id}
            onSelect={() => onSelectOffer(offer.id)}
            onDeselect={() => onSelectOffer(null)}
            partySize={partySize}
          />
        ))}
      </View>
    </View>
  );
};

export default function BookingCreateScreen() {
  // Route parameters
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    date?: string;
    time?: string;
    partySize?: string;
    earnablePoints?: string;
    offerId?: string; // Pre-selected special_offer ID (from offers flow)
    preselectedOfferId?: string; // Pre-selected special_offer ID (from availability flow)
  }>();
  
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // Core state management
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedOfferUserId, setSelectedOfferUserId] = useState<string | null>(null);
  const [availableOffers, setAvailableOffers] = useState<UserOfferWithDetails[]>([]);

  // User data
  const [userPoints] = useState(profile?.loyalty_points || 0);
  const [userTier] = useState<TierType>((profile?.membership_tier as TierType) || "bronze");

  // Booking details from navigation
  const bookingDate = params.date ? new Date(params.date) : new Date();
  const bookingTime = params.time || "";
  const partySize = parseInt(params.partySize || "2", 10);
  const earnablePoints = parseInt(params.earnablePoints || "0", 10);

  // Pre-selected offer handling
  const preselectedOfferId = params.offerId || params.preselectedOfferId;

  // Form setup
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      specialRequests: "",
      occasion: "none",
      dietaryRestrictions: profile?.dietary_restrictions || [],
      tablePreferences: [],
      acceptTerms: false,
    },
  });

  // Watch form values
  const watchedValues = watch();

  // Fetch restaurant and offers data
  const fetchData = useCallback(async () => {
    try {
      // Fetch restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", params.restaurantId)
        .single();
      
      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Fetch user's available offers for this restaurant
      if (profile?.id) {
        try {
          const { data: userOffersData, error: offersError } = await supabase
            .from("user_offers")
            .select(`
              id,
              user_id,
              offer_id,
              claimed_at,
              used_at,
              expires_at,
              special_offer:special_offers (
                id,
                title,
                description,
                discount_percentage,
                valid_until,
                restaurant_id,
                minimum_party_size,
                terms_conditions
              )
            `)
            .eq("user_id", profile.id)
            .is("used_at", null)
            .gte("expires_at", new Date().toISOString());

          if (!offersError && userOffersData) {
            // Filter for this restaurant and properly type the data
            const restaurantOffers = userOffersData
              .filter(offer => offer.special_offer?.restaurant_id === params.restaurantId)
              .map(offer => ({
                ...offer,
                special_offer: offer.special_offer!
              })) as UserOfferWithDetails[];

            setAvailableOffers(restaurantOffers);
            
            console.log("Available offers:", restaurantOffers);
            console.log("Preselected offer ID:", preselectedOfferId);
            
            // Auto-select offer if one was pre-selected
            if (preselectedOfferId) {
              // Find the user_offer that corresponds to the special_offer ID
              const matchingUserOffer = restaurantOffers.find(
                offer => offer.special_offer.id === preselectedOfferId
              );
              
              if (matchingUserOffer) {
                console.log("Found matching user offer:", matchingUserOffer.id);
                setSelectedOfferUserId(matchingUserOffer.id);
              } else {
                console.log("No matching user offer found for preselected offer");
              }
            }
          }
        } catch (error) {
          console.error("Error fetching offers:", error);
          setAvailableOffers([]);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load booking details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.restaurantId, preselectedOfferId, profile]);

  // Enhanced booking submission with proper offer tracking
  const submitBooking = useCallback(async (formData: BookingFormData) => {
    if (!restaurant || !profile?.id) return;
    
    setSubmitting(true);
    
    try {
      // Validate booking time
      const bookingDateTime = new Date(bookingDate);
      const [hours, minutes] = bookingTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);
      
      if (bookingDateTime <= new Date()) {
        throw new Error("Booking time must be in the future");
      }

      // Get selected offer details
      const selectedOffer = selectedOfferUserId 
        ? availableOffers.find(offer => offer.id === selectedOfferUserId)
        : null;

      console.log("Selected offer for booking:", selectedOffer);
      
      // Prepare booking data
      const bookingData = {
        user_id: profile.id,
        restaurant_id: restaurant.id,
        booking_time: bookingDateTime.toISOString(),
        party_size: partySize,
        status: restaurant.booking_policy === "instant" ? "confirmed" : "pending",
        special_requests: formData.specialRequests,
        occasion: formData.occasion !== "none" ? formData.occasion : null,
        dietary_notes: formData.dietaryRestrictions,
        table_preferences: formData.tablePreferences,
        confirmation_code: `BK${Date.now().toString().slice(-8).toUpperCase()}`,
        // FIXED: Add applied_offer_id to track which special offer was applied
        applied_offer_id: selectedOffer ? selectedOffer.special_offer.id : null,
      };

      console.log("Creating booking with data:", bookingData);
      
      // Create booking record
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert(bookingData)
        .select()
        .single();
      
      if (bookingError) {
        console.error("Booking creation error:", bookingError);
        throw bookingError;
      }
      
      console.log("Booking created successfully:", booking.id);
      
      // Mark the user_offer as used if an offer was selected
      if (selectedOfferUserId && selectedOffer) {
        try {
          console.log("Marking user offer as used:", selectedOfferUserId);
          
          const { error: offerError } = await supabase
            .from("user_offers")
            .update({ 
              used_at: new Date().toISOString(),
              booking_id: booking.id,
            })
            .eq("id", selectedOfferUserId)
            .eq("user_id", profile.id);
          
          if (offerError) {
            console.error("Offer update error:", offerError);
            // Don't fail the booking, just log the error
          } else {
            console.log("Offer marked as used successfully");
          }
        } catch (offerError) {
          console.error("Failed to mark offer as used:", offerError);
          // Don't fail the booking, just log the error
        }
      }
      
      // Award loyalty points
      if (earnablePoints > 0) {
        try {
          console.log("Awarding loyalty points:", earnablePoints);
          
          const { error: pointsError } = await supabase.rpc("award_loyalty_points", {
            p_user_id: profile.id,
            p_points: earnablePoints,
          });
          
          if (pointsError) {
            console.error("Points error:", pointsError);
            // Don't fail the booking, just log the error
          } else {
            console.log("Points awarded successfully");
          }
        } catch (pointsError) {
          console.error("Failed to award loyalty points:", pointsError);
          // Don't fail the booking, just log the error
        }
      }
      
      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to success screen with enhanced data
      const successParams = {
        bookingId: booking.id,
        restaurantName: restaurant.name,
        confirmationCode: booking.confirmation_code,
        earnedPoints: earnablePoints.toString(),
        appliedOffer: selectedOffer ? "true" : "false",
        userTier,
      };

      // Add offer details if one was applied
      if (selectedOffer) {
        Object.assign(successParams, {
          offerTitle: selectedOffer.special_offer.title,
          offerDiscount: selectedOffer.special_offer.discount_percentage.toString(),
        });
      }

      console.log("Navigating to success with params:", successParams);
      
      router.replace({
        pathname: "/booking/success",
        params: successParams,
      });
    } catch (error: any) {
      console.error("Error creating booking:", error);
      Alert.alert(
        "Booking Failed",
        error.message || "Failed to create booking. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    restaurant,
    profile,
    bookingDate,
    bookingTime,
    partySize,
    router,
    selectedOfferUserId,
    availableOffers,
    earnablePoints,
    userTier,
  ]);

  // Helper functions for form arrays
  const toggleDietaryRestriction = useCallback((restriction: string) => {
    const current = getValues("dietaryRestrictions");
    if (current.includes(restriction)) {
      setValue("dietaryRestrictions", current.filter((r) => r !== restriction));
    } else {
      setValue("dietaryRestrictions", [...current, restriction]);
    }
  }, [getValues, setValue]);

  const toggleTablePreference = useCallback((preference: string) => {
    const current = getValues("tablePreferences");
    if (current.includes(preference)) {
      setValue("tablePreferences", current.filter((p) => p !== preference));
    } else {
      setValue("tablePreferences", [...current, preference]);
    }
  }, [getValues, setValue]);

  // Lifecycle management
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground">Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <H3 className="text-center mb-2">Restaurant not found</H3>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const selectedOffer = selectedOfferUserId ? 
    availableOffers.find(offer => offer.id === selectedOfferUserId) : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-4 py-3 border-b border-border">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2">
              <ChevronLeft size={24} />
            </Pressable>
            <View className="flex-1 mx-4">
              <Text className="text-center font-semibold">Complete Booking</Text>
              <Muted className="text-center text-sm">{restaurant.name}</Muted>
            </View>
            <View className="w-10" />
          </View>
        </View>

        {/* Booking Summary */}
        <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border">
          <View className="flex-row items-center gap-3 mb-3">
            <Image
              source={{ uri: restaurant.main_image_url }}
              className="w-16 h-16 rounded-lg"
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="font-semibold text-lg">{restaurant.name}</Text>
              <View className="flex-row items-center gap-2 mt-1">
                <Calendar size={14} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  {bookingDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Clock size={14} color="#666" />
                <Text className="text-sm text-muted-foreground">{bookingTime}</Text>
                <Users size={14} color="#666" />
                <Text className="text-sm text-muted-foreground">
                  {partySize} {partySize === 1 ? "Guest" : "Guests"}
                </Text>
              </View>
            </View>
          </View>

          {/* User info display */}
          <View className="border-t border-border pt-3">
            <Text className="text-sm text-muted-foreground">Booking for:</Text>
            <Text className="font-medium">{profile?.full_name}</Text>
            {profile?.phone_number && (
              <Text className="text-sm text-muted-foreground">{profile.phone_number}</Text>
            )}
          </View>

          {/* Applied offer summary */}
          {selectedOffer && (
            <View className="border-t border-border pt-3 mt-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Tag size={16} color="#10b981" />
                  <Text className="text-sm font-medium">
                    {selectedOffer.special_offer.title} ({selectedOffer.special_offer.discount_percentage}% OFF)
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedOfferUserId(null)}>
                  <X size={16} color="#666" />
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="gap-4 py-4">
            {/* Loyalty Rewards */}
            {profile && earnablePoints > 0 && (
              <LoyaltyTierDisplay
                userTier={userTier}
                userPoints={userPoints}
                earnablePoints={earnablePoints}
              />
            )}

            {/* Offers Selection */}
            <OffersSelection
              availableOffers={availableOffers}
              selectedOfferUserId={selectedOfferUserId}
              onSelectOffer={setSelectedOfferUserId}
              partySize={partySize}
            />

            {/* Special Requirements */}
            <View className="bg-card border border-border rounded-xl p-4">
              <View className="flex-row items-center gap-3 mb-4">
                <Utensils size={20} color="#3b82f6" />
                <Text className="font-bold text-lg">Special Requirements</Text>
              </View>

              {/* Occasion Selection */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Special Occasion</Text>
                <View className="flex-row flex-wrap gap-2">
                  {OCCASIONS.slice(0, 4).map((occasion) => (
                    <Pressable
                      key={occasion.id}
                      onPress={() => setValue("occasion", occasion.id)}
                      className={`px-3 py-2 rounded-lg border flex-row items-center gap-2 ${
                        watchedValues.occasion === occasion.id
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      {occasion.icon && <Text>{occasion.icon}</Text>}
                      <Text
                        className={
                          watchedValues.occasion === occasion.id
                            ? "text-primary-foreground text-sm"
                            : "text-sm"
                        }
                      >
                        {occasion.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Dietary Restrictions */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Dietary Restrictions</Text>
                <View className="flex-row flex-wrap gap-2">
                  {DIETARY_RESTRICTIONS.slice(0, 8).map((restriction) => {
                    const isSelected = watchedValues.dietaryRestrictions.includes(restriction);
                    
                    return (
                      <Pressable
                        key={restriction}
                        onPress={() => toggleDietaryRestriction(restriction)}
                        className={`px-3 py-2 rounded-lg border ${
                          isSelected
                            ? "bg-green-100 dark:bg-green-900/20 border-green-500"
                            : "bg-background border-border"
                        }`}
                      >
                        <Text
                          className={
                            isSelected
                              ? "text-green-800 dark:text-green-200 text-sm"
                              : "text-sm"
                          }
                        >
                          {restriction}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Table Preferences */}
              <View className="mb-4">
                <Text className="font-medium mb-2">Table Preferences</Text>
                <View className="flex-row flex-wrap gap-2">
                  {TABLE_PREFERENCES.slice(0, 6).map((preference) => {
                    const isSelected = watchedValues.tablePreferences.includes(preference);
                    
                    return (
                      <Pressable
                        key={preference}
                        onPress={() => toggleTablePreference(preference)}
                        className={`px-3 py-2 rounded-lg border ${
                          isSelected
                            ? "bg-blue-100 dark:bg-blue-900/20 border-blue-500"
                            : "bg-background border-border"
                        }`}
                      >
                        <Text
                          className={
                            isSelected
                              ? "text-blue-800 dark:text-blue-200 text-sm"
                              : "text-sm"
                          }
                        >
                          {preference}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Special Requests */}
              <Controller
                control={control}
                name="specialRequests"
                render={({ field: { onChange, value } }) => (
                  <CustomTextarea
                    label="Special Requests"
                    value={value || ""}
                    onChangeText={onChange}
                    placeholder="Any other special requests or notes..."
                    description="Optional - Let us know if you have any specific needs"
                    numberOfLines={3}
                    maxLength={500}
                    error={errors.specialRequests?.message}
                  />
                )}
              />
            </View>

            {/* Terms Acceptance */}
            <View className="bg-card border border-border rounded-xl p-4">
              <Controller
                control={control}
                name="acceptTerms"
                render={({ field: { onChange, value } }) => (
                  <Pressable
                    onPress={() => onChange(!value)}
                    className="flex-row items-start gap-3"
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${
                        value
                          ? "bg-primary border-primary"
                          : "border-border"
                      }`}
                    >
                      {value && <CheckCircle size={14} color="white" />}
                    </View>
                    <Text className="flex-1 text-sm">
                      I agree to the{" "}
                      <Text className="text-primary underline">booking terms</Text> and
                      understand the cancellation policy. I also consent to earning loyalty points.
                    </Text>
                  </Pressable>
                )}
              />
              {errors.acceptTerms && (
                <Text className="text-sm text-red-500 mt-2">{errors.acceptTerms.message}</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View className="p-4 border-t border-border bg-background">
          <Button
            onPress={handleSubmit(submitBooking)}
            disabled={submitting || !watchedValues.acceptTerms}
            size="lg"
            className="w-full"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <CheckCircle size={20} className="mr-2" />
                <Text className="text-white font-bold text-lg">
                  {restaurant.booking_policy === "instant" ? "Confirm Booking" : "Request Booking"}
                </Text>
              </>
            )}
          </Button>
          
          <View className="mt-3 flex-row justify-center items-center gap-2">
            <Text className="text-xs text-muted-foreground text-center">
              {selectedOffer ? `${selectedOffer.special_offer.discount_percentage}% discount + ` : ""}
              {earnablePoints} loyalty points • {TIER_CONFIG[userTier].name.toUpperCase()} tier
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}