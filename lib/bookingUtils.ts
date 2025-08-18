import { Alert } from "react-native";

// Date and Time Validation Utilities
export const isValidDate = (dateString: string | undefined): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.getTime() > 0;
};

export const parseDate = (
  dateString: string | undefined,
  fallback: Date = new Date(),
): Date => {
  if (!dateString) return fallback;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn("Invalid date string:", dateString);
      return fallback;
    }
    return date;
  } catch (error) {
    console.warn("Error parsing date:", dateString, error);
    return fallback;
  }
};

export const isValidTime = (timeString: string | undefined): boolean => {
  if (!timeString) return false;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

export const formatBookingDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatBookingTime = (timeString: string): string => {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (error) {
    return timeString;
  }
};

// Booking Configuration Constants
export const OCCASIONS = [
  { id: "none", label: "No Special Occasion", icon: null },
  { id: "birthday", label: "Birthday", icon: "🎂" },
  { id: "anniversary", label: "Anniversary", icon: "💑" },
  { id: "business", label: "Business Meeting", icon: "💼" },
  { id: "date", label: "Date Night", icon: "❤️" },
  { id: "engagement", label: "Engagement", icon: "💍" },
  { id: "graduation", label: "Graduation", icon: "🎓" },
  { id: "family", label: "Family Gathering", icon: "👨‍👩‍👧‍👦" },
  { id: "other", label: "Other Celebration", icon: "🎉" },
];

export const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Halal Only",
  "Gluten-Free",
  "Nut Allergy",
  "Dairy-Free",
  "Shellfish Allergy",
  "Kosher",
];

export const TABLE_PREFERENCES = [
  "Window Seat",
  "Outdoor Seating",
  "Quiet Area",
  "Near Bar",
  "Private Room",
  "High Chair Needed",
  "Wheelchair Accessible",
];

// Tier Configuration
export const TIER_CONFIG = {
  bronze: {
    name: "Bronze",
    color: "#787878", // Charcoal Mood
    pointsMultiplier: 1,
  },
  silver: {
    name: "Silver",
    color: "#D9C3DB", // Lavender Fog
    pointsMultiplier: 1.1,
  },
  gold: {
    name: "Gold",
    color: "#F2B25F", // Golden Crust
    pointsMultiplier: 1.2,
  },
  platinum: {
    name: "Platinum",
    color: "#792339", // Mulberry Velvet
    pointsMultiplier: 1.5,
  },
} as const;

export type TierType = keyof typeof TIER_CONFIG;

// Booking Status Configuration
export const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    color: "#F2B25F", // Golden Crust
    bgColor: "#FFECE2", // Blushed Linen
    description:
      "Your booking is waiting for restaurant confirmation. We'll notify you once it's confirmed.",
  },
  confirmed: {
    label: "Confirmed",
    color: "#F2B25F", // Golden Crust
    bgColor: "#D9C3DB", // Lavender Fog
    description:
      "Your table is confirmed! Please arrive on time and show your confirmation code.",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    color: "#787878", // Charcoal Mood
    bgColor: "#FFECE2", // Blushed Linen
    description: "You cancelled this booking.",
  },
  declined_by_restaurant: {
    label: "Declined by Restaurant",
    color: "#792339", // Mulberry Velvet
    bgColor: "#FFECE2", // Blushed Linen
    description:
      "Unfortunately, the restaurant couldn't accommodate your booking.",
  },
  completed: {
    label: "Completed",
    color: "#F2B25F", // Golden Crust
    bgColor: "#FFECE2", // Blushed Linen
    description:
      "Thank you for dining with us! We hope you had a great experience.",
  },
  no_show: {
    label: "No Show",
    color: "#792339", // Mulberry Velvet
    bgColor: "#D9C3DB", // Lavender Fog
    description: "This booking was marked as a no-show.",
  },
} as const;

export type BookingStatus = keyof typeof BOOKING_STATUS_CONFIG;

// Booking Helper Functions
export const calculateEarnablePoints = (
  partySize: number,
  priceRange: number = 2,
  tier: TierType = "bronze",
): number => {
  const basePoints = partySize * priceRange * 10;
  const multiplier = TIER_CONFIG[tier].pointsMultiplier;
  return Math.round(basePoints * multiplier);
};

export const isBookingUpcoming = (
  bookingDate: string,
  bookingTime: string,
): boolean => {
  try {
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    return bookingDateTime > new Date();
  } catch (error) {
    return false;
  }
};

export const isBookingToday = (bookingDate: string): boolean => {
  try {
    const booking = new Date(bookingDate);
    const today = new Date();
    return booking.toDateString() === today.toDateString();
  } catch (error) {
    return false;
  }
};

export const isBookingTomorrow = (bookingDate: string): boolean => {
  try {
    const booking = new Date(bookingDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return booking.toDateString() === tomorrow.toDateString();
  } catch (error) {
    return false;
  }
};

export const getTimeUntilBooking = (
  bookingDate: string,
  bookingTime: string,
): string => {
  try {
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();

    if (diffMs <= 0) return "Now";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    }
  } catch (error) {
    return "Unknown";
  }
};

// Validation Functions
export const validateBookingForm = (data: {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.acceptTerms) {
    errors.push("You must accept the booking terms and conditions");
  }

  if (data.specialRequests && data.specialRequests.length > 500) {
    errors.push("Special requests must be 500 characters or less");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Navigation Helpers
export const shareBookingDetails = async (booking: {
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  confirmationCode?: string;
}) => {
  try {
    const { Share } = await import("react-native");
    const message = `🍽️ Booking Confirmation\n\nRestaurant: ${booking.restaurantName}\nDate: ${formatBookingDate(new Date(booking.date))}\nTime: ${formatBookingTime(booking.time)}\nParty Size: ${booking.partySize} guests${booking.confirmationCode ? `\nConfirmation: ${booking.confirmationCode}` : ""}`;

    await Share.share({
      message,
      title: "Booking Details",
    });
  } catch (error) {
    console.error("Error sharing booking:", error);
    Alert.alert("Error", "Failed to share booking details");
  }
};
