// app/(protected)/review/create.tsx
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
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Star,
  Camera,
  X,
  CheckCircle,
  ChevronLeft,
  Sparkles,
  ThumbsUp,
  Users,
  Utensils,
  Clock,
  MapPin,
  DollarSign,
  Volume2,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormTextarea } from "@/components/ui/form";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// 1. Type Definitions and Constants
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface ReviewFormData {
  rating: number;
  comment: string;
  foodRating: number;
  serviceRating: number;
  ambianceRating: number;
  valueRating: number;
  recommendToFriend: boolean;
  visitAgain: boolean;
  tags: string[];
  photos: string[];
}

// 2. Review Tags for Lebanese Context
const REVIEW_TAGS = {
  positive: [
    "Authentic Lebanese",
    "Great Mezze",
    "Fresh Ingredients",
    "Excellent Service",
    "Cozy Atmosphere",
    "Good Value",
    "Fast Service",
    "Family Friendly",
    "Romantic",
    "Great Views",
    "Live Music",
    "Outdoor Seating",
  ],
  negative: [
    "Long Wait",
    "Overpriced",
    "Poor Service",
    "Noisy",
    "Limited Menu",
    "Parking Issues",
    "Not Authentic",
    "Small Portions",
  ],
};

// 3. Validation Schema
const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, "Please write at least 10 characters").max(1000),
  foodRating: z.number().min(1).max(5),
  serviceRating: z.number().min(1).max(5),
  ambianceRating: z.number().min(1).max(5),
  valueRating: z.number().min(1).max(5),
  recommendToFriend: z.boolean(),
  visitAgain: z.boolean(),
  tags: z.array(z.string()),
  photos: z.array(z.string()),
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ReviewCreateScreen() {
  // 4. Core State Management
  const params = useLocalSearchParams<{
    bookingId: string;
    restaurantId: string;
    restaurantName: string;
  }>();
  
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  
  // 4.1 Data States
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  // 4.2 Review Form State
  const [overallRating, setOverallRating] = useState(0);
  const [detailedRatings, setDetailedRatings] = useState({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  
  // 4.3 Form Setup
  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
      foodRating: 0,
      serviceRating: 0,
      ambianceRating: 0,
      valueRating: 0,
      recommendToFriend: false,
      visitAgain: false,
      tags: [],
      photos: [],
    },
  });

  // 5. Data Fetching
  const fetchData = useCallback(async () => {
    try {
      // 5.1 Fetch restaurant details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", params.restaurantId)
        .single();
      
      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);
      
      // 5.2 Fetch booking details
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", params.bookingId)
        .single();
      
      if (bookingError) throw bookingError;
      setBooking(bookingData);
      
      // 5.3 Check if review already exists
      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", params.bookingId)
        .single();
      
      if (existingReview) {
        Alert.alert(
          "Review Already Submitted",
          "You have already reviewed this booking.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      Alert.alert("Error", "Failed to load booking details");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params, router]);

  // 6. Photo Upload Handler
  const handlePhotoUpload = useCallback(async () => {
    if (photos.length >= 5) {
      Alert.alert("Limit Reached", "You can only upload up to 5 photos");
      return;
    }
    
    // 6.1 Request permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload photos."
      );
      return;
    }
    
    // 6.2 Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: false,
    });
    
    if (result.canceled || !result.assets) return;
    
    setUploadingPhotos(true);
    
    try {
      // 6.3 Upload each photo
      const uploadPromises = result.assets.map(async (asset) => {
        const fileExt = asset.uri.split(".").pop();
        const fileName = `reviews/${profile?.id}-${Date.now()}-${Math.random()}.${fileExt}`;
        
        const formData = new FormData();
        formData.append("file", {
          uri: asset.uri,
          name: fileName,
          type: `image/${fileExt}`,
        } as any);
        
        const { error } = await supabase.storage
          .from("review-photos")
          .upload(fileName, formData);
        
        if (error) throw error;
        
        const { data: publicUrl } = supabase.storage
          .from("review-photos")
          .getPublicUrl(fileName);
        
        return publicUrl.publicUrl;
      });
      
      const uploadedUrls = await Promise.all(uploadPromises);
      setPhotos([...photos, ...uploadedUrls]);
      form.setValue("photos", [...photos, ...uploadedUrls]);
    } catch (error) {
      console.error("Error uploading photos:", error);
      Alert.alert("Error", "Failed to upload photos");
    } finally {
      setUploadingPhotos(false);
    }
  }, [photos, profile?.id, form]);

  // 7. Review Submission
  const submitReview = useCallback(async () => {
    if (!profile?.id || !booking || !restaurant) return;
    
    setSubmitting(true);
    
    try {
      // 7.1 Calculate overall rating
      const avgDetailedRating = 
        (detailedRatings.food + 
         detailedRatings.service + 
         detailedRatings.ambiance + 
         detailedRatings.value) / 4;
      
      const finalRating = overallRating || Math.round(avgDetailedRating);
      
      // 7.2 Create review record
      const reviewData = {
        booking_id: params.bookingId,
        user_id: profile.id,
        restaurant_id: params.restaurantId,
        rating: finalRating,
        comment: form.getValues("comment"),
        food_rating: detailedRatings.food,
        service_rating: detailedRatings.service,
        ambiance_rating: detailedRatings.ambiance,
        value_rating: detailedRatings.value,
        recommend_to_friend: form.getValues("recommendToFriend"),
        visit_again: form.getValues("visitAgain"),
        tags: selectedTags,
        photos: photos,
        helpful_count: 0,
        verified_visit: true,
      };
      
      const { error: reviewError } = await supabase
        .from("reviews")
        .insert(reviewData);
      
      if (reviewError) throw reviewError;
      
      // 7.3 Award loyalty points for review
      const loyaltyPoints = calculateReviewPoints(photos.length, form.getValues("comment").length);
      await awardLoyaltyPoints(profile.id, loyaltyPoints);
      
      // 7.4 Update restaurant rating (handled by trigger)
      
      // 7.5 Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // 7.6 Navigate to success state
      Alert.alert(
        "Thank You!",
        `Your review has been submitted. You earned ${loyaltyPoints} loyalty points!`,
        [
          {
            text: "OK",
            onPress: () => {
              router.replace({
                pathname: "/restaurant/[id]",
                params: { id: params.restaurantId },
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error submitting review:", error);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [profile?.id, booking, restaurant, overallRating, detailedRatings, selectedTags, photos, form, params, router]);

  // 8. Helper Functions
  const calculateReviewPoints = (photoCount: number, commentLength: number) => {
    let points = 50; // Base points
    points += photoCount * 10; // Bonus for photos
    if (commentLength > 100) points += 20; // Bonus for detailed review
    if (commentLength > 200) points += 10; // Extra bonus for very detailed
    return points;
  };

  const awardLoyaltyPoints = async (userId: string, points: number) => {
    const { error } = await supabase.rpc("award_loyalty_points", {
      p_user_id: userId,
      p_points: points,
    });
    
    if (error) {
      console.error("Failed to award loyalty points:", error);
    }
  };

  // 9. Star Rating Component
  const StarRating = ({ 
    rating, 
    onRatingChange, 
    size = 32,
    label,
    showLabels = true 
  }: { 
    rating: number; 
    onRatingChange: (rating: number) => void;
    size?: number;
    label?: string;
    showLabels?: boolean;
  }) => {
    const ratingLabels = ["Terrible", "Poor", "Average", "Good", "Excellent"];
    
    return (
      <View>
        {label && <Text className="font-medium mb-2">{label}</Text>}
        <View className="flex-row items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => {
                onRatingChange(star);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="p-1"
            >
              <Star
                size={size}
                color="#f59e0b"
                fill={star <= rating ? "#f59e0b" : "transparent"}
              />
            </Pressable>
          ))}
        </View>
        {showLabels && rating > 0 && (
          <Text className="text-center mt-2 text-sm text-muted-foreground">
            {ratingLabels[rating - 1]}
          </Text>
        )}
      </View>
    );
  };

  // 10. Lifecycle
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 11. Review Steps Configuration
  const reviewSteps = [
    {
      title: "Overall Experience",
      subtitle: "How was your visit?",
      content: (
        <View className="items-center py-8">
          <H3 className="mb-6">Rate Your Overall Experience</H3>
          <StarRating
            rating={overallRating}
            onRatingChange={setOverallRating}
            size={48}
          />
          
          {overallRating > 0 && (
            <View className="mt-8 w-full gap-3">
              <Button
                variant={form.watch("recommendToFriend") ? "default" : "outline"}
                onPress={() => {
                  const current = form.getValues("recommendToFriend");
                  form.setValue("recommendToFriend", !current);
                }}
                className="w-full"
              >
                <ThumbsUp size={20} />
                <Text>I'd recommend this to friends</Text>
              </Button>
              
              <Button
                variant={form.watch("visitAgain") ? "default" : "outline"}
                onPress={() => {
                  const current = form.getValues("visitAgain");
                  form.setValue("visitAgain", !current);
                }}
                className="w-full"
              >
                <Sparkles size={20} />
                <Text>I'll definitely visit again</Text>
              </Button>
            </View>
          )}
        </View>
      ),
      validation: () => overallRating > 0,
    },
    {
      title: "Detailed Ratings",
      subtitle: "Rate specific aspects",
      content: (
        <ScrollView showsVerticalScrollIndicator={false} className="py-4">
          <View className="gap-6">
            <View>
              <StarRating
                rating={detailedRatings.food}
                onRatingChange={(rating) => 
                  setDetailedRatings({ ...detailedRatings, food: rating })
                }
                label="Food Quality"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Taste, presentation, authenticity</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.service}
                onRatingChange={(rating) => 
                  setDetailedRatings({ ...detailedRatings, service: rating })
                }
                label="Service"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Staff friendliness, speed, attentiveness</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.ambiance}
                onRatingChange={(rating) => 
                  setDetailedRatings({ ...detailedRatings, ambiance: rating })
                }
                label="Ambiance"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Atmosphere, decor, noise level</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.value}
                onRatingChange={(rating) => 
                  setDetailedRatings({ ...detailedRatings, value: rating })
                }
                label="Value for Money"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Portion size, pricing, overall value</Muted>
            </View>
          </View>
        </ScrollView>
      ),
      validation: () => Object.values(detailedRatings).every(r => r > 0),
    },
    {
      title: "Quick Tags",
      subtitle: "What stood out?",
      content: (
        <ScrollView showsVerticalScrollIndicator={false} className="py-4">
          <View>
            <H3 className="mb-4">What was great?</H3>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {REVIEW_TAGS.positive.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedTags.includes(tag)
                      ? "bg-green-100 dark:bg-green-900/20 border-green-500"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      selectedTags.includes(tag)
                        ? "text-green-800 dark:text-green-200"
                        : ""
                    }
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            <H3 className="mb-4">Any issues?</H3>
            <View className="flex-row flex-wrap gap-2">
              {REVIEW_TAGS.negative.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => {
                    if (selectedTags.includes(tag)) {
                      setSelectedTags(selectedTags.filter(t => t !== tag));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedTags.includes(tag)
                      ? "bg-red-100 dark:bg-red-900/20 border-red-500"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      selectedTags.includes(tag)
                        ? "text-red-800 dark:text-red-200"
                        : ""
                    }
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ),
      validation: () => true, // Optional step
    },
    {
      title: "Share Your Experience",
      subtitle: "Tell others about your visit",
      content: (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView showsVerticalScrollIndicator={false} className="py-4">
            <Form {...form}>
              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormTextarea
                    label="Write Your Review"
                    placeholder="Share details about your experience - what you ordered, what you loved, service quality, atmosphere..."
                    numberOfLines={6}
                    maxLength={1000}
                    {...field}
                  />
                )}
              />
            </Form>
            
            {/* Photo Upload Section */}
            <View className="mt-6">
              <Text className="font-medium mb-3">Add Photos</Text>
              <View className="flex-row flex-wrap gap-3">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo }}
                      className="w-20 h-20 rounded-lg"
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() => {
                        const newPhotos = photos.filter((_, i) => i !== index);
                        setPhotos(newPhotos);
                        form.setValue("photos", newPhotos);
                      }}
                      className="absolute -top-2 -right-2 bg-destructive rounded-full p-1"
                    >
                      <X size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                
                {photos.length < 5 && (
                  <Pressable
                    onPress={handlePhotoUpload}
                    disabled={uploadingPhotos}
                    className="w-20 h-20 bg-muted rounded-lg items-center justify-center"
                  >
                    {uploadingPhotos ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <>
                        <Camera size={24} color="#666" />
                        <Text className="text-xs mt-1">Add Photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
              <Muted className="text-xs mt-2">
                Add up to 5 photos • {photos.length}/5
              </Muted>
            </View>
            
            {/* Tips for Good Reviews */}
            <View className="bg-primary/10 p-4 rounded-lg mt-6">
              <Text className="font-medium mb-2">Tips for helpful reviews:</Text>
              <View className="gap-1">
                <Text className="text-sm">• Mention specific dishes you tried</Text>
                <Text className="text-sm">• Describe the atmosphere and service</Text>
                <Text className="text-sm">• Share what made it special or needs improvement</Text>
                <Text className="text-sm">• Be honest and constructive</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ),
      validation: () => form.getValues("comment").length >= 10,
    },
  ];

  // 12. Loading State
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <H3>Booking not found</H3>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepData = reviewSteps[currentStep];

  // 13. Main Render
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* 13.1 Header */}
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text className="text-center font-semibold">Review Your Visit</Text>
            <Muted className="text-center text-sm">{restaurant.name}</Muted>
          </View>
          <View className="w-10" />
        </View>
      </View>
      
      {/* 13.2 Progress Bar */}
      <View className="h-1 bg-muted">
        <View
          className="h-full bg-primary"
          style={{ width: `${((currentStep + 1) / reviewSteps.length) * 100}%` }}
        />
      </View>
      
      {/* 13.3 Restaurant Info Card */}
      <View className="mx-4 mt-4 p-3 bg-card rounded-lg shadow-sm flex-row items-center gap-3">
        <Image
          source={{ uri: restaurant.main_image_url }}
          className="w-16 h-16 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1">
          <Text className="font-semibold">{restaurant.name}</Text>
          <Text className="text-sm text-muted-foreground">
            Visited on {new Date(booking.booking_time).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      {/* 13.4 Step Content */}
      <View className="flex-1 px-4 mt-4">
        <H2>{currentStepData.title}</H2>
        <Muted className="mb-4">{currentStepData.subtitle}</Muted>
        
        <View className="flex-1">
          {currentStepData.content}
        </View>
      </View>
      
      {/* 13.5 Navigation Buttons */}
      <View className="p-4 border-t border-border">
        <View className="flex-row gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onPress={() => setCurrentStep(currentStep - 1)}
              className="flex-1"
            >
              <Text>Previous</Text>
            </Button>
          )}
          
          <Button
            variant="default"
            onPress={() => {
              if (!currentStepData.validation()) {
                Alert.alert("Incomplete", "Please complete this step before continuing");
                return;
              }
              
              if (currentStep === reviewSteps.length - 1) {
                submitReview();
              } else {
                setCurrentStep(currentStep + 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : currentStep === reviewSteps.length - 1 ? (
              <>
                <Text>Submit Review</Text>
                <CheckCircle size={20} />
              </>
            ) : (
              <Text>Next</Text>
            )}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}