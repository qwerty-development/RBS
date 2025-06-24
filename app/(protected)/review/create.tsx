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
  AlertCircle,
  Upload,
  Trash2,
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

// 1. ENHANCED TYPE DEFINITIONS AND CONSTANTS
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

// 2. COMPREHENSIVE REVIEW TAGS FOR LEBANESE CONTEXT
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
    "Traditional Decor",
    "Friendly Staff",
    "Clean Environment",
    "Perfect Portions",
    "Fresh Bread",
    "Great Hummus",
    "Excellent Tabbouleh",
    "Beautiful Presentation",
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
    "Cold Food",
    "Slow Service",
    "Unfriendly Staff",
    "Dirty Tables",
    "No Atmosphere",
    "Overcooked",
    "Bland Taste",
    "Poor Quality",
  ],
};

// 3. ENHANCED VALIDATION SCHEMA WITH COMPREHENSIVE RULES
const reviewSchema = z.object({
  rating: z.number().min(1, "Overall rating is required").max(5),
  comment: z.string().min(10, "Please write at least 10 characters").max(1000, "Review too long"),
  foodRating: z.number().min(1, "Food rating is required").max(5),
  serviceRating: z.number().min(1, "Service rating is required").max(5),
  ambianceRating: z.number().min(1, "Ambiance rating is required").max(5),
  valueRating: z.number().min(1, "Value rating is required").max(5),
  recommendToFriend: z.boolean().default(false),
  visitAgain: z.boolean().default(false),
  tags: z.array(z.string()).min(1, "Please select at least one tag").max(10, "Too many tags"),
  photos: z.array(z.string()).max(5, "Maximum 5 photos allowed"),
});

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ReviewCreateScreen() {
  // 4. COMPREHENSIVE STATE MANAGEMENT
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
  
  // 4.3 UI State
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState<Record<string, number>>({});
  
  // 4.4 Form Setup with Enhanced Validation
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
    mode: "onChange", // Real-time validation
  });

  // 5. ENHANCED DATA FETCHING WITH ERROR RECOVERY
  const fetchData = useCallback(async () => {
    if (!params.bookingId || !params.restaurantId) {
      Alert.alert("Error", "Missing booking or restaurant information");
      router.back();
      return;
    }

    try {
      console.log("Fetching review data:", params);

      // 5.1 Fetch restaurant details with enhanced error handling
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", params.restaurantId)
        .single();
      
      if (restaurantError) {
        console.error("Restaurant fetch error:", restaurantError);
        throw new Error(`Restaurant not found: ${restaurantError.message}`);
      }
      
      if (!restaurantData) {
        throw new Error("Restaurant data is null");
      }
      
      setRestaurant(restaurantData);
      console.log("Restaurant fetched:", restaurantData.name);
      
      // 5.2 Fetch booking details with validation
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", params.bookingId)
        .single();
      
      if (bookingError) {
        console.error("Booking fetch error:", bookingError);
        throw new Error(`Booking not found: ${bookingError.message}`);
      }
      
      if (!bookingData) {
        throw new Error("Booking data is null");
      }

      // 5.3 Validate booking ownership
      if (bookingData.user_id !== profile?.id) {
        throw new Error("You can only review your own bookings");
      }

      // 5.4 Validate booking status
      if (bookingData.status !== "completed") {
        Alert.alert(
          "Booking Not Completed",
          "You can only review completed bookings.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }
      
      setBooking(bookingData);
      console.log("Booking validated:", bookingData.id);
      
      // 5.5 Check if review already exists
      const { data: existingReview, error: reviewCheckError } = await supabase
        .from("reviews")
        .select("id")
        .eq("booking_id", params.bookingId)
        .single();
      
      if (reviewCheckError && reviewCheckError.code !== "PGRST116") {
        console.error("Review check error:", reviewCheckError);
        throw reviewCheckError;
      }
      
      if (existingReview) {
        Alert.alert(
          "Review Already Submitted",
          "You have already reviewed this booking.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      console.log("Review validation complete - ready to create review");
      
    } catch (error) {
      console.error("Error in fetchData:", error);
      Alert.alert(
        "Error", 
        error instanceof Error ? error.message : "Failed to load booking details",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } finally {
      setLoading(false);
    }
  }, [params, profile?.id, router]);

  // 6. ENHANCED PHOTO UPLOAD WITH PROGRESS TRACKING
  const handlePhotoUpload = useCallback(async () => {
    if (photos.length >= 5) {
      Alert.alert("Limit Reached", "You can only upload up to 5 photos");
      return;
    }
    
    try {
      // 6.1 Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to upload photos."
        );
        return;
      }
      
      // 6.2 Launch image picker with enhanced options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
        exif: false,
        allowsEditing: false,
        selectionLimit: 5 - photos.length,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      
      setUploadingPhotos(true);
      
      // 6.3 Upload each photo with progress tracking
      const uploadPromises = result.assets.map(async (asset, index) => {
        const fileExt = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `reviews/${profile?.id}/${params.bookingId}/${Date.now()}-${index}.${fileExt}`;
        
        try {
          // Convert image URI to blob for upload
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          const { error, data } = await supabase.storage
            .from("review-photos")
            .upload(fileName, blob, {
              contentType: `image/${fileExt}`,
              upsert: false,
            });
          
          if (error) {
            console.error("Upload error for", fileName, ":", error);
            throw new Error(`Failed to upload photo: ${error.message}`);
          }
          
          // Get public URL
          const { data: urlData } = supabase.storage
            .from("review-photos")
            .getPublicUrl(fileName);
          
          if (!urlData?.publicUrl) {
            throw new Error("Failed to get photo URL");
          }
          
          return urlData.publicUrl;
          
        } catch (uploadError) {
          console.error("Individual upload failed:", uploadError);
          throw uploadError;
        }
      });
      
      // 6.4 Process uploads with error handling
      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads: string[] = [];
      const failedUploads: string[] = [];
      
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successfulUploads.push(result.value);
        } else {
          failedUploads.push(`Photo ${index + 1}`);
          console.error("Upload failed:", result.reason);
        }
      });
      
      if (successfulUploads.length > 0) {
        const newPhotos = [...photos, ...successfulUploads];
        setPhotos(newPhotos);
        form.setValue("photos", newPhotos);
        
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      if (failedUploads.length > 0) {
        Alert.alert(
          "Upload Issues",
          `${failedUploads.join(", ")} failed to upload. ${successfulUploads.length} photo(s) uploaded successfully.`
        );
      }
      
    } catch (error) {
      console.error("Photo upload error:", error);
      Alert.alert(
        "Upload Failed", 
        error instanceof Error ? error.message : "Failed to upload photos. Please try again."
      );
    } finally {
      setUploadingPhotos(false);
    }
  }, [photos, profile?.id, params.bookingId, form]);

  // 7. ENHANCED REVIEW SUBMISSION WITH COMPREHENSIVE ERROR HANDLING
  const submitReview = useCallback(async () => {
    if (!profile?.id || !booking || !restaurant) {
      Alert.alert("Error", "Missing required information");
      return;
    }

    // 7.1 Pre-submission validation
    const validationErrors: string[] = [];
    
    if (overallRating === 0) validationErrors.push("Overall rating");
    if (detailedRatings.food === 0) validationErrors.push("Food rating");
    if (detailedRatings.service === 0) validationErrors.push("Service rating");
    if (detailedRatings.ambiance === 0) validationErrors.push("Ambiance rating");
    if (detailedRatings.value === 0) validationErrors.push("Value rating");
    if (selectedTags.length === 0) validationErrors.push("At least one tag");
    
    const comment = form.getValues("comment");
    if (!comment || comment.trim().length < 10) validationErrors.push("Review comment (minimum 10 characters)");
    
    if (validationErrors.length > 0) {
      Alert.alert(
        "Incomplete Review",
        `Please complete:\n• ${validationErrors.join('\n• ')}`,
        [{ text: "OK" }]
      );
      return;
    }
    
    setSubmitting(true);
    
    try {
      console.log("Starting review submission...");

      // 7.2 Prepare comprehensive review data
      const reviewData = {
        booking_id: booking.id,
        user_id: profile.id,
        restaurant_id: restaurant.id,
        
        // Ratings
        rating: overallRating,
        food_rating: detailedRatings.food,
        service_rating: detailedRatings.service,
        ambiance_rating: detailedRatings.ambiance,
        value_rating: detailedRatings.value,
        
        // Content
        comment: comment.trim(),
        tags: selectedTags,
        photos: photos,
        
        // Preferences
        recommend_to_friend: form.getValues("recommendToFriend"),
        visit_again: form.getValues("visitAgain"),
        
        // Metadata
        created_at: new Date().toISOString(),
      };

      console.log("Review data prepared:", {
        ...reviewData,
        comment: `${reviewData.comment.substring(0, 50)}...`,
        photos: `${reviewData.photos.length} photos`
      });
      
      // 7.3 Submit review to database
      const { data: reviewResult, error: reviewError } = await supabase
        .from("reviews")
        .insert([reviewData])
        .select()
        .single();
      
      if (reviewError) {
        console.error("Review submission error:", reviewError);
        throw new Error(`Failed to submit review: ${reviewError.message}`);
      }
      
      if (!reviewResult) {
        throw new Error("Review submission returned no data");
      }
      
      console.log("Review submitted successfully:", reviewResult.id);
      
      // 7.4 Award loyalty points
      const points = calculateReviewPoints(photos.length, comment.length);
      await awardLoyaltyPoints(profile.id, points);
      console.log("Loyalty points awarded:", points);
      
      // 7.5 Success feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // 7.6 Navigate to success state
      Alert.alert(
        "Thank You!",
        `Your review has been submitted successfully! You earned ${points} loyalty points.`,
        [
          {
            text: "View Restaurant",
            onPress: () => {
              router.dismissAll();
              router.push({
                pathname: "/restaurant/[id]",
                params: { id: restaurant.id },
              });
            },
          },
          {
            text: "Back to Bookings",
            onPress: () => {
              router.dismissAll();
              router.push("/bookings");
            },
          },
        ]
      );
      
    } catch (error) {
      console.error("Review submission failed:", error);
      Alert.alert(
        "Submission Failed", 
        error instanceof Error ? error.message : "Please try again.",
        [
          { text: "Retry", onPress: () => submitReview() },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    profile?.id, 
    booking, 
    restaurant, 
    overallRating, 
    detailedRatings, 
    selectedTags, 
    photos, 
    form, 
    router
  ]);

  // 8. ENHANCED HELPER FUNCTIONS
  const calculateReviewPoints = (photoCount: number, commentLength: number): number => {
    let points = 50; // Base points for any review
    
    // Photo bonuses
    points += photoCount * 10; // 10 points per photo
    
    // Comment length bonuses
    if (commentLength >= 50) points += 10; // Decent detail
    if (commentLength >= 100) points += 20; // Good detail
    if (commentLength >= 200) points += 15; // Excellent detail
    if (commentLength >= 300) points += 10; // Exceptional detail
    
    // Quality bonuses
    if (selectedTags.length >= 3) points += 10; // Good tagging
    if (selectedTags.length >= 5) points += 5; // Excellent tagging
    
    // All ratings bonus
    const allRatingsGiven = Object.values(detailedRatings).every(r => r > 0);
    if (allRatingsGiven) points += 15;
    
    return Math.min(points, 150); // Cap at 150 points
  };

  const awardLoyaltyPoints = async (userId: string, points: number): Promise<void> => {
    try {
      const { error } = await supabase.rpc("award_loyalty_points", {
        p_user_id: userId,
        p_points: points,
      });
      
      if (error) {
        console.error("Failed to award loyalty points:", error);
        // Don't throw - this shouldn't block review submission
      }
    } catch (error) {
      console.error("Loyalty points award error:", error);
      // Don't throw - this shouldn't block review submission
    }
  };

  const removePhoto = useCallback((index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    form.setValue("photos", newPhotos);
  }, [photos, form]);

  // 9. ENHANCED STAR RATING COMPONENT
  const StarRating = ({ 
    rating, 
    onRatingChange, 
    size = 32,
    label,
    showLabels = true,
    disabled = false
  }: { 
    rating: number; 
    onRatingChange: (rating: number) => void;
    size?: number;
    label?: string;
    showLabels?: boolean;
    disabled?: boolean;
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
                if (!disabled) {
                  onRatingChange(star);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              className="p-1"
              disabled={disabled}
            >
              <Star
                size={size}
                color="#f59e0b"
                fill={star <= rating ? "#f59e0b" : "transparent"}
                style={{ opacity: disabled ? 0.6 : 1 }}
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

  // 10. KEYBOARD HANDLING
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // 11. LIFECYCLE MANAGEMENT
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 12. FORM VALIDATION HELPER
  const validateAndRecoverForm = useCallback(() => {
    const errors: string[] = [];
    
    if (overallRating === 0) errors.push("Overall rating");
    if (detailedRatings.food === 0) errors.push("Food rating");
    if (detailedRatings.service === 0) errors.push("Service rating");
    if (detailedRatings.ambiance === 0) errors.push("Ambiance rating");
    if (detailedRatings.value === 0) errors.push("Value rating");
    if (selectedTags.length === 0) errors.push("At least one tag");
    
    const comment = form.getValues("comment");
    if (!comment || comment.length < 10) errors.push("Review comment (min 10 chars)");
    
    if (errors.length > 0) {
      Alert.alert(
        "Incomplete Review",
        `Please complete:\n• ${errors.join('\n• ')}`,
        [{ text: "OK" }]
      );
      return false;
    }
    
    return true;
  }, [overallRating, detailedRatings, selectedTags, form]);

  // 13. ENHANCED REVIEW STEPS CONFIGURATION
  const reviewSteps = [
    {
      title: "Overall Experience",
      subtitle: "How was your visit?",
      content: (
        <View className="items-center py-8">
          <H3 className="mb-6 text-center">Rate Your Overall Experience</H3>
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      validation: () => {
        if (overallRating === 0) {
          Alert.alert("Required", "Please rate your overall experience");
          return false;
        }
        return true;
      },
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
                onRatingChange={(rating) => {
                  setDetailedRatings({ ...detailedRatings, food: rating });
                  form.setValue("foodRating", rating);
                }}
                label="Food Quality"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Taste, presentation, authenticity</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.service}
                onRatingChange={(rating) => {
                  setDetailedRatings({ ...detailedRatings, service: rating });
                  form.setValue("serviceRating", rating);
                }}
                label="Service"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Staff friendliness, speed, attentiveness</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.ambiance}
                onRatingChange={(rating) => {
                  setDetailedRatings({ ...detailedRatings, ambiance: rating });
                  form.setValue("ambianceRating", rating);
                }}
                label="Ambiance"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Atmosphere, decor, noise level</Muted>
            </View>
            
            <View>
              <StarRating
                rating={detailedRatings.value}
                onRatingChange={(rating) => {
                  setDetailedRatings({ ...detailedRatings, value: rating });
                  form.setValue("valueRating", rating);
                }}
                label="Value for Money"
                showLabels={false}
              />
              <Muted className="text-sm mt-1">Portion size, pricing, overall value</Muted>
            </View>
          </View>
        </ScrollView>
      ),
      validation: () => {
        const requiredRatings = Object.values(detailedRatings);
        const allRated = requiredRatings.every(r => r > 0);
        
        if (!allRated) {
          Alert.alert("Required", "Please rate all aspects before continuing");
          return false;
        }
        return true;
      },
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
                      const newTags = selectedTags.filter(t => t !== tag);
                      setSelectedTags(newTags);
                      form.setValue("tags", newTags);
                    } else {
                      if (selectedTags.length >= 10) {
                        Alert.alert("Tag Limit", "You can select up to 10 tags");
                        return;
                      }
                      const newTags = [...selectedTags, tag];
                      setSelectedTags(newTags);
                      form.setValue("tags", newTags);
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedTags.includes(tag)
                      ? "bg-green-100 dark:bg-green-900/20 border-green-500"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selectedTags.includes(tag)
                        ? "text-green-800 dark:text-green-200 font-medium"
                        : ""
                    }`}
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
                      const newTags = selectedTags.filter(t => t !== tag);
                      setSelectedTags(newTags);
                      form.setValue("tags", newTags);
                    } else {
                      if (selectedTags.length >= 10) {
                        Alert.alert("Tag Limit", "You can select up to 10 tags");
                        return;
                      }
                      const newTags = [...selectedTags, tag];
                      setSelectedTags(newTags);
                      form.setValue("tags", newTags);
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={`px-4 py-2 rounded-full border ${
                    selectedTags.includes(tag)
                      ? "bg-red-100 dark:bg-red-900/20 border-red-500"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selectedTags.includes(tag)
                        ? "text-red-800 dark:text-red-200 font-medium"
                        : ""
                    }`}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            <View className="mt-6 p-3 bg-primary/10 rounded-lg">
              <Text className="text-sm text-primary font-medium">
                Selected tags: {selectedTags.length}/10
              </Text>
              {selectedTags.length === 0 && (
                <Text className="text-xs text-muted-foreground mt-1">
                  Please select at least one tag to continue
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      ),
      validation: () => {
        if (selectedTags.length === 0) {
          Alert.alert("Required", "Please select at least one tag");
          return false;
        }
        return true;
      },
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
                    onChangeText={(text) => {
                      field.onChange(text);
                      // Real-time character count update
                    }}
                  />
                )}
              />
            </Form>
            
            {/* Character Count */}
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-xs text-muted-foreground">
                {form.watch("comment")?.length || 0}/1000 characters
              </Text>
              <Text className="text-xs text-muted-foreground">
                {form.watch("comment")?.length >= 10 ? "✓ Minimum met" : "Minimum 10 characters"}
              </Text>
            </View>
            
            {/* Photo Upload Section */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-medium">Add Photos</Text>
                <Text className="text-sm text-muted-foreground">
                  {photos.length}/5
                </Text>
              </View>
              
              <View className="flex-row flex-wrap gap-3">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo }}
                      className="w-20 h-20 rounded-lg"
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-destructive rounded-full p-1"
                      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    >
                      <X size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                
                {photos.length < 5 && (
                  <Pressable
                    onPress={handlePhotoUpload}
                    disabled={uploadingPhotos}
                    className="w-20 h-20 bg-muted rounded-lg items-center justify-center border-2 border-dashed border-border"
                  >
                    {uploadingPhotos ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <>
                        <Camera size={24} color="#666" />
                        <Text className="text-xs mt-1 text-center">Add Photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
              
              <Muted className="text-xs mt-2">
                Photos help others see what to expect • {photos.length}/5 photos
              </Muted>
            </View>
            
            {/* Review Tips */}
            <View className="bg-primary/10 p-4 rounded-lg mt-6">
              <Text className="font-medium mb-2">💡 Tips for helpful reviews:</Text>
              <View className="gap-1">
                <Text className="text-sm">• Mention specific dishes you tried</Text>
                <Text className="text-sm">• Describe the atmosphere and service</Text>
                <Text className="text-sm">• Share what made it special or needs improvement</Text>
                <Text className="text-sm">• Be honest and constructive</Text>
                <Text className="text-sm">• Include photos of your food and the venue</Text>
              </View>
            </View>

            {/* Points Preview */}
            <View className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg mt-4">
              <Text className="font-medium text-green-800 dark:text-green-200 mb-2">
                🎉 Loyalty Points Preview
              </Text>
              <Text className="text-sm text-green-700 dark:text-green-300">
                You'll earn {calculateReviewPoints(photos.length, form.watch("comment")?.length || 0)} points for this review!
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ),
      validation: () => {
        const commentLength = form.getValues("comment")?.length || 0;
        if (commentLength < 10) {
          Alert.alert("Required", "Please write at least 10 characters in your review");
          return false;
        }
        return true;
      },
    },
  ];

  // 14. LOADING STATES
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

  if (!restaurant || !booking) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <AlertCircle size={48} color="#ef4444" />
          <H3 className="mt-4 text-center">Booking not found</H3>
          <P className="text-center text-muted-foreground mt-2">
            Unable to load the booking details needed to create a review.
          </P>
          <Button variant="outline" onPress={() => router.back()} className="mt-4">
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const currentStepData = reviewSteps[currentStep];

  // 15. MAIN RENDER
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <Pressable 
            onPress={() => {
              Alert.alert(
                "Cancel Review",
                "Are you sure you want to cancel? Your progress will be lost.",
                [
                  { text: "Continue Writing", style: "cancel" },
                  { text: "Cancel Review", style: "destructive", onPress: () => router.back() }
                ]
              );
            }} 
            className="p-2 -ml-2"
          >
            <ChevronLeft size={24} />
          </Pressable>
          <View className="flex-1 mx-4">
            <Text className="text-center font-semibold">Review Your Visit</Text>
            <Muted className="text-center text-sm">{restaurant.name}</Muted>
          </View>
          <View className="w-10" />
        </View>
      </View>
      
      {/* Progress Bar */}
      <View className="h-1 bg-muted">
        <View
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentStep + 1) / reviewSteps.length) * 100}%` }}
        />
      </View>
      
      {/* Restaurant Info Card */}
      <View className="mx-4 mt-4 p-4 bg-card rounded-lg shadow-sm border border-border">
        <View className="flex-row items-center gap-3">
          <Image
            source={{ uri: restaurant.main_image_url }}
            className="w-16 h-16 rounded-lg"
            contentFit="cover"
          />
          <View className="flex-1">
            <Text className="font-semibold">{restaurant.name}</Text>
            <Text className="text-sm text-muted-foreground">
              Visited on {new Date(booking.booking_time).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long', 
                day: 'numeric'
              })}
            </Text>
            <Text className="text-xs text-muted-foreground mt-1">
              Party of {booking.party_size}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Step Content */}
      <View className="flex-1 px-4 mt-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <H2>{currentStepData.title}</H2>
            <Muted className="text-sm">{currentStepData.subtitle}</Muted>
          </View>
          <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary text-sm font-medium">
              {currentStep + 1}/{reviewSteps.length}
            </Text>
          </View>
        </View>
        
        <View className="flex-1">
          {currentStepData.content}
        </View>
      </View>
      
      {/* Navigation Buttons */}
      <View className="p-4 border-t border-border bg-background">
        <View className="flex-row gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              onPress={() => {
                setCurrentStep(currentStep - 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              className="flex-1"
              disabled={submitting}
            >
              <Text>Previous</Text>
            </Button>
          )}
          
          <Button
            variant="default"
            onPress={() => {
              if (!currentStepData.validation()) {
                return;
              }
              
              if (currentStep === reviewSteps.length - 1) {
                // Final validation before submission
                if (validateAndRecoverForm()) {
                  submitReview();
                }
              } else {
                setCurrentStep(currentStep + 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text className="ml-2">Submitting...</Text>
              </>
            ) : currentStep === reviewSteps.length - 1 ? (
              <>
                <CheckCircle size={20} />
                <Text>Submit Review</Text>
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