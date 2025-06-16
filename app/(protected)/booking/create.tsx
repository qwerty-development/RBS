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
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormInput, FormTextarea } from "@/components/ui/form";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Type Definitions and Schema Architecture
// 1.1 Booking Form Data Structure
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

// 1.2 Restaurant Type Extension
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
};

// 1.3 Booking Step Configuration
interface BookingStep {
  id: number;
  title: string;
  subtitle: string;
  icon: any;
  validation: (data: Partial<BookingFormData>) => boolean;
}

// 2. Form Validation Schema with Lebanese Context
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
      // 2.1 Normalize Lebanese phone number format
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

// 3. Configuration Constants
// 3.1 Special Occasions for Lebanese Market
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

// 3.2 Dietary Restrictions
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

// 3.3 Table Preferences
const TABLE_PREFERENCES = [
  "Window Seat",
  "Outdoor Seating",
  "Quiet Area",
  "Near Bar",
  "Private Room",
  "High Chair Needed",
  "Wheelchair Accessible",
];

export default function BookingCreateScreen() {
  // 4. Core State Management Architecture
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    date?: string;
    time?: string;
    partySize?: string;
    quickBook?: string;
  }>();
  
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  
  // 4.1 Restaurant and Booking Details State
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 4.2 Multi-step Form State Management
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // 4.3 Booking Details from Navigation
  const bookingDate = params.date ? new Date(params.date) : new Date();
  const bookingTime = params.time || "";
  const partySize = parseInt(params.partySize || "2", 10);
  const isQuickBook = params.quickBook === "true";
  
  // 4.4 Form State with Default Values
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guestName: profile?.full_name || "",
      guestEmail: profile?.email || "",
      guestPhone: profile?.phone_number || "",
      specialRequests: "",
      occasion: "none",
      dietaryRestrictions: profile?.dietary_restrictions || [],
      tablePreferences: [],
      acceptTerms: false,
    },
  });

  // 5. Step Configuration with Validation Logic
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
      title: "Special Requirements",
      subtitle: "Any special needs for your visit?",
      icon: Utensils,
      validation: () => true, // Optional step
    },
    {
      id: 2,
      title: "Review & Confirm",
      subtitle: "Review your booking details",
      icon: CheckCircle,
      validation: (data) => data.acceptTerms || false,
    },
  ];

  // 6. Restaurant Data Fetching
  const fetchRestaurant = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", params.restaurantId)
        .single();
      
      if (error) throw error;
      setRestaurant(data);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      Alert.alert("Error", "Failed to load restaurant details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.restaurantId, router]);

  // 7. Booking Submission Implementation
  const submitBooking = useCallback(async (formData: BookingFormData) => {
    if (!restaurant || !profile?.id) return;
    
    setSubmitting(true);
    
    try {
      // 7.1 Validate booking time is still in the future
      const bookingDateTime = new Date(bookingDate);
      const [hours, minutes] = bookingTime.split(":").map(Number);
      bookingDateTime.setHours(hours, minutes, 0, 0);
      
      if (bookingDateTime <= new Date()) {
        throw new Error("Booking time must be in the future");
      }
      
      // 7.2 Check restaurant booking window
      const maxBookingDate = new Date();
      maxBookingDate.setDate(
        maxBookingDate.getDate() + (restaurant.booking_window_days || 30)
      );
      
      if (bookingDateTime > maxBookingDate) {
        throw new Error(
          `Bookings can only be made up to ${restaurant.booking_window_days} days in advance`
        );
      }
      
      // 7.3 Create booking record
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
        })
        .select()
        .single();
      
      if (bookingError) throw bookingError;
      
      // 7.4 Update restaurant availability
      await updateRestaurantAvailability(
        restaurant.id,
        bookingDate,
        bookingTime,
        partySize
      );
      
      // 7.5 Calculate and award loyalty points
      const loyaltyPoints = calculateLoyaltyPoints(partySize, restaurant.price_range);
      await awardLoyaltyPoints(profile.id, loyaltyPoints);
      
      // 7.6 Send confirmation notifications
      await sendBookingConfirmation(booking);
      
      // 7.7 Haptic feedback for success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // 7.8 Navigate to success screen
      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: booking.id,
          restaurantName: restaurant.name,
          confirmationCode: booking.confirmation_code,
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
  }, [restaurant, profile, bookingDate, bookingTime, partySize, router]);

  // 8. Availability Update Function
  const updateRestaurantAvailability = async (
    restaurantId: string,
    date: Date,
    time: string,
    partySize: number
  ) => {
    // 8.1 Implementation depends on restaurant capacity management
    // This is a placeholder for the actual implementation
    const dateStr = date.toISOString().split("T")[0];
    
    const { error } = await supabase.rpc("update_restaurant_availability", {
      p_restaurant_id: restaurantId,
      p_date: dateStr,
      p_time_slot: time,
      p_party_size: partySize,
    });
    
    if (error) {
      console.error("Failed to update availability:", error);
    }
  };

  // 9. Loyalty Points Calculation
  const calculateLoyaltyPoints = (partySize: number, priceRange: number) => {
    // 9.1 Base points calculation
    const basePoints = 50;
    const sizeMultiplier = partySize;
    const priceMultiplier = priceRange * 0.5;
    
    return Math.floor(basePoints * sizeMultiplier * priceMultiplier);
  };

  // 10. Award Loyalty Points
  const awardLoyaltyPoints = async (userId: string, points: number) => {
    const { error } = await supabase.rpc("award_loyalty_points", {
      p_user_id: userId,
      p_points: points,
    });
    
    if (error) {
      console.error("Failed to award loyalty points:", error);
    }
  };

  // 11. Send Booking Confirmation
  const sendBookingConfirmation = async (booking: any) => {
    // 11.1 This would integrate with a notification service
    // Placeholder implementation
    console.log("Sending booking confirmation:", booking);
  };

  // 12. Step Navigation Functions
  const handleNextStep = useCallback(async () => {
    // 12.1 Validate current step
    const currentStepData = form.getValues();
    const isValid = steps[currentStep].validation(currentStepData);
    
    if (!isValid) {
      // 12.2 Trigger form validation to show errors
      await form.trigger();
      return;
    }
    
    // 12.3 Mark step as completed
    setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
    
    // 12.4 Move to next step or submit
    if (currentStep === steps.length - 1) {
      // Final step - submit booking
      form.handleSubmit((data) => submitBooking(data))();
    } else {
      setCurrentStep((prev) => prev + 1);
      // 12.5 Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep, form, submitBooking]);

  const handlePreviousStep = useCallback(async () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentStep]);

  // 13. Lifecycle Management
  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  // 14. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
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

  // 15. Main Render Implementation
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* 15.1 Header */}
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

        {/* 15.2 Booking Summary Card */}
        <View className="mx-4 mt-4 p-4 bg-card rounded-lg shadow-sm">
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
            </View>
          </View>
        </View>

        {/* 15.3 Progress Indicator */}
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

        {/* 15.4 Form Content */}
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <Form {...form}>
            {/* 15.4.1 Step 0: Guest Information */}
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

            {/* 15.4.2 Step 1: Special Requirements */}
            {currentStep === 1 && (
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

            {/* 15.4.3 Step 2: Review & Confirm */}
            {currentStep === 2 && (
              <View className="gap-4 py-4">
                <View>
                  <H3>Review Your Booking</H3>
                  <Muted className="mt-1">
                    Please review your booking details before confirming
                  </Muted>
                </View>

                {/* Booking Summary */}
                <View className="bg-card p-4 rounded-lg space-y-3">
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

                {/* Booking Policy */}
                <View className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
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
                        understand the cancellation policy
                      </Text>
                    </Pressable>
                  )}
                />

                {/* Estimated Loyalty Points */}
                <View className="bg-primary/10 p-4 rounded-lg flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Star size={20} color="#f59e0b" />
                    <View>
                      <Text className="font-medium">Earn Loyalty Points</Text>
                      <Text className="text-sm text-muted-foreground">
                        Complete this booking to earn points
                      </Text>
                    </View>
                  </View>
                  <Text className="font-bold text-lg text-primary">
                    +{calculateLoyaltyPoints(partySize, restaurant.price_range)} pts
                  </Text>
                </View>
              </View>
            )}
          </Form>
        </ScrollView>

        {/* 15.5 Bottom Navigation */}
        <View className="p-4 border-t border-border">
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
                  <CheckCircle size={20} color="white" />
                </>
              ) : (
                <>
                  <Text>Next</Text>
                  <ChevronRight size={20} />
                </>
              )}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}