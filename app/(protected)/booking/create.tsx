// app/(protected)/booking/create.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  Gift,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertCircle,
  CheckCircle,
  Phone,
  User,
  Mail,
  Utensils,
  Star,
  Trophy,
  Tag,
  Percent,
  QrCode,
  Sparkles,
  Crown,
  Award,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, H4, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormInput, FormTextarea } from "@/components/ui/form";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Enhanced Type Definitions
interface BookingFormData {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
};

interface BookingStep {
  id: number;
  title: string;
  subtitle: string;
  icon: any;
  validation: (data: Partial<BookingFormData>) => boolean;
}

// Tier Configuration (moved to component level to fix import issues)
const TIER_CONFIG = {
  bronze: {
    name: "Bronze",
    color: "#CD7F32",
    icon: Award,
    minPoints: 0,
    benefits: ["Basic rewards", "Birthday discount"],
    pointsMultiplier: 1,
  },
  silver: {
    name: "Silver", 
    color: "#C0C0C0",
    icon: Star,
    minPoints: 500,
    benefits: ["All Bronze benefits", "Exclusive offers", "Priority support"],
    pointsMultiplier: 1.1,
  },
  gold: {
    name: "Gold",
    color: "#FFD700", 
    icon: Crown,
    minPoints: 1500,
    benefits: ["All Silver benefits", "VIP experiences", "Free delivery"],
    pointsMultiplier: 1.2,
  },
  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    icon: Sparkles,
    minPoints: 3000,
    benefits: ["All Gold benefits", "Personal concierge", "Exclusive events"],
    pointsMultiplier: 1.5,
  },
} as const;

type TierType = keyof typeof TIER_CONFIG;

// Enhanced Form Validation Schema
const bookingFormSchema = z.object({
  guestName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid name"),
  guestEmail: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase(),
  guestPhone: z
    .string()
    .regex(
      /^(\+961|961|03|70|71|76|78|79|80|81)\d{6,7}$/,
      "Please enter a valid Lebanese phone number"
    )
    .transform((val) => {
      if (val.startsWith("03") || val.startsWith("7") || val.startsWith("8")) {
        return `+961${val.replace(/^0/, "")}`;
      }
      if (val.startsWith("961")) {
        return `+${val}`;
      }
      return val;
    }),
  specialRequests: z.string().max(500, "Maximum 500 characters").optional(),
  occasion: z.string().optional(),
  dietaryRestrictions: z.array(z.string()).default([]),
  tablePreferences: z.array(z.string()).default([]),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, "You must accept the booking terms"),
});

// Enhanced Configuration Constants
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

// Simplified Loyalty Tier Badge Component (fixed)
const LoyaltyTierBadge: React.FC<{
  userTier: TierType;
  userPoints: number;
  earnablePoints: number;
}> = ({ userTier, userPoints, earnablePoints }) => {
  const tierConfig = TIER_CONFIG[userTier] || TIER_CONFIG.bronze;
  const IconComponent = tierConfig.icon;

  return (
    <View className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Trophy size={20} color="#3b82f6" />
          <Text className="font-bold text-lg ml-2">Loyalty Rewards</Text>
        </View>
        <View className="flex-row items-center bg-primary/20 px-3 py-1 rounded-full">
          <IconComponent size={14} color={tierConfig.color} />
          <Text className="font-bold text-sm ml-1" style={{ color: tierConfig.color }}>
            {tierConfig.name.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-sm text-muted-foreground">You'll earn</Text>
          <View className="flex-row items-center">
            <Text className="text-2xl font-bold text-primary">+{earnablePoints}</Text>
            <Text className="text-sm text-muted-foreground ml-1">points</Text>
          </View>
        </View>
        
        <View className="items-end">
          <Text className="text-sm text-muted-foreground">Current balance</Text>
          <Text className="text-lg font-bold">{userPoints} pts</Text>
        </View>
      </View>
      
      <Text className="text-xs text-muted-foreground mt-2">
        Points are automatically awarded after your successful dining experience
      </Text>
    </View>
  );
};

// Enhanced Offer Selection Component (fixed)
const OfferSelectionCard: React.FC<{
  offers: any[];
  selectedOfferId: string | null;
  onSelectOffer: (offerId: string | null) => void;
}> = ({ offers, selectedOfferId, onSelectOffer }) => {
  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-4">
      <View className="flex-row items-center mb-3">
        <Gift size={20} color="#3b82f6" />
        <Text className="font-bold text-lg ml-2">Apply Special Offer</Text>
        <View className="bg-primary/20 px-2 py-1 rounded-full ml-auto">
          <Text className="text-primary font-bold text-xs">
            {offers.length} available
          </Text>
        </View>
      </View>

      {offers.length === 0 ? (
        <View className="py-4 items-center">
          <Text className="text-muted-foreground text-center">
            No special offers available for this restaurant at the moment.
          </Text>
          <Text className="text-xs text-muted-foreground text-center mt-1">
            Check our offers page for deals at other restaurants!
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {/* No offer option */}
            <Pressable
              onPress={() => onSelectOffer(null)}
              className={`p-3 rounded-lg border-2 min-w-[120px] ${
                selectedOfferId === null 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-background"
              }`}
            >
              <Text className="font-medium text-center">No Offer</Text>
              <Text className="text-xs text-muted-foreground text-center mt-1">
                Pay full price
              </Text>
            </Pressable>

            {/* Available offers */}
            {offers.map((offer) => {
              const offerId = offer.offer_id || offer.id || offer.special_offer?.id;
              const title = offer.offer_title || offer.title || offer.special_offer?.title || "Special Offer";
              const description = offer.offer_description || offer.description || offer.special_offer?.description || "Get a discount on your meal";
              const discountPercent = offer.discount_percentage || offer.special_offer?.discount_percentage || 0;
              const redemptionCode = offer.redemption_code || offer.redemptionCode || offer.id;
              const expiryDate = offer.expires_at || offer.expiresAt || offer.valid_until || offer.special_offer?.valid_until;

              return (
                <Pressable
                  key={offerId}
                  onPress={() => onSelectOffer(offerId)}
                  className={`p-3 rounded-lg border-2 min-w-[200px] ${
                    selectedOfferId === offerId 
                      ? "border-primary bg-primary/10" 
                      : "border-border bg-background"
                  }`}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-bold text-sm flex-1" numberOfLines={1}>
                      {title}
                    </Text>
                    <View className="bg-primary rounded-full px-2 py-1 ml-2">
                      <Text className="text-white font-bold text-xs">
                        {discountPercent}%
                      </Text>
                    </View>
                  </View>
                  
                  <Text className="text-xs text-muted-foreground mb-2" numberOfLines={2}>
                    {description}
                  </Text>
                  
                  {redemptionCode && (
                    <View className="bg-muted/50 rounded px-2 py-1">
                      <Text className="text-xs font-mono">
                        Code: {redemptionCode.toString().slice(-6).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  
                  <Text className="text-xs text-muted-foreground mt-1">
                    Expires {expiryDate ? new Date(expiryDate).toLocaleDateString() : "Soon"}
                  </Text>
                  
                  {selectedOfferId === offerId && (
                    <View className="absolute top-2 right-2">
                      <CheckCircle size={16} color="#3b82f6" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default function BookingCreateScreen() {
  // Route parameters with enhanced offer support
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    date?: string;
    time?: string;
    partySize?: string;
    quickBook?: string;
    offerId?: string;
    redemptionCode?: string;
    earnablePoints?: string;
    discount?: string;
  }>();
  
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // Core state management
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(params.offerId || null);

  // User loyalty data (simplified for now)
  const [userPoints, setUserPoints] = useState(profile?.loyalty_points || 0);
  const [userTier, setUserTier] = useState<TierType>((profile?.membership_tier as TierType) || "bronze");

  // Available offers (simplified - you can replace with actual hook)
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);

  // Booking details from navigation
  const bookingDate = params.date ? new Date(params.date) : new Date();
  const bookingTime = params.time || "";
  const partySize = parseInt(params.partySize || "2", 10);
  const isQuickBook = params.quickBook === "true";
  const presetEarnablePoints = parseInt(params.earnablePoints || "0", 10);

  // Calculate loyalty points for this booking
  const calculateBookingPoints = useCallback((partySize: number, priceRange: number) => {
    const basePoints = 50;
    const sizeMultiplier = Math.min(partySize * 0.2 + 0.8, 2);
    const priceMultiplier = priceRange * 0.3 + 0.7;
    const tierMultiplier = TIER_CONFIG[userTier].pointsMultiplier;
    
    return Math.round(basePoints * sizeMultiplier * priceMultiplier * tierMultiplier);
  }, [userTier]);

  const earnablePoints = presetEarnablePoints || 
    (restaurant ? calculateBookingPoints(partySize, restaurant.price_range || 2) : 0);

  // Form with enhanced default values
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: profile?.full_name || "",
      guestEmail: "",
      guestPhone: profile?.phone_number || "",
      specialRequests: "",
      occasion: "none",
      dietaryRestrictions: profile?.dietary_restrictions || [],
      tablePreferences: [],
      acceptTerms: false,
    },
  });

  // Enhanced step configuration
  const steps: BookingStep[] = [
    {
      id: 0,
      title: "Guest Information",
      subtitle: "Who's making this reservation?",
      icon: User,
      validation: (data) => {
        return !!(data.guestName && data.guestEmail && data.guestPhone);
      },
    },
    {
      id: 1,
      title: "Offers & Rewards",
      subtitle: "Maximize your savings and points",
      icon: Gift,
      validation: () => true,
    },
    {
      id: 2,
      title: "Special Requirements",
      subtitle: "Any special needs for your visit?",
      icon: Utensils,
      validation: () => true,
    },
    {
      id: 3,
      title: "Review & Confirm",
      subtitle: "Review your booking details",
      icon: CheckCircle,
      validation: (data) => data.acceptTerms || false,
    },
  ];

  // Enhanced restaurant data fetching
  const fetchRestaurant = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", params.restaurantId)
        .single();
      
      if (error) throw error;
      setRestaurant(data);

      // Fetch user's available offers for this restaurant
      if (profile?.id) {
        try {
          // Try to fetch from the detailed view first
          const { data: userOffersData, error: viewError } = await supabase
            .from("user_offers_detailed")
            .select("*")
            .eq("user_id", profile.id)
            .eq("restaurant_id", params.restaurantId)
            .eq("can_use", true);

          if (viewError) {
            console.log("View not available, fetching from base tables:", viewError);
            
            // Fallback: fetch from base tables
            const { data: baseOffersData } = await supabase
              .from("user_offers")
              .select(`
                *,
                special_offer:special_offers (
                  *,
                  restaurant:restaurants (*)
                )
              `)
              .eq("user_id", profile.id)
              .is("used_at", null)
              .gte("expires_at", new Date().toISOString());

            // Filter for this restaurant and transform data
            const restaurantOffersData = (baseOffersData || [])
              .filter(offer => offer.special_offer?.restaurant_id === params.restaurantId)
              .map(offer => ({
                ...offer,
                offer_title: offer.special_offer?.title || "Special Offer",
                offer_description: offer.special_offer?.description || "Get a discount on your meal",
                discount_percentage: offer.special_offer?.discount_percentage || 0,
                restaurant_name: offer.special_offer?.restaurant?.name || restaurant?.name,
                expires_at: offer.expires_at,
                can_use: true,
              }));

            setAvailableOffers(restaurantOffersData);
          } else {
            // Debug: Log the offer data structure
            console.log("Available offers data:", userOffersData);
            setAvailableOffers(userOffersData || []);
          }
        } catch (error) {
          console.error("Error fetching offers:", error);
          setAvailableOffers([]);
        }

        // Get user email from auth
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          form.setValue("guestEmail", user.email);
        }
      }
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      Alert.alert("Error", "Failed to load restaurant details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.restaurantId, router, profile, form]);

  // Award loyalty points function
  const awardLoyaltyPoints = useCallback(async (userId: string, points: number) => {
    try {
      const { error } = await supabase.rpc("award_loyalty_points_with_tracking", {
        p_user_id: userId,
        p_points: points,
        p_activity_type: "booking_completed",
        p_description: `Earned points for booking at ${restaurant?.name}`,
      });
      
      if (error) throw error;
      console.log(`Awarded ${points} loyalty points`);
    } catch (error) {
      console.error("Failed to award loyalty points:", error);
    }
  }, [restaurant]);

  // Use offer function
  const useOffer = useCallback(async (offerId: string, bookingId: string) => {
    try {
      const { error } = await supabase
        .from("user_offers")
        .update({ 
          used_at: new Date().toISOString(),
          booking_id: bookingId,
        })
        .eq("offer_id", offerId)
        .eq("user_id", profile?.id);

      if (error) throw error;
      console.log("Offer applied successfully");
    } catch (error) {
      console.error("Failed to apply offer:", error);
      throw error;
    }
  }, [profile?.id]);

  // Enhanced booking submission with full integration
  const submitBooking = useCallback(async (formData: BookingFormData) => {
    if (!restaurant || !profile?.id) return;
    
    setSubmitting(true);
    
    try {
      // Validate booking time is still in the future
      const bookingDateTime = new Date(bookingDate);
      const [hours, minutes] = bookingTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);
      
      if (bookingDateTime <= new Date()) {
        throw new Error("Booking time must be in the future");
      }
      
      // Check restaurant booking window
      const maxBookingDate = new Date();
      maxBookingDate.setDate(
        maxBookingDate.getDate() + (restaurant.booking_window_days || 30)
      );
      
      if (bookingDateTime > maxBookingDate) {
        throw new Error(
          `Bookings can only be made up to ${restaurant.booking_window_days || 30} days in advance`
        );
      }
      
      // Create booking record with enhanced data
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
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
        })
        .select()
        .single();
      
      if (bookingError) throw bookingError;
      
      // Use selected offer if applicable
      if (selectedOfferId) {
        try {
          await useOffer(selectedOfferId, booking.id);
        } catch (offerError) {
          console.error("Failed to apply offer:", offerError);
          // Don't fail the booking, just log the error
        }
      }
      
      // Award loyalty points
      if (earnablePoints > 0) {
        try {
          await awardLoyaltyPoints(profile.id, earnablePoints);
        } catch (pointsError) {
          console.error("Failed to award loyalty points:", pointsError);
          // Don't fail the booking, just log the error
        }
      }
      
      // Update restaurant availability (if function exists)
      try {
        await updateRestaurantAvailability(
          restaurant.id,
          bookingDate,
          bookingTime,
          partySize
        );
      } catch (availabilityError) {
        console.error("Failed to update availability:", availabilityError);
        // Don't fail the booking
      }
      
      // Haptic feedback for success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Navigate to success screen with enhanced data
      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: booking.id,
          restaurantName: restaurant.name,
          confirmationCode: booking.confirmation_code,
          earnedPoints: earnablePoints.toString(),
          appliedOffer: selectedOfferId ? "true" : "false",
          userTier,
        },
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
    selectedOfferId, 
    useOffer, 
    earnablePoints, 
    awardLoyaltyPoints, 
    userTier, 
    isQuickBook
  ]);

  // Enhanced availability update function
  const updateRestaurantAvailability = async (
    restaurantId: string,
    date: Date,
    time: string,
    partySize: number
  ) => {
    const dateStr = date.toISOString().split("T")[0];
    
    const { error } = await supabase.rpc("update_restaurant_availability", {
      p_restaurant_id: restaurantId,
      p_date: dateStr,
      p_time_slot: time,
      p_party_size: partySize,
    });
    
    if (error) {
      console.error("Failed to update availability:", error);
      throw error;
    }
  };

  // Enhanced step navigation
  const handleNextStep = useCallback(async () => {
    const currentStepData = form.getValues();
    const isValid = steps[currentStep].validation(currentStepData);
    
    if (!isValid) {
      await form.trigger();
      return;
    }
    
    setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
    
    if (currentStep === steps.length - 1) {
      form.handleSubmit((data) => submitBooking(data))();
    } else {
      setCurrentStep((prev) => prev + 1);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep, form, submitBooking, steps]);

  const handlePreviousStep = useCallback(async () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep]);

  // Auto-select offer from params
  useEffect(() => {
    if (params.offerId && availableOffers.length > 0) {
      const offer = availableOffers.find(o => 
        o.offer_id === params.offerId || 
        o.id === params.offerId ||
        o.special_offer?.id === params.offerId
      );
      if (offer) {
        setSelectedOfferId(params.offerId);
      }
    }
  }, [params.offerId, availableOffers]);

  // Lifecycle management
  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

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
        <View className="flex-1 items-center justify-center">
          <H3>Restaurant not found</H3>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Get selected offer details
  const selectedOffer = selectedOfferId ? 
    availableOffers.find(offer => 
      offer.offer_id === selectedOfferId || 
      offer.id === selectedOfferId ||
      offer.special_offer?.id === selectedOfferId
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Enhanced Header */}
        <View className="px-4 py-3 border-b border-border">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2">
              <ChevronLeft size={24} />
            </Pressable>
            <View className="flex-1 mx-4">
              <Text className="text-center font-semibold">New Booking</Text>
              <Muted className="text-center text-sm">{restaurant.name}</Muted>
            </View>
            <View className="w-10" />
          </View>
        </View>

        {/* Enhanced Booking Summary Card */}
        <View className="mx-4 mt-4 p-4 bg-card rounded-lg shadow-sm border border-border">
          <View className="flex-row items-center gap-3">
            <Image
              source={{ uri: restaurant.main_image_url }}
              className="w-16 h-16 rounded-lg"
              contentFit="cover"
            />
            <View className="flex-1">
              <Text className="font-semibold">{restaurant.name}</Text>
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
              
              {/* Enhanced summary with offer and points */}
              <View className="flex-row items-center gap-4 mt-2">
                {selectedOffer && (
                  <View className="flex-row items-center">
                    <Tag size={12} color="#3b82f6" />
                    <Text className="text-xs text-primary ml-1">
                      {selectedOffer.discount_percentage}% OFF
                    </Text>
                  </View>
                )}
                
                <View className="flex-row items-center">
                  <Trophy size={12} color="#f59e0b" />
                  <Text className="text-xs text-amber-600 ml-1">
                    +{earnablePoints} pts
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Progress Indicator */}
        <View className="flex-row items-center justify-center px-4 py-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <View className="items-center">
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    currentStep === index
                      ? "bg-primary"
                      : completedSteps.includes(index)
                      ? "bg-green-500"
                      : "bg-muted"
                  }`}
                >
                  {completedSteps.includes(index) ? (
                    <CheckCircle size={20} color="white" />
                  ) : (
                    <Text
                      className={`font-medium ${
                        currentStep === index ? "text-primary-foreground" : ""
                      }`}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text className="text-xs mt-1 text-center max-w-[80px]" numberOfLines={2}>
                  {step.title}
                </Text>
              </View>
              {index < steps.length - 1 && (
                <View
                  className={`h-0.5 flex-1 mx-2 ${
                    completedSteps.includes(index) ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Form Content */}
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <Form {...form}>
            {/* Step 0: Guest Information */}
            {currentStep === 0 && (
              <View className="gap-4 py-4">
                <View>
                  <H3>Guest Information</H3>
                  <Muted className="mt-1">
                    Please provide the contact details for this reservation
                  </Muted>
                </View>

                <FormField
                  control={form.control}
                  name="guestName"
                  render={({ field }) => (
                    <FormInput
                      label="Full Name"
                      placeholder="John Doe"
                      autoCapitalize="words"
                      autoComplete="name"
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="guestEmail"
                  render={({ field }) => (
                    <FormInput
                      label="Email Address"
                      placeholder="john@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="guestPhone"
                  render={({ field }) => (
                    <FormInput
                      label="Phone Number"
                      placeholder="03 123 456"
                      description="We'll use this to confirm your booking"
                      keyboardType="phone-pad"
                      {...field}
                    />
                  )}
                />

                {isQuickBook && (
                  <View className="bg-primary/10 p-3 rounded-lg flex-row items-center gap-2">
                    <Info size={16} color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"} />
                    <Text className="text-sm flex-1">
                      Quick booking using your saved information
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Step 1: Enhanced Offers & Rewards */}
            {currentStep === 1 && (
              <View className="gap-4 py-4">
                <View>
                  <H3>Offers & Rewards</H3>
                  <Muted className="mt-1">
                    Maximize your savings and earn loyalty points
                  </Muted>
                </View>

                {/* Loyalty Points Display */}
                <LoyaltyTierBadge
                  userTier={userTier}
                  userPoints={userPoints}
                  earnablePoints={earnablePoints}
                />

                {/* Offer Selection */}
                <OfferSelectionCard
                  offers={availableOffers}
                  selectedOfferId={selectedOfferId}
                  onSelectOffer={setSelectedOfferId}
                />

                {/* Tier Benefits Info */}
                <View className="bg-muted/30 rounded-lg p-4">
                  <View className="flex-row items-center mb-2">
                    <Crown size={16} color="#f59e0b" />
                    <Text className="font-medium ml-2">Your {TIER_CONFIG[userTier].name} Benefits</Text>
                  </View>
                  {TIER_CONFIG[userTier].benefits.slice(0, 2).map((benefit, index) => (
                    <Text key={index} className="text-sm text-muted-foreground">
                      • {benefit}
                    </Text>
                  ))}
                  <Pressable
                    onPress={() => router.push("/profile/loyalty")}
                    className="flex-row items-center mt-2"
                  >
                    <Text className="text-primary text-sm">View all benefits</Text>
                    <ChevronRight size={14} color="#3b82f6" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: Special Requirements */}
            {currentStep === 2 && (
              <View className="gap-4 py-4">
                <View>
                  <H3>Special Requirements</H3>
                  <Muted className="mt-1">
                    Help us make your dining experience perfect
                  </Muted>
                </View>

                {/* Occasion Selection */}
                <View>
                  <Text className="font-medium mb-2">Special Occasion</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {OCCASIONS.map((occasion) => (
                      <Pressable
                        key={occasion.id}
                        onPress={() => form.setValue("occasion", occasion.id)}
                        className={`px-4 py-2 rounded-full border flex-row items-center gap-2 ${
                          form.watch("occasion") === occasion.id
                            ? "bg-primary border-primary"
                            : "bg-background border-border"
                        }`}
                      >
                        {occasion.icon && <Text>{occasion.icon}</Text>}
                        <Text
                          className={
                            form.watch("occasion") === occasion.id
                              ? "text-primary-foreground"
                              : ""
                          }
                        >
                          {occasion.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Dietary Restrictions */}
                <View>
                  <Text className="font-medium mb-2">Dietary Restrictions</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {DIETARY_RESTRICTIONS.map((restriction) => {
                      const isSelected = form
                        .watch("dietaryRestrictions")
                        .includes(restriction);
                      
                      return (
                        <Pressable
                          key={restriction}
                          onPress={() => {
                            const current = form.getValues("dietaryRestrictions");
                            if (isSelected) {
                              form.setValue(
                                "dietaryRestrictions",
                                current.filter((r) => r !== restriction)
                              );
                            } else {
                              form.setValue("dietaryRestrictions", [
                                ...current,
                                restriction,
                              ]);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg border ${
                            isSelected
                              ? "bg-green-100 dark:bg-green-900/20 border-green-500"
                              : "bg-background border-border"
                          }`}
                        >
                          <Text
                            className={
                              isSelected
                                ? "text-green-800 dark:text-green-200"
                                : ""
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
                <View>
                  <Text className="font-medium mb-2">Table Preferences</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {TABLE_PREFERENCES.map((preference) => {
                      const isSelected = form
                        .watch("tablePreferences")
                        .includes(preference);
                      
                      return (
                        <Pressable
                          key={preference}
                          onPress={() => {
                            const current = form.getValues("tablePreferences");
                            if (isSelected) {
                              form.setValue(
                                "tablePreferences",
                                current.filter((p) => p !== preference)
                              );
                            } else {
                              form.setValue("tablePreferences", [
                                ...current,
                                preference,
                              ]);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg border ${
                            isSelected
                              ? "bg-primary/10 border-primary"
                              : "bg-background border-border"
                          }`}
                        >
                          <Text className={isSelected ? "text-primary" : ""}>
                            {preference}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Special Requests */}
                <FormField
                  control={form.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormTextarea
                      label="Special Requests"
                      placeholder="Any other special requests or notes for the restaurant..."
                      description="Optional - Let us know if you have any specific needs"
                      numberOfLines={4}
                      maxLength={500}
                      {...field}
                    />
                  )}
                />
              </View>
            )}

            {/* Step 3: Enhanced Review & Confirm */}
            {currentStep === 3 && (
              <View className="gap-4 py-4">
                <View>
                  <H3>Review Your Booking</H3>
                  <Muted className="mt-1">
                    Please review your booking details before confirming
                  </Muted>
                </View>

                {/* Enhanced Booking Summary */}
                <View className="bg-card p-4 rounded-lg space-y-3 border border-border">
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground">Restaurant</Text>
                    <Text className="font-medium">{restaurant.name}</Text>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground">Date & Time</Text>
                    <Text className="font-medium">
                      {bookingDate.toLocaleDateString()} at {bookingTime}
                    </Text>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground">Party Size</Text>
                    <Text className="font-medium">
                      {partySize} {partySize === 1 ? "Guest" : "Guests"}
                    </Text>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground">Contact</Text>
                    <View className="items-end">
                      <Text className="font-medium">{form.watch("guestName")}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {form.watch("guestPhone")}
                      </Text>
                    </View>
                  </View>

                  {/* Enhanced Offer Display */}
                  {selectedOffer && (
                    <View className="border-t border-border pt-3">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-muted-foreground">Applied Offer</Text>
                        <View className="items-end">
                          <View className="flex-row items-center">
                            <Text className="font-medium">
                              {selectedOffer.offer_title || selectedOffer.title || "Special Offer"}
                            </Text>
                            <View className="bg-green-500 rounded-full px-2 py-1 ml-2">
                              <Text className="text-white text-xs font-bold">
                                {selectedOffer.discount_percentage}% OFF
                              </Text>
                            </View>
                          </View>
                          {(selectedOffer.redemption_code || selectedOffer.redemptionCode) && (
                            <Text className="text-xs text-muted-foreground mt-1">
                              Code: {(selectedOffer.redemption_code || selectedOffer.redemptionCode).slice(-6).toUpperCase()}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Loyalty Points Display */}
                  <View className="border-t border-border pt-3">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-muted-foreground">Loyalty Rewards</Text>
                      <View className="items-end">
                        <View className="flex-row items-center">
                          <Trophy size={16} color="#f59e0b" />
                          <Text className="font-bold text-amber-600 ml-1">
                            +{earnablePoints} points
                          </Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          {TIER_CONFIG[userTier].name.toUpperCase()} tier benefits applied
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Special Requirements Summary */}
                {(form.watch("occasion") !== "none" ||
                  form.watch("dietaryRestrictions").length > 0 ||
                  form.watch("tablePreferences").length > 0 ||
                  form.watch("specialRequests")) && (
                  <View className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <Text className="font-medium mb-1">Special Requirements</Text>
                    
                    {form.watch("occasion") !== "none" && (
                      <View className="flex-row items-center gap-2">
                        <Gift size={16} color="#666" />
                        <Text className="text-sm">
                          {OCCASIONS.find((o) => o.id === form.watch("occasion"))?.label}
                        </Text>
                      </View>
                    )}
                    
                    {form.watch("dietaryRestrictions").length > 0 && (
                      <View className="flex-row items-start gap-2">
                        <Utensils size={16} color="#666" />
                        <Text className="text-sm flex-1">
                          {form.watch("dietaryRestrictions").join(", ")}
                        </Text>
                      </View>
                    )}
                    
                    {form.watch("tablePreferences").length > 0 && (
                      <View className="flex-row items-start gap-2">
                        <Star size={16} color="#666" />
                        <Text className="text-sm flex-1">
                          {form.watch("tablePreferences").join(", ")}
                        </Text>
                      </View>
                    )}
                    
                    {form.watch("specialRequests") && (
                      <View className="flex-row items-start gap-2">
                        <MessageSquare size={16} color="#666" />
                        <Text className="text-sm flex-1">
                          {form.watch("specialRequests")}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Enhanced Booking Policy */}
                <View className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200">
                  <View className="flex-row items-start gap-2">
                    <AlertCircle size={20} color="#f59e0b" />
                    <View className="flex-1">
                      <Text className="font-medium mb-1">
                        {restaurant.booking_policy === "instant"
                          ? "Instant Booking"
                          : "Request to Book"}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {restaurant.booking_policy === "instant"
                          ? "Your table will be confirmed immediately"
                          : "The restaurant will confirm your booking within 2 hours"}
                      </Text>
                      {restaurant.cancellation_window_hours && (
                        <Text className="text-sm text-muted-foreground mt-1">
                          Free cancellation up to {restaurant.cancellation_window_hours} hours before
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Terms Acceptance */}
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <Pressable
                      onPress={() => field.onChange(!field.value)}
                      className="flex-row items-start gap-3"
                    >
                      <View
                        className={`w-5 h-5 rounded border-2 items-center justify-center ${
                          field.value
                            ? "bg-primary border-primary"
                            : "border-border"
                        }`}
                      >
                        {field.value && <CheckCircle size={14} color="white" />}
                      </View>
                      <Text className="flex-1 text-sm">
                        I agree to the{" "}
                        <Text className="text-primary underline">booking terms</Text> and
                        understand the cancellation policy. I also consent to earning and using loyalty points.
                      </Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </Form>
        </ScrollView>

        {/* Enhanced Bottom Navigation */}
        <View className="p-4 border-t border-border bg-background">
          <View className="flex-row gap-3">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onPress={handlePreviousStep}
                disabled={submitting}
                className="flex-1"
              >
                <ChevronLeft size={20} />
                <Text>Previous</Text>
              </Button>
            )}
            
            <Button
              variant="default"
              onPress={handleNextStep}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : currentStep === steps.length - 1 ? (
                <>
                  <Text>Confirm Booking</Text>
                  <CheckCircle size={20} color="white" className="ml-2" />
                </>
              ) : (
                <>
                  <Text>Next</Text>
                  <ChevronRight size={20} className="ml-2" />
                </>
              )}
            </Button>
          </View>
          
          {/* Enhanced Bottom Info */}
          {currentStep === steps.length - 1 && (
            <View className="mt-3 flex-row justify-center">
              <Text className="text-xs text-muted-foreground text-center">
                {selectedOffer ? `${selectedOffer.discount_percentage}% discount + ` : ""}
                {earnablePoints} loyalty points • {TIER_CONFIG[userTier].name.toUpperCase()} tier
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}