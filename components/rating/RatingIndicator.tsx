// components/rating/RatingIndicator.tsx
import React from "react";
import { View, Text } from "react-native";
import { useUserRating } from "@/hooks/useUserRating";

interface RatingIndicatorProps {
  userId?: string;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
}

export function RatingIndicator({ userId, showLabel = true, size = "medium" }: RatingIndicatorProps) {
  const {
    currentRating,
    tier,
    loading,
    isExcellent,
    isGood,
    isRestricted,
    isBlocked,
  } = useUserRating(userId);

  const getSizeClasses = (size: string) => {
    switch (size) {
      case "small":
        return {
          dot: "w-2 h-2",
          text: "text-xs",
          rating: "text-xs",
        };
      case "large":
        return {
          dot: "w-4 h-4",
          text: "text-lg",
          rating: "text-lg font-bold",
        };
      default: // medium
        return {
          dot: "w-3 h-3",
          text: "text-sm",
          rating: "text-sm font-semibold",
        };
    }
  };

  if (loading) {
    return (
      <View className="flex-row items-center">
        <View className={`rounded-full bg-gray-200 ${getSizeClasses(size).dot}`} />
        {showLabel && (
          <Text className={`ml-2 text-gray-400 ${getSizeClasses(size).text}`}>
            Loading...
          </Text>
        )}
      </View>
    );
  }

  const getRatingColor = () => {
    if (isExcellent) return "bg-green-500";
    if (isGood) return "bg-blue-500";
    if (isRestricted) return "bg-amber-500";
    if (isBlocked) return "bg-red-500";
    return "bg-gray-400";
  };

  const getRatingLabel = () => {
    if (isExcellent) return "Excellent";
    if (isGood) return "Good";
    if (isRestricted) return "Restricted";
    if (isBlocked) return "Blocked";
    return "Unknown";
  };

  return (
    <View className="flex-row items-center">
      <View className={`rounded-full ${getRatingColor()} ${getSizeClasses(size).dot}`} />
      
      {showLabel && (
        <Text className={`ml-2 text-gray-700 ${getSizeClasses(size).text}`}>
          {getRatingLabel()}
        </Text>
      )}
      
      <Text className={`ml-1 text-gray-900 ${getSizeClasses(size).rating}`}>
        {currentRating.toFixed(1)}
      </Text>
    </View>
  );
}

// Component for showing booking eligibility status
interface BookingEligibilityIndicatorProps {
  restaurantId: string;
  size?: "small" | "medium";
}

export function BookingEligibilityIndicator({ restaurantId, size = "medium" }: BookingEligibilityIndicatorProps) {
  const { checkBookingEligibility } = useUserRating();
  const [eligibility, setEligibility] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkEligibility = async () => {
      try {
        const result = await checkBookingEligibility(restaurantId);
        setEligibility(result);
      } catch (error) {
        console.error("Error checking eligibility:", error);
      } finally {
        setLoading(false);
      }
    };

    checkEligibility();
  }, [restaurantId, checkBookingEligibility]);

  if (loading) {
    return (
      <View className="flex-row items-center">
        <View className={`rounded bg-gray-200 ${size === "small" ? "px-2 py-1" : "px-3 py-2"}`}>
          <Text className={`text-gray-400 ${size === "small" ? "text-xs" : "text-sm"}`}>
            Checking...
          </Text>
        </View>
      </View>
    );
  }

  if (!eligibility) {
    return null; // Hide if we can't determine eligibility
  }

  const getStatusColor = () => {
    if (!eligibility.can_book) return "bg-red-100 text-red-800";
    if (!eligibility.can_instant_book) return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-800";
  };

  const getStatusText = () => {
    if (!eligibility.can_book) return "Booking Blocked";
    if (!eligibility.can_instant_book) return "Request Only";
    return "Instant Booking";
  };

  return (
    <View className={`rounded ${getStatusColor()} ${size === "small" ? "px-2 py-1" : "px-3 py-2"}`}>
      <Text className={`font-medium ${size === "small" ? "text-xs" : "text-sm"}`}>
        {getStatusText()}
      </Text>
    </View>
  );
}
