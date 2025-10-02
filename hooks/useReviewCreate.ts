import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "expo-router";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { REVIEW_VALIDATION, REVIEW_POINTS } from "@/constants/reviewConstants";
import { InputValidator } from "@/lib/security";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface ReviewFormData {
  rating: number;
  comment: string;
  foodRating: number;
  serviceRating: number;
  ambianceRating: number;
  valueRating: number;
  recommendToFriend?: boolean;
  visitAgain?: boolean;
  tags: string[];
  photos: string[];
}

interface DetailedRatings {
  food: number;
  service: number;
  ambiance: number;
  value: number;
}

interface UseReviewCreateParams {
  bookingId: string;
  restaurantId: string;
}

const reviewSchema = z.object({
  rating: z.number().min(1, "Overall rating is required").max(5),
  comment: z
    .string()
    .min(
      REVIEW_VALIDATION.MIN_COMMENT_LENGTH,
      `Please write at least ${REVIEW_VALIDATION.MIN_COMMENT_LENGTH} characters`,
    )
    .max(REVIEW_VALIDATION.MAX_COMMENT_LENGTH, "Review too long")
    .refine(
      (text) => {
        const validation = InputValidator.validateContent(text, {
          maxLength: REVIEW_VALIDATION.MAX_COMMENT_LENGTH,
          minLength: REVIEW_VALIDATION.MIN_COMMENT_LENGTH,
          checkProfanity: true,
          fieldName: "review",
        });
        return validation.isValid;
      },
      {
        message: "Please review your text for inappropriate language or spam",
      },
    ),
  foodRating: z.number().min(1, "Food rating is required").max(5),
  serviceRating: z.number().min(1, "Service rating is required").max(5),
  ambianceRating: z.number().min(1, "Ambiance rating is required").max(5),
  valueRating: z.number().min(1, "Value rating is required").max(5),
  recommendToFriend: z.boolean().default(false),
  visitAgain: z.boolean().default(false),
  tags: z
    .array(z.string())
    .min(REVIEW_VALIDATION.MIN_TAGS, "Please select at least one tag")
    .max(REVIEW_VALIDATION.MAX_TAGS, "Too many tags"),
  photos: z
    .array(z.string())
    .max(
      REVIEW_VALIDATION.MAX_PHOTOS,
      `Maximum ${REVIEW_VALIDATION.MAX_PHOTOS} photos allowed`,
    ),
});

export function useReviewCreate({
  bookingId,
  restaurantId,
}: UseReviewCreateParams) {
  const { profile } = useAuth();
  const router = useRouter();

  // Data states
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Review form state
  const [overallRating, setOverallRating] = useState(0);
  const [detailedRatings, setDetailedRatings] = useState<DetailedRatings>({
    food: 0,
    service: 0,
    ambiance: 0,
    value: 0,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Form setup
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
    mode: "onChange",
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!bookingId || !restaurantId) {
      Alert.alert(
        "Error",
        `Missing required information:\n${!bookingId ? "• Booking ID\n" : ""}${!restaurantId ? "• Restaurant ID" : ""}\n\nPlease ensure you have a completed booking to review.`,
      );
      router.back();
      return;
    }

    try {
      // Fetch restaurant details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (restaurantError) {
        console.error("Restaurant fetch error:", restaurantError);
        throw new Error(`Restaurant not found: ${restaurantError.message}`);
      }

      // Fetch booking details
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError) {
        console.error("Booking fetch error:", bookingError);
        throw new Error(`Booking not found: ${bookingError.message}`);
      }

      setRestaurant(restaurantData);
      setBooking(bookingData);
    } catch (error) {
      console.error("Data fetch error:", error);
      Alert.alert(
        "Error",
        "Failed to load booking details. Please try again.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, restaurantId, router]);

  // Calculate loyalty points
  const calculateReviewPoints = useCallback(
    (photoCount: number, commentLength: number): number => {
      let points = REVIEW_POINTS.BASE_POINTS;

      // Photo bonuses
      points += photoCount * REVIEW_POINTS.PHOTO_BONUS;

      // Comment length bonuses
      REVIEW_POINTS.COMMENT_LENGTH_BONUSES.forEach(
        ({ minLength, points: bonus }) => {
          if (commentLength >= minLength) {
            points += bonus;
          }
        },
      );

      // Quality bonuses
      if (selectedTags.length >= REVIEW_POINTS.TAG_BONUS_THRESHOLD) {
        points += REVIEW_POINTS.TAG_BONUS_POINTS;
      }
      if (selectedTags.length >= REVIEW_POINTS.EXCELLENT_TAG_BONUS_THRESHOLD) {
        points += REVIEW_POINTS.EXCELLENT_TAG_BONUS_POINTS;
      }

      // All ratings bonus
      const allRatingsGiven = Object.values(detailedRatings).every(
        (r) => r > 0,
      );
      if (allRatingsGiven) {
        points += REVIEW_POINTS.ALL_RATINGS_BONUS;
      }

      return Math.min(points, REVIEW_POINTS.MAX_POINTS);
    },
    [selectedTags.length, detailedRatings],
  );

  // Award loyalty points
  // TODO: Re-enable loyalty points for reviews when feature is ready
  // const awardLoyaltyPoints = useCallback(
  //   async (userId: string, points: number): Promise<void> => {
  //     try {
  //       const { error } = await supabase.rpc("award_loyalty_points", {
  //         p_user_id: userId,
  //         p_points: points,
  //       });

  //       if (error) {
  //         console.error("Failed to award loyalty points:", error);
  //       }
  //     } catch (error) {
  //       console.error("Loyalty points award error:", error);
  //     }
  //   },
  //   [],
  // );

  // Submit review
  const submitReview = useCallback(async () => {
    if (!profile?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      // Prepare review data
      const reviewData = {
        user_id: profile.id,
        restaurant_id: restaurantId,
        booking_id: bookingId,
        rating: overallRating,
        comment: form.getValues("comment"),
        food_rating: detailedRatings.food,
        service_rating: detailedRatings.service,
        ambiance_rating: detailedRatings.ambiance,
        value_rating: detailedRatings.value,
        recommend_to_friend: form.getValues("recommendToFriend"),
        visit_again: form.getValues("visitAgain"),
        tags: selectedTags,
        photos: photos,
      };

      // Submit review
      const { error: reviewError } = await supabase
        .from("reviews")
        .insert([reviewData]);

      if (reviewError) {
        throw new Error(`Failed to create review: ${reviewError.message}`);
      }

      // Award loyalty points - TEMPORARILY DISABLED
      // TODO: Re-enable when loyalty points feature is ready
      // const pointsToAward = calculateReviewPoints(
      //   photos.length,
      //   form.getValues("comment")?.length || 0,
      // );
      // await awardLoyaltyPoints(profile.id, pointsToAward);

      Alert.alert(
        "Review Submitted!",
        "Thank you for your review!", // Removed loyalty points message
        [
          {
            text: "OK",
            onPress: () => {
              router.back();
            },
          },
        ],
      );
    } catch (error) {
      console.error("Review submission error:", error);
      Alert.alert(
        "Submission Failed",
        "Failed to submit your review. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    profile?.id,
    restaurantId,
    bookingId,
    overallRating,
    detailedRatings,
    selectedTags,
    photos,
    form,
    calculateReviewPoints,
    // awardLoyaltyPoints, // Commented out - loyalty points disabled
    router,
  ]);

  // Validation helpers
  const validateStep = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 0: // Overall rating
          if (overallRating === 0) {
            Alert.alert("Required", "Please rate your overall experience");
            return false;
          }
          return true;

        case 1: // Detailed ratings
          const allRated = Object.values(detailedRatings).every((r) => r > 0);
          if (!allRated) {
            Alert.alert(
              "Required",
              "Please rate all aspects before continuing",
            );
            return false;
          }
          return true;

        case 2: // Tags
          if (selectedTags.length === 0) {
            Alert.alert("Required", "Please select at least one tag");
            return false;
          }
          return true;

        case 3: // Comment
          const comment = form.getValues("comment") || "";
          const commentLength = comment.length;
          if (commentLength < REVIEW_VALIDATION.MIN_COMMENT_LENGTH) {
            Alert.alert(
              "Required",
              `Please write at least ${REVIEW_VALIDATION.MIN_COMMENT_LENGTH} characters in your review`,
            );
            return false;
          }

          // Check for profanity and spam
          const contentValidation = InputValidator.validateContent(comment, {
            maxLength: REVIEW_VALIDATION.MAX_COMMENT_LENGTH,
            minLength: REVIEW_VALIDATION.MIN_COMMENT_LENGTH,
            checkProfanity: true,
            fieldName: "review",
          });

          if (!contentValidation.isValid) {
            Alert.alert("Content Issue", contentValidation.errors.join("\n"));
            return false;
          }

          return true;

        default:
          return true;
      }
    },
    [overallRating, detailedRatings, selectedTags, form],
  );

  // Update form values when state changes
  useEffect(() => {
    form.setValue("rating", overallRating);
  }, [overallRating, form]);

  useEffect(() => {
    Object.entries(detailedRatings).forEach(([key, value]) => {
      form.setValue(`${key}Rating` as keyof ReviewFormData, value);
    });
  }, [detailedRatings, form]);

  useEffect(() => {
    form.setValue("tags", selectedTags);
  }, [selectedTags, form]);

  useEffect(() => {
    form.setValue("photos", photos);
  }, [photos, form]);

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    // Data
    restaurant,
    booking,
    loading,
    submitting,

    // Form state
    form,
    overallRating,
    setOverallRating,
    detailedRatings,
    setDetailedRatings,
    selectedTags,
    setSelectedTags,
    photos,
    setPhotos,
    currentStep,
    setCurrentStep,

    // Actions
    submitReview,
    validateStep,
    calculateReviewPoints,
  };
}
