import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Award,
  Star,
  Crown,
  Sparkles,
} from "lucide-react-native";

// Enhanced booking status configuration
export const BOOKING_STATUS_CONFIG = {
  pending: {
    label: "Pending Confirmation",
    icon: AlertCircle,
    color: "#f59e0b",
    bgColor: "#fef3c7",
    description:
      "Your booking is waiting for restaurant confirmation. We'll notify you once it's confirmed.",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle,
    color: "#10b981",
    bgColor: "#d1fae5",
    description:
      "Your table is confirmed! Please arrive on time and show your confirmation code.",
  },
  cancelled_by_user: {
    label: "Cancelled by You",
    icon: XCircle,
    color: "#6b7280",
    bgColor: "#f3f4f6",
    description: "You cancelled this booking.",
  },
  declined_by_restaurant: {
    label: "Declined by Restaurant",
    icon: XCircle,
    color: "#ef4444",
    bgColor: "#fee2e2",
    description:
      "Unfortunately, the restaurant couldn't accommodate your booking.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "#3b82f6",
    bgColor: "#dbeafe",
    description:
      "Thank you for dining with us! We hope you had a great experience.",
  },
  no_show: {
    label: "No Show",
    icon: AlertCircle,
    color: "#dc2626",
    bgColor: "#fee2e2",
    description: "This booking was marked as a no-show.",
  },
} as const;

// Tier configuration for display
export const TIER_DISPLAY_CONFIG = {
  bronze: { name: "Bronze", color: "#CD7F32", icon: Award },
  silver: { name: "Silver", color: "#C0C0C0", icon: Star },
  gold: { name: "Gold", color: "#FFD700", icon: Crown },
  platinum: { name: "Platinum", color: "#E5E4E2", icon: Sparkles },
} as const;

// Default map coordinates (Beirut, Lebanon)
export const DEFAULT_MAP_COORDINATES = {
  latitude: 33.8938,
  longitude: 35.5018,
};

// Map region configuration
export const MAP_REGION_CONFIG = {
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};
