// app/(protected)/booking/availability.tsx
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
  MapPin,
  Sparkles,
  QrCode,
  ArrowLeft,
  Clock,
  Timer,
  Search,
  X,
  UserPlus,
  User,
} from "lucide-react-native";
import { Calendar as RNCalendar } from "react-native-calendars";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "@/components/image";
import { getMaxBookingWindow } from "@/lib/tableManagementUtils";
import { useAuth } from "@/context/supabase-provider";
import { useRestaurant } from "@/hooks/useRestaurant";
import {
  useAvailability,
  useAvailabilityPreloader,
} from "@/hooks/useAvailability";
import {
  TimeSlots,
  TableOptions,
  SpecialRequirementsFormData,
} from "@/components/booking/TimeSlots";
import { TableOption } from "@/lib/AvailabilityService";

// New loyalty system imports
import { LoyaltyPointsDisplay } from "@/components/booking/LoyaltyPointsDisplay";
import { useBookingConfirmation } from "@/hooks/useBookingConfirmation";
import {
  PotentialLoyaltyPoints,
  useRestaurantLoyalty,
} from "@/hooks/useRestaurantLoyalty";

// Time Range Search imports
import {
  TimeRangeSelector,
  TimeRangeResult,
} from "@/components/booking/TimeRangeSelector";
import { useTimeRangeSearch } from "@/hooks/useTimeRangeSearch";

// Friend invitation imports
import { InviteFriendsModal } from "@/components/booking/InviteFriendsModal";

// Section selector imports
import { SectionSelector } from "@/components/booking/SectionSelector";
import { useRestaurantSections } from "@/hooks/useRestaurantSections";
import { getDefaultFormValues } from "@/lib/bookingFormHelpers";

// Inline offer selector imports
import { InlineOfferSelector } from "@/components/booking/InlineOfferSelector";

// Constants for form options
const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut Allergies",
  "Halal",
];

const TABLE_PREFERENCES = [
  "Booth",
  "Window Seat",
  "Patio/Outdoor",
  "Bar Seating",
  "Quiet Area",
  "Near Kitchen",
];

const OCCASIONS = [
  { id: "date", label: "Date Night" },
  { id: "business", label: "Business Meal" },
  { id: "birthday", label: "Birthday" },
  { id: "anniversary", label: "Anniversary" },
  { id: "celebration", label: "Celebration" },
  { id: "casual", label: "Casual Dining" },
  { id: "other", label: "Other" },
];

// Special Requirements Section Component
const SpecialRequirementsSection = React.memo<{
  formData: BookingFormData;
  onFormDataChange: (formData: BookingFormData) => void;
  showFormByDefault?: boolean;
}>(({ formData, onFormDataChange, showFormByDefault = false }) => {
  const [isExpanded, setIsExpanded] = useState(showFormByDefault);

  const toggleDietaryRestriction = useCallback(
    (restriction: string) => {
      const current = formData.dietaryRestrictions;
      const updated = current.includes(restriction)
        ? current.filter((r) => r !== restriction)
        : [...current, restriction];
      onFormDataChange({ ...formData, dietaryRestrictions: updated });
    },
    [formData, onFormDataChange],
  );

  const toggleTablePreference = useCallback(
    (preference: string) => {
      const current = formData.tablePreferences;
      const updated = current.includes(preference)
        ? current.filter((p) => p !== preference)
        : [...current, preference];
      onFormDataChange({ ...formData, tablePreferences: updated });
    },
    [formData, onFormDataChange],
  );

  const setOccasion = useCallback(
    (occasionId: string) => {
      onFormDataChange({ ...formData, occasion: occasionId });
    },
    [formData, onFormDataChange],
  );

  const setSpecialRequests = useCallback(
    (requests: string) => {
      onFormDataChange({ ...formData, specialRequests: requests });
    },
    [formData, onFormDataChange],
  );

  return (
    <View className="bg-card border border-border rounded-xl p-4 mb-4">
      {/* Header */}
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2">
          <User size={20} color="#3b82f6" />
          <Text className="font-semibold text-lg">Special Requirements</Text>
          <Text className="text-sm text-muted-foreground">(Optional)</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color="#3b82f6" />
        ) : (
          <ChevronDown size={20} color="#3b82f6" />
        )}
      </Pressable>

      {/* Summary when collapsed and has data */}
      {!isExpanded &&
        (formData.occasion ||
          formData.dietaryRestrictions.length > 0 ||
          formData.tablePreferences.length > 0 ||
          formData.specialRequests) && (
          <View className="mt-3 p-3 bg-muted/50 rounded-lg">
            <Text className="text-sm text-muted-foreground">
              {[
                formData.occasion && formData.occasion !== "none"
                  ? OCCASIONS.find((o) => o.id === formData.occasion)?.label
                  : null,
                formData.dietaryRestrictions.length > 0
                  ? `${formData.dietaryRestrictions.length} dietary restrictions`
                  : null,
                formData.tablePreferences.length > 0
                  ? `${formData.tablePreferences.length} table preferences`
                  : null,
                formData.specialRequests ? "Special requests added" : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </Text>
          </View>
        )}

      {isExpanded && (
        <View className="mt-4 space-y-6">
          {/* Occasion Selection */}
          <View>
            <Text className="font-medium text-foreground mb-3">Occasion</Text>
            <View className="flex-row flex-wrap gap-2">
              {OCCASIONS.map((occasion) => (
                <Pressable
                  key={occasion.id}
                  onPress={() => setOccasion(occasion.id)}
                  className={`px-3 py-2 rounded-full border ${
                    formData.occasion === occasion.id
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      formData.occasion === occasion.id
                        ? "text-white font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {occasion.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Dietary Restrictions */}
          <View>
            <Text className="font-medium text-foreground mb-3">
              Dietary Restrictions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DIETARY_RESTRICTIONS.map((restriction) => (
                <Pressable
                  key={restriction}
                  onPress={() => toggleDietaryRestriction(restriction)}
                  className={`px-3 py-2 rounded-full border ${
                    formData.dietaryRestrictions.includes(restriction)
                      ? "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      formData.dietaryRestrictions.includes(restriction)
                        ? "text-green-800 dark:text-green-300 font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {restriction}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Table Preferences */}
          <View>
            <Text className="font-medium text-foreground mb-3">
              Table Preferences
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TABLE_PREFERENCES.map((preference) => (
                <Pressable
                  key={preference}
                  onPress={() => toggleTablePreference(preference)}
                  className={`px-3 py-2 rounded-full border ${
                    formData.tablePreferences.includes(preference)
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      formData.tablePreferences.includes(preference)
                        ? "text-blue-800 dark:text-blue-300 font-medium"
                        : "text-foreground"
                    }`}
                  >
                    {preference}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Special Requests */}
          <View>
            <Text className="font-medium text-foreground mb-3">
              Special Requests
            </Text>
            <Textarea
              placeholder="Any special requests or notes for the restaurant..."
              value={formData.specialRequests || ""}
              onChangeText={setSpecialRequests}
              className="min-h-[80px]"
              maxLength={500}
              label=""
            />
            <Text className="text-xs text-muted-foreground mt-1">
              {(formData.specialRequests || "").length}/500 characters
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

SpecialRequirementsSection.displayName = "SpecialRequirementsSection";

// Form Data Interface
interface BookingFormData {
  specialRequests?: string;
  occasion?: string;
  dietaryRestrictions: string[];
  tablePreferences: string[];
  acceptTerms: boolean;
}

// Optimized Restaurant Info Card
const RestaurantInfoCard = React.memo<{
  restaurant: any;
}>(({ restaurant }) => (
  <View className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border shadow-sm">
    <View className="flex-row gap-3">
      <Image
        source={{
          uri: restaurant.main_image_url || restaurant.image_url || "",
        }}
        className="w-16 h-16 rounded-lg"
        contentFit="cover"
        placeholder="Restaurant"
      />
      <View className="flex-1">
        <Text className="font-semibold text-lg mb-1" numberOfLines={1}>
          {restaurant.name}
        </Text>
        <View className="flex-row items-center gap-2 mb-1">
          <Star size={14} color="#f59e0b" fill="#f59e0b" />
          <Text className="text-sm font-medium">
            {restaurant.average_rating?.toFixed(1) || "4.5"}
          </Text>
          <Text className="text-sm text-muted-foreground">•</Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {restaurant.cuisine_type}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <MapPin size={12} color="#666" />
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {restaurant.address}
          </Text>
        </View>
      </View>
    </View>
  </View>
));

RestaurantInfoCard.displayName = "RestaurantInfoCard";

// Enhanced Progress Indicator
const ProgressIndicator = React.memo<{
  currentStep: "time" | "experience";
  hasSelectedSlot: boolean;
  selectedTime: string | null;
  experienceCount: number;
}>(({ currentStep, hasSelectedSlot, selectedTime, experienceCount }) => (
  <View className="px-4 py-3 bg-muted/30 border-b border-border">
    <View className="flex-row items-center justify-center gap-4">
      <View
        className={`flex-row items-center gap-2 ${currentStep === "time" ? "opacity-100" : "opacity-60"}`}
      >
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${
            currentStep === "time"
              ? "bg-primary"
              : hasSelectedSlot
                ? "bg-green-500"
                : "bg-primary"
          }`}
        >
          <Text className="text-white font-bold text-sm">1</Text>
        </View>
        <View>
          <Text className="font-medium text-sm">Select Time</Text>
          {selectedTime && currentStep !== "time" && (
            <Text className="text-xs text-green-600 dark:text-green-400">
              {selectedTime}
            </Text>
          )}
        </View>
      </View>

      <View
        className={`w-8 h-px transition-colors ${hasSelectedSlot ? "bg-green-500" : "bg-border"}`}
      />

      <View
        className={`flex-row items-center gap-2 ${currentStep === "experience" ? "opacity-100" : "opacity-60"}`}
      >
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${
            currentStep === "experience" && hasSelectedSlot
              ? "bg-primary"
              : hasSelectedSlot
                ? "bg-green-500"
                : "bg-muted"
          }`}
        >
          <Text
            className={`font-bold text-sm ${hasSelectedSlot ? "text-white" : "text-muted-foreground"}`}
          >
            2
          </Text>
        </View>
        <View>
          <Text className="font-medium text-sm">Choose Experience</Text>
          {experienceCount > 0 && currentStep === "experience" && (
            <Text className="text-xs text-blue-600 dark:text-blue-400">
              {experienceCount} options
            </Text>
          )}
        </View>
      </View>
    </View>
  </View>
));

ProgressIndicator.displayName = "ProgressIndicator";

// Optimized Party Size Selector
const PartySizeSelector = React.memo<{
  partySize: number;
  onPartySizeChange: (size: number) => void;
  maxPartySize?: number;
  disabled?: boolean;
}>(({ partySize, onPartySizeChange, maxPartySize = 12, disabled = false }) => {
  const [expanded, setExpanded] = useState(false);

  const partySizes = useMemo(
    () => Array.from({ length: maxPartySize }, (_, i) => i + 1),
    [maxPartySize],
  );

  const handleSizeChange = useCallback(
    (size: number) => {
      onPartySizeChange(size);
      setExpanded(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onPartySizeChange],
  );

  if (expanded && !disabled) {
    return (
      <View className="bg-card border border-border rounded-xl p-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-semibold text-lg">Party Size</Text>
          <Pressable onPress={() => setExpanded(false)}>
            <ChevronUp size={24} color="#666" />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-3">
          {partySizes.map((size) => (
            <Pressable
              key={size}
              onPress={() => handleSizeChange(size)}
              className={`w-12 h-12 rounded-lg border-2 items-center justify-center ${
                partySize === size
                  ? "bg-primary border-primary"
                  : "bg-background border-border"
              }`}
            >
              <Text
                className={`font-semibold ${
                  partySize === size
                    ? "text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {size}
              </Text>
            </Pressable>
          ))}
        </View>

        {partySize > 8 && (
          <View className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <View className="flex-row items-start gap-2">
              <Info size={16} color="#f59e0b" />
              <Text className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
                Large parties may require special arrangements. The restaurant
                will confirm availability.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => !disabled && setExpanded(true)}
      disabled={disabled}
      className={`bg-card border border-border rounded-xl p-4 flex-row items-center justify-between ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <View className="flex-row items-center gap-3">
        <Users size={20} color="#3b82f6" />
        <View>
          <Text className="font-semibold">Party Size</Text>
          <Text className="text-sm text-muted-foreground">
            {partySize} {partySize === 1 ? "guest" : "guests"}
          </Text>
        </View>
      </View>
      {!disabled && <ChevronDown size={24} color="#666" />}
    </Pressable>
  );
});

PartySizeSelector.displayName = "PartySizeSelector";

// Enhanced Date Selector with calendar picker
const DateSelector = React.memo<{
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  maxDaysAhead?: number;
  disabled?: boolean;
}>(({ selectedDate, onDateChange, maxDaysAhead = 30, disabled = false }) => {
  const [showCalendar, setShowCalendar] = useState(false);

  const dates = useMemo(() => {
    const today = new Date();
    const datesArray = [];

    for (let i = 0; i < Math.min(14, maxDaysAhead); i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      datesArray.push(date);
    }

    return datesArray;
  }, [maxDaysAhead]);

  const calendarDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const minDate = today.toISOString().split("T")[0];

    const maxDateObj = new Date(today);
    maxDateObj.setDate(today.getDate() + maxDaysAhead - 1);
    const maxDate = maxDateObj.toISOString().split("T")[0];

    return { minDate, maxDate };
  }, [maxDaysAhead]);

  const handleDateChange = useCallback(
    (date: Date) => {
      if (disabled) return;
      onDateChange(date);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [onDateChange, disabled],
  );

  const handleCalendarDateSelect = useCallback(
    (day: any) => {
      const selectedDate = new Date(day.dateString + "T00:00:00");
      handleDateChange(selectedDate);
      setShowCalendar(false);
    },
    [handleDateChange],
  );

  const openCalendar = useCallback(() => {
    if (!disabled) {
      setShowCalendar(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [disabled]);

  return (
    <>
      <View
        className={`bg-card border border-border rounded-xl p-4 ${disabled ? "opacity-60" : ""}`}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-3">
            <Calendar size={20} color="#3b82f6" />
            <Text className="font-semibold text-lg">Select Date</Text>
          </View>
          <Pressable
            onPress={openCalendar}
            disabled={disabled}
            className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg"
          >
            <Calendar size={16} color="#3b82f6" />
            <Text className="text-primary font-medium text-sm">Calendar</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {dates.map((date) => {
              const isSelected =
                date.toDateString() === selectedDate.toDateString();
              const isToday = date.toDateString() === new Date().toDateString();
              const isTomorrow =
                date.toDateString() ===
                new Date(Date.now() + 86400000).toDateString();

              return (
                <Pressable
                  key={date.toISOString()}
                  onPress={() => handleDateChange(date)}
                  disabled={disabled}
                  className={`min-w-[80px] p-3 rounded-lg border-2 items-center ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium mb-1 ${
                      isSelected
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {date
                      .toLocaleDateString("en-US", { weekday: "short" })
                      .toUpperCase()}
                  </Text>
                  <Text
                    className={`text-lg font-bold mb-1 ${
                      isSelected ? "text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isSelected
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isToday
                      ? "Today"
                      : isTomorrow
                        ? "Tomorrow"
                        : date.toLocaleDateString("en-US", { month: "short" })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Calendar Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setShowCalendar(false)}
        >
          <Pressable
            className="bg-background rounded-2xl w-80 shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <View className="flex-row items-center gap-2">
                <Calendar size={20} color="#666" />
                <Text className="font-semibold text-lg">Select Date</Text>
              </View>
              <Pressable onPress={() => setShowCalendar(false)} className="p-1">
                <X size={20} color="#666" />
              </Pressable>
            </View>

            {/* Calendar */}
            <View className="p-4">
              <RNCalendar
                onDayPress={handleCalendarDateSelect}
                markedDates={{
                  [selectedDate.toISOString().split("T")[0]]: {
                    selected: true,
                    selectedColor: "#3b82f6",
                  },
                }}
                minDate={calendarDates.minDate}
                maxDate={calendarDates.maxDate}
                enableSwipeMonths={true}
                theme={{
                  backgroundColor: "transparent",
                  calendarBackground: "transparent",
                  textSectionTitleColor: "#666",
                  selectedDayBackgroundColor: "#3b82f6",
                  selectedDayTextColor: "#ffffff",
                  todayTextColor: "#3b82f6",
                  dayTextColor: "#333",
                  textDisabledColor: "#ccc",
                  arrowColor: "#3b82f6",
                  monthTextColor: "#333",
                  indicatorColor: "#3b82f6",
                  textDayFontWeight: "500",
                  textMonthFontWeight: "600",
                  textDayHeaderFontWeight: "500",
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

DateSelector.displayName = "DateSelector";

// Enhanced Offer Preview Components
const PreselectedOfferPreview = React.memo<{
  offerTitle: string;
  offerDiscount: number;
  redemptionCode: string;
  onRemove: () => void;
}>(({ offerTitle, offerDiscount, redemptionCode, onRemove }) => (
  <View className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
    <View className="flex-row items-center justify-between mb-2">
      <View className="flex-row items-center gap-2">
        <Sparkles size={20} color="#10b981" />
        <Text className="font-bold text-lg text-green-800 dark:text-green-200">
          Special Offer Applied!
        </Text>
      </View>
      <View className="bg-green-600 rounded-full px-3 py-1">
        <Text className="text-white font-bold text-sm">
          {offerDiscount}% OFF
        </Text>
      </View>
    </View>

    <View className="mb-3">
      <Text
        className="font-bold text-green-800 dark:text-green-200 mb-1"
        numberOfLines={2}
      >
        {offerTitle}
      </Text>
      <Text className="text-sm text-green-700 dark:text-green-300">
        This offer will be automatically applied to your booking
      </Text>
    </View>

    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
        <QrCode size={14} color="#10b981" />
        <Text className="text-green-800 dark:text-green-200 text-xs font-bold ml-1">
          Code: {redemptionCode.slice(-6).toUpperCase()}
        </Text>
      </View>

      <Pressable
        onPress={onRemove}
        className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1"
      >
        <Text className="text-green-800 dark:text-green-200 text-xs font-medium">
          Remove
        </Text>
      </Pressable>
    </View>
  </View>
));

PreselectedOfferPreview.displayName = "PreselectedOfferPreview";

// Main Component
export default function AvailabilitySelectionScreen() {
  // Add state to track if confirmation is in progress
  const [isConfirmingBooking, setIsConfirmingBooking] = useState(false);
  const { profile } = useAuth();
  const router = useRouter();

  // Get parameters with validation
  const params = useLocalSearchParams<{
    restaurantId: string;
    restaurantName?: string;
    preselectedOfferId?: string;
    offerTitle?: string;
    offerDiscount?: string;
    redemptionCode?: string;
  }>();

  // Validate required params
  useEffect(() => {
    if (!params.restaurantId) {
      Alert.alert("Error", "Restaurant information is missing");
      router.back();
    }
  }, [params.restaurantId, router]);

  // State management with optimized defaults
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [partySize, setPartySize] = useState(2);
  const [maxBookingDays, setMaxBookingDays] = useState(30);
  const [currentStep, setCurrentStep] = useState<"time" | "experience">("time");

  // Preselected offer state with memoization
  const [preselectedOffer, setPreselectedOffer] = useState<{
    id: string;
    title: string;
    discount: number;
    redemptionCode: string;
    discount_percentage?: number;
    valid_until?: string;
    restaurant_id?: string;
  } | null>(null);

  // Loyalty points state
  const [selectedLoyaltyPoints, setSelectedLoyaltyPoints] =
    useState<PotentialLoyaltyPoints | null>(null);

  // Friend invitation state
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [invitedFriendsDetails, setInvitedFriendsDetails] = useState<
    { id: string; full_name: string; avatar_url: string | null }[]
  >([]);
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);

  // Section selection state (only for basic tier restaurants)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );

  // Special requirements form state - removing unused state
  const [formData, setFormData] = useState<BookingFormData>(() => ({
    specialRequests: "",
    occasion: "none",
    dietaryRestrictions: [],
    tablePreferences: [],
    acceptTerms: false,
    ...getDefaultFormValues(profile),
  }));

  // Calculate total party size including invited friends
  const totalPartySize = useMemo(
    () => partySize + invitedFriends.length,
    [partySize, invitedFriends],
  );

  // Time Range Search state
  const [showTimeRangeSelector, setShowTimeRangeSelector] = useState(false);
  const { createSearchFunction } = useTimeRangeSearch();

  // Refs for cleanup and optimization
  const stepTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enhanced hooks with optimizations
  const { restaurant, loading: restaurantLoading } = useRestaurant(
    params.restaurantId || "",
  );
  const { preloadRestaurant } = useAvailabilityPreloader();
  const { hasLoyaltyProgram } = useRestaurantLoyalty(params.restaurantId || "");
  const { confirmBooking, loading: confirmingBooking } =
    useBookingConfirmation();

  // Enhanced availability hook with proper configuration
  const {
    timeSlots,
    timeSlotsLoading,
    selectedSlotOptions,
    selectedTime,
    slotOptionsLoading,
    error,
    fetchSlotOptions,
    clearSelectedSlot,
    hasTimeSlots,
    hasSelectedSlot,
    experienceCount,
    isLoading,
    refresh,
    // Restaurant tier information
    isBasicTier,
  } = useAvailability({
    restaurantId: params.restaurantId || "",
    date: selectedDate,
    partySize: totalPartySize,
    enableRealtime: true,
    mode: "time-first",
    preloadNext: true,
  });

  // Restaurant sections hook (only used for basic tier restaurants)
  const { sections: restaurantSections, loading: sectionsLoading } =
    useRestaurantSections(params.restaurantId);

  // Memoize booking date time to prevent infinite re-renders
  const bookingDateTime = useMemo(() => {
    if (!selectedTime) return null;
    try {
      const dt = new Date(selectedDate);
      const [h, m] = selectedTime.split(":");
      dt.setHours(parseInt(h), parseInt(m), 0, 0);
      return dt;
    } catch (error) {
      console.error("Error constructing booking date time:", error);
      return null;
    }
  }, [selectedDate, selectedTime]);

  // Preload restaurant data
  useEffect(() => {
    if (params.restaurantId) {
      preloadRestaurant(params.restaurantId, [2, 4, totalPartySize]);
    }
  }, [params.restaurantId, preloadRestaurant, totalPartySize]);

  // Initialize preselected offer with validation
  useEffect(() => {
    if (
      params.preselectedOfferId &&
      params.offerTitle &&
      params.offerDiscount &&
      params.redemptionCode
    ) {
      const discount = parseInt(params.offerDiscount, 10);
      if (!isNaN(discount) && discount > 0) {
        setPreselectedOffer({
          id: params.preselectedOfferId,
          title: params.offerTitle,
          discount,
          redemptionCode: params.redemptionCode,
        });
      }
    }
  }, [
    params.preselectedOfferId,
    params.offerTitle,
    params.offerDiscount,
    params.redemptionCode,
  ]);

  // Fetch max booking days with error handling
  useEffect(() => {
    async function fetchMaxDays() {
      if (profile?.id && restaurant?.id) {
        try {
          const days = await getMaxBookingWindow(
            profile.id,
            restaurant.id,
            (restaurant as any).booking_window_days || 30,
          );

          setMaxBookingDays(days);
        } catch (error) {
          console.error("Error fetching max booking days:", error);
          setMaxBookingDays(30); // fallback
        }
      }
    }
    fetchMaxDays();
  }, [profile?.id, restaurant?.id, restaurant]);

  const formatSelectedDate = useCallback((date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  // Reset loyalty points when date/time/party size changes
  useEffect(() => {
    setSelectedLoyaltyPoints(null);
  }, [selectedDate, selectedTime, totalPartySize]);

  // Optimized event handlers
  const handleDateChange = useCallback(
    (date: Date) => {
      if (date.toDateString() === selectedDate.toDateString()) return;

      setSelectedDate(date);
      setCurrentStep("time");
      clearSelectedSlot();
      setSelectedLoyaltyPoints(null); // Reset loyalty points
      setInvitedFriends([]); // Reset invited friends when date changes
      setInvitedFriendsDetails([]); // Reset invited friends details
      setSelectedSectionId(null); // Reset section selection

      // Clear any pending transitions
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    },
    [selectedDate, clearSelectedSlot, setInvitedFriends],
  );

  const handlePartySizeChange = useCallback(
    (size: number) => {
      if (size === partySize) return;

      setPartySize(size);
      setCurrentStep("time");
      clearSelectedSlot();
      setSelectedLoyaltyPoints(null); // Reset loyalty points
      setInvitedFriends([]); // Reset invited friends when party size changes
      setInvitedFriendsDetails([]); // Reset invited friends details
      setSelectedSectionId(null); // Reset section selection

      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    },
    [partySize, clearSelectedSlot, setInvitedFriends],
  );

  // Handle section selection
  const handleSectionSelect = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle basic tier booking confirmation
  const handleBasicTierBooking = useCallback(async () => {
    if (!restaurant || !selectedTime) {
      Alert.alert("Error", "Restaurant information or time missing");
      return;
    }

    // Construct booking date time from selected time
    let bookingTime: Date;
    try {
      const dt = new Date(selectedDate);
      const [h, m] = selectedTime.split(":");
      dt.setHours(parseInt(h), parseInt(m), 0, 0);
      bookingTime = dt;
    } catch (error) {
      console.error("Error constructing booking time:", error);
      Alert.alert("Error", "Invalid time selected");
      return;
    }

    setIsConfirmingBooking(true);
    try {
      // Prepare section preference for basic tier restaurants
      let preferredSection = null;

      if (isBasicTier && selectedSectionId && selectedSectionId !== "any") {
        const selectedSection = restaurantSections.find(
          (section) => section.id === selectedSectionId,
        );

        if (selectedSection) {
          preferredSection = selectedSection.name;
        }
      }
      // Note: If selectedSectionId is "any" or null, no section preference is set

      const success = await confirmBooking({
        restaurantId: params.restaurantId,
        bookingTime: bookingTime,
        partySize: partySize,
        specialRequests: formData.specialRequests,
        occasion: formData.occasion !== "none" ? formData.occasion : undefined,
        dietaryNotes:
          formData.dietaryRestrictions.length > 0
            ? formData.dietaryRestrictions
            : undefined,
        tablePreferences:
          formData.tablePreferences.length > 0
            ? formData.tablePreferences
            : undefined,
        bookingPolicy: (restaurant as any).booking_policy as
          | "instant"
          | "request",
        expectedLoyaltyPoints: selectedLoyaltyPoints?.available
          ? selectedLoyaltyPoints.pointsToAward
          : 0,
        appliedOfferId: preselectedOffer?.id,
        offerData: preselectedOffer
          ? {
              id: preselectedOffer.id,
              title: preselectedOffer.title,
              discount_percentage:
                preselectedOffer.discount_percentage ||
                preselectedOffer.discount,
              valid_until: preselectedOffer.valid_until,
              restaurant_id:
                preselectedOffer.restaurant_id || params.restaurantId,
            }
          : undefined,
        loyaltyRuleId: selectedLoyaltyPoints?.available
          ? selectedLoyaltyPoints.ruleId
          : undefined,
        // For basic tier, use empty tableIds array
        tableIds: JSON.stringify([]),
        requiresCombination: false,
        invitedFriends: invitedFriends,
        preferredSection: preferredSection || undefined, // Add the preferred section
      });

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh(true);
        clearSelectedSlot();
        setCurrentStep("time");
        setSelectedLoyaltyPoints(null);
      }
    } catch (error) {
      console.error("Error confirming basic tier booking:", error);
      Alert.alert("Error", "Failed to confirm booking. Please try again.");
    } finally {
      setTimeout(() => {
        setIsConfirmingBooking(false);
      }, 2000);
    }
  }, [
    restaurant,
    selectedTime,
    selectedDate,
    params.restaurantId,
    partySize,
    selectedLoyaltyPoints,
    preselectedOffer,
    confirmBooking,
    refresh,
    clearSelectedSlot,
    invitedFriends,
    selectedSectionId,
    restaurantSections,
    formData,
    isBasicTier,
  ]);

  const handleTimeSelect = useCallback(
    async (time: string) => {
      // Clear any existing timeout
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }

      try {
        // Fetch options for all tiers (needed for booking logic)
        await fetchSlotOptions(time);

        // For basic tier restaurants, just stay on time step - booking will happen via bottom CTA
        if (isBasicTier) {
          // Just provide haptic feedback for selection
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          // For pro tier restaurants, proceed to experience step
          stepTransitionRef.current = setTimeout(() => {
            setCurrentStep("experience");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 200);
        }
      } catch (error) {
        console.error("Error fetching slot options:", error);
        Alert.alert(
          "Error",
          "Failed to load seating options. Please try again.",
        );
      }
    },
    [fetchSlotOptions, isBasicTier],
  );

  const handleBackToTimeSelection = useCallback(() => {
    setCurrentStep("time");
    clearSelectedSlot();
    setSelectedLoyaltyPoints(null); // Reset loyalty points
    setIsConfirmingBooking(false); // Reset confirming state
    // Don't reset invited friends when going back to time selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearSelectedSlot]);

  const handleExperienceConfirm = useCallback(
    async (tableIds: string[], selectedOption: TableOption) => {
      // Prevent double submissions
      if (isConfirmingBooking) {
        return;
      }

      if (!selectedSlotOptions || !restaurant || !bookingDateTime) {
        Alert.alert("Error", "Missing booking information");
        return;
      }

      // Set confirming state
      setIsConfirmingBooking(true);

      try {
        const success = await confirmBooking({
          restaurantId: params.restaurantId,
          bookingTime: bookingDateTime,
          partySize: totalPartySize,
          specialRequests: formData.specialRequests,
          occasion:
            formData.occasion !== "none" ? formData.occasion : undefined,
          dietaryNotes:
            formData.dietaryRestrictions.length > 0
              ? formData.dietaryRestrictions
              : undefined,
          tablePreferences:
            formData.tablePreferences.length > 0
              ? formData.tablePreferences
              : undefined,
          bookingPolicy: (restaurant as any).booking_policy as
            | "instant"
            | "request",
          expectedLoyaltyPoints: selectedLoyaltyPoints?.available
            ? selectedLoyaltyPoints.pointsToAward
            : 0,
          appliedOfferId: preselectedOffer?.id,
          offerData: preselectedOffer
            ? {
                id: preselectedOffer.id,
                title: preselectedOffer.title,
                discount_percentage:
                  preselectedOffer.discount_percentage ||
                  preselectedOffer.discount,
                valid_until: preselectedOffer.valid_until,
                restaurant_id:
                  preselectedOffer.restaurant_id || params.restaurantId,
              }
            : undefined,
          loyaltyRuleId: selectedLoyaltyPoints?.available
            ? selectedLoyaltyPoints.ruleId
            : undefined,
          tableIds: JSON.stringify(tableIds),
          requiresCombination: selectedOption.requiresCombination,
          invitedFriends: invitedFriends,
        });

        if (success) {
          // Success feedback
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          await refresh(true); // Force refresh with cache clearing

          // Clear selected slot to reset the UI state
          clearSelectedSlot();
          setCurrentStep("time");
          setSelectedLoyaltyPoints(null);
        }
      } catch (error) {
        console.error("Error confirming booking:", error);
        Alert.alert("Error", "Failed to confirm booking. Please try again.");
      } finally {
        // Reset confirming state after a delay to prevent rapid retries
        setTimeout(() => {
          setIsConfirmingBooking(false);
        }, 2000);
      }
    },
    [
      selectedSlotOptions,
      restaurant,
      bookingDateTime,
      params.restaurantId,
      totalPartySize,
      selectedLoyaltyPoints,
      preselectedOffer,
      confirmBooking,
      refresh,
      clearSelectedSlot,
      isConfirmingBooking,
      invitedFriends,
      formData,
    ],
  );

  // Handle inline offer selection
  const handleOfferSelect = useCallback(
    (
      offer: {
        id: string;
        title: string;
        discount: number;
        redemptionCode: string;
      } | null,
    ) => {
      if (offer) {
        setPreselectedOffer(offer);
      } else {
        setPreselectedOffer(null);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const handleRemovePreselectedOffer = useCallback(() => {
    Alert.alert(
      "Remove Offer",
      "Are you sure you want to remove this offer from your booking?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setPreselectedOffer(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ],
    );
  }, []);

  // Time Range Search handlers
  const handleOpenTimeRangeSearch = useCallback(() => {
    setShowTimeRangeSelector(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCloseTimeRangeSearch = useCallback(() => {
    setShowTimeRangeSelector(false);
  }, []);

  const handleTimeRangeSearchResult = useCallback(
    async (result: TimeRangeResult) => {
      try {
        // Set the selected time to match the search result
        await fetchSlotOptions(result.timeSlot);

        // Smooth transition to experience step
        stepTransitionRef.current = setTimeout(() => {
          setCurrentStep("experience");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 200);
      } catch (error) {
        console.error("Error handling time range result:", error);
        Alert.alert(
          "Error",
          "Failed to load the selected time slot. Please try again.",
        );
      }
    },
    [fetchSlotOptions],
  );

  // Handle friend invitations
  const handleInvitesSent = useCallback(
    (
      friendIds: string[],
      friendDetails: {
        id: string;
        full_name: string;
        avatar_url: string | null;
      }[],
    ) => {
      setInvitedFriends(friendIds);
      setInvitedFriendsDetails(friendDetails);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  // Handle removing a specific friend
  const handleRemoveFriend = useCallback((friendId: string) => {
    setInvitedFriends((prev) => prev.filter((id) => id !== friendId));
    setInvitedFriendsDetails((prev) =>
      prev.filter((friend) => friend.id !== friendId),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle clearing all invitations
  const handleClearAllInvitations = useCallback(() => {
    Alert.alert(
      "Clear All Invitations",
      "Are you sure you want to remove all invited friends?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setInvitedFriends([]);
            setInvitedFriendsDetails([]);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    );
  }, []);

  // Special requirements form helpers
  const handleFormDataChange = useCallback(
    (field: keyof BookingFormData, value: any) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const toggleDietaryRestriction = useCallback(
    (restriction: string) => {
      const current = formData.dietaryRestrictions;
      if (current.includes(restriction)) {
        handleFormDataChange(
          "dietaryRestrictions",
          current.filter((r) => r !== restriction),
        );
      } else {
        handleFormDataChange("dietaryRestrictions", [...current, restriction]);
      }
    },
    [formData.dietaryRestrictions, handleFormDataChange],
  );

  const toggleTablePreference = useCallback(
    (preference: string) => {
      const current = formData.tablePreferences;
      if (current.includes(preference)) {
        handleFormDataChange(
          "tablePreferences",
          current.filter((p) => p !== preference),
        );
      } else {
        handleFormDataChange("tablePreferences", [...current, preference]);
      }
    },
    [formData.tablePreferences, handleFormDataChange],
  );

  const handleSetOccasion = useCallback(
    (occasionId: string) => {
      handleFormDataChange("occasion", occasionId);
    },
    [handleFormDataChange],
  );

  const handleToggleSpecialRequirements = useCallback(() => {
    // This function is defined but unused - kept for future use
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle form completion from TimeSlots component
  const handleSpecialRequirementsComplete = useCallback(
    (newFormData: SpecialRequirementsFormData) => {
      setFormData((prev) => ({
        ...prev,
        specialRequests: newFormData.specialRequests,
        occasion: newFormData.occasion || "none",
        dietaryRestrictions: newFormData.dietaryRestrictions,
        tablePreferences: newFormData.tablePreferences,
      }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTransitionRef.current) {
        clearTimeout(stepTransitionRef.current);
      }
    };
  }, []);

  // Loading state with better UX
  if (!restaurant || restaurantLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 text-muted-foreground text-center">
            Loading restaurant information...
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Preparing your dining experience
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRequestBooking = (restaurant as any)?.booking_policy === "request";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Enhanced Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border bg-background">
        <Pressable
          onPress={() => router.back()}
          className="p-2 -ml-2 rounded-full"
          hitSlop={8}
        >
          <ChevronLeft size={24} />
        </Pressable>
        <View className="flex-1 mx-4">
          <Text className="text-center font-semibold">
            {currentStep === "time"
              ? "Select Date & Time"
              : "Choose Your Experience"}
          </Text>
          <Text
            className="text-center text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {restaurant.name}
          </Text>
        </View>
        <View className="w-10" />
      </View>

      {/* Progress Indicator */}
      <ProgressIndicator
        currentStep={currentStep}
        hasSelectedSlot={hasSelectedSlot}
        selectedTime={selectedTime}
        experienceCount={experienceCount}
      />

      {/* Restaurant Info Card */}
      <RestaurantInfoCard restaurant={restaurant as any} />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-4 gap-4">
          {/* Preselected Offer Preview */}
          {preselectedOffer && (
            <PreselectedOfferPreview
              offerTitle={preselectedOffer.title}
              offerDiscount={preselectedOffer.discount}
              redemptionCode={preselectedOffer.redemptionCode}
              onRemove={handleRemovePreselectedOffer}
            />
          )}

          {/* Configuration Selectors - Disabled in experience step */}
          <PartySizeSelector
            partySize={partySize}
            onPartySizeChange={handlePartySizeChange}
            maxPartySize={12} // Default max party size
            disabled={currentStep === "experience" || isConfirmingBooking}
          />

          <DateSelector
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            maxDaysAhead={maxBookingDays}
            disabled={currentStep === "experience" || isConfirmingBooking}
          />

          {/* Section Selector - Only show for basic tier restaurants */}
          {isBasicTier && (
            <SectionSelector
              sections={restaurantSections}
              selectedSectionId={selectedSectionId}
              onSectionSelect={handleSectionSelect}
              loading={sectionsLoading}
              disabled={currentStep === "experience" || isConfirmingBooking}
            />
          )}

          {/* Step 1: Time Selection */}
          {currentStep === "time" && (
            <>
              {/* Friends Invitation Section - Modal approach */}
              <View className="bg-card border border-border rounded-xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-3 flex-1">
                    <Users size={20} color="#3b82f6" />
                    <View className="flex-1">
                      <Text className="font-semibold text-lg">
                        Invite Friends
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        Make it a group experience! (Optional)
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={() => setShowInviteFriendsModal(true)}
                  className="p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex-row items-center justify-center"
                >
                  <UserPlus size={24} color="#6b7280" />
                  <Text className="ml-2 font-medium text-muted-foreground">
                    {invitedFriends.length > 0
                      ? "Manage Invitations"
                      : "Invite Friends"}
                  </Text>
                </Pressable>

                {/* Invited Friends Showcase */}
                {invitedFriendsDetails.length > 0 && (
                  <View className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="font-semibold text-green-800 dark:text-green-200">
                        {invitedFriendsDetails.length} Friend
                        {invitedFriendsDetails.length > 1 ? "s" : ""} Invited
                      </Text>
                      <View className="bg-green-200 dark:bg-green-800 rounded-full px-3 py-1">
                        <Text className="text-green-800 dark:text-green-200 text-xs font-bold">
                          Party of {totalPartySize}
                        </Text>
                      </View>
                    </View>

                    {/* Friends List */}
                    <View className="flex-row flex-wrap gap-2 mb-3">
                      {invitedFriendsDetails.map((friend) => (
                        <Pressable
                          key={friend.id}
                          onPress={() => handleRemoveFriend(friend.id)}
                          className="flex-row items-center bg-green-100 dark:bg-green-800/50 rounded-full pl-1 pr-2 py-1 border border-green-200 dark:border-green-700"
                        >
                          <Image
                            source={{
                              uri:
                                friend.avatar_url ||
                                `https://ui-avatars.com/api/?name=${friend.full_name}`,
                            }}
                            className="w-6 h-6 rounded-full bg-gray-100 mr-2"
                          />
                          <Text className="text-green-800 dark:text-green-200 text-sm font-medium mr-1">
                            {friend.full_name.split(" ")[0]}
                          </Text>
                          <View className="w-4 h-4 bg-green-200 dark:bg-green-700 rounded-full items-center justify-center">
                            <X size={10} color="#059669" />
                          </View>
                        </Pressable>
                      ))}
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-green-700 dark:text-green-300 flex-1">
                        Your friends will receive booking invitations once
                        confirmed
                      </Text>
                      <Pressable
                        onPress={handleClearAllInvitations}
                        className="ml-3 px-3 py-1 bg-green-200 dark:bg-green-800 rounded-full"
                      >
                        <Text className="text-green-800 dark:text-green-200 text-xs font-medium">
                          Clear All
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              <TimeSlots
                slots={timeSlots}
                selectedTime={selectedTime}
                onTimeSelect={handleTimeSelect}
                loading={timeSlotsLoading}
                showLiveIndicator={true}
                error={error}
                onFormComplete={handleSpecialRequirementsComplete}
                showRequirementsForm={true}
              />

              {/* Time Range Search Button - Only show for pro plan restaurants */}
              {!isBasicTier && (
                <View className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3 flex-1">
                      <Search size={20} color="#3b82f6" />
                      <View className="flex-1">
                        <Text className="font-semibold text-lg text-blue-800 dark:text-blue-200">
                          Advanced Time Search
                        </Text>
                        <Text className="text-sm text-blue-700 dark:text-blue-300">
                          Search within a time range and filter by table types
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Button
                    onPress={handleOpenTimeRangeSearch}
                    disabled={timeSlotsLoading}
                    variant="outline"
                    className="flex-row items-center justify-center gap-2 border-blue-300 dark:border-blue-700"
                  >
                    <Clock size={16} color="#3b82f6" />
                    <Text className="text-blue-700 dark:text-blue-300 font-medium">
                      Search Time Range
                    </Text>
                  </Button>
                </View>
              )}

              {/* Loyalty Points Display for Time Step - only when time is selected */}
              {bookingDateTime && !isRequestBooking && hasLoyaltyProgram && (
                <LoyaltyPointsDisplay
                  restaurantId={params.restaurantId}
                  bookingTime={bookingDateTime}
                  partySize={totalPartySize}
                  onPointsCalculated={setSelectedLoyaltyPoints}
                />
              )}
            </>
          )}

          {/* Step 2: Experience Selection */}
          {currentStep === "experience" && (
            <>
              {/* Back navigation - disable while confirming */}
              <Pressable
                onPress={
                  isConfirmingBooking ? undefined : handleBackToTimeSelection
                }
                disabled={isConfirmingBooking}
                className={`flex-row items-center gap-2 p-2 -ml-2 self-start rounded-lg ${
                  isConfirmingBooking ? "opacity-50" : ""
                }`}
              >
                <ArrowLeft
                  size={20}
                  color={isConfirmingBooking ? "#999" : "#3b82f6"}
                />
                <Text
                  className={`font-medium ${
                    isConfirmingBooking
                      ? "text-muted-foreground"
                      : "text-primary"
                  }`}
                >
                  {isConfirmingBooking
                    ? "Processing..."
                    : "Back to Time Selection"}
                </Text>
              </Pressable>

              {/* Loyalty Points Display for Experience Step */}
              {bookingDateTime && !isRequestBooking && hasLoyaltyProgram && (
                <LoyaltyPointsDisplay
                  restaurantId={params.restaurantId}
                  bookingTime={bookingDateTime}
                  partySize={totalPartySize}
                  onPointsCalculated={setSelectedLoyaltyPoints}
                />
              )}

              {/* Special Requirements Form - Also show in experience step */}
              <SpecialRequirementsSection
                formData={formData}
                onFormDataChange={setFormData}
                showFormByDefault={false}
              />

              {/* Pass isConfirming prop to TableOptions */}
              <TableOptions
                slotOptions={selectedSlotOptions}
                onConfirm={handleExperienceConfirm}
                onBack={handleBackToTimeSelection}
                loading={slotOptionsLoading}
                isConfirming={isConfirmingBooking}
              />
            </>
          )}

          {/* Additional Content - Only show on time step */}
          {currentStep === "time" && (
            <>
              {/* Inline Offer Selector */}
              <InlineOfferSelector
                restaurantId={params.restaurantId || ""}
                onOfferSelect={handleOfferSelect}
                selectedOfferId={preselectedOffer?.id || null}
                disabled={currentStep === "experience" || isConfirmingBooking}
              />

              {/* Booking Policies */}
              <View className="bg-muted/30 rounded-xl p-4">
                <Text className="font-semibold mb-2">Booking Information</Text>
                <View className="gap-2">
                  {isRequestBooking ? (
                    <>
                      <View className="flex-row items-start gap-2">
                        <Timer size={16} color="#f97316" className="mt-0.5" />
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-orange-800 dark:text-orange-200">
                            Request booking restaurant
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            Submit your request and receive confirmation within
                            2 hours
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm text-muted-foreground">
                        • The restaurant will review availability
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        • You&apos;ll be notified once confirmed
                      </Text>
                      {(restaurant as any).cancellation_window_hours && (
                        <Text className="text-sm text-muted-foreground">
                          • Free cancellation up to{" "}
                          {(restaurant as any).cancellation_window_hours} hours
                          before
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text className="text-sm text-muted-foreground">
                        • Instant confirmation
                      </Text>
                      {(restaurant as any).cancellation_window_hours && (
                        <Text className="text-sm text-muted-foreground">
                          • Free cancellation up to{" "}
                          {(restaurant as any).cancellation_window_hours} hours
                          before
                        </Text>
                      )}
                      <Text className="text-sm text-muted-foreground">
                        • Please arrive on time to keep your reservation
                      </Text>
                    </>
                  )}
                  {preselectedOffer && (
                    <Text className="text-sm text-green-600 dark:text-green-400">
                      • Your {preselectedOffer.discount}% discount will be
                      applied
                    </Text>
                  )}
                  {selectedLoyaltyPoints?.available && (
                    <Text className="text-sm text-amber-600 dark:text-amber-400">
                      • Earn {selectedLoyaltyPoints.pointsToAward} loyalty
                      points
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Enhanced Bottom CTA */}
      <View className="p-4 border-t border-border bg-background">
        {isRequestBooking && (
          <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 mb-3">
            <View className="flex-row items-center gap-2">
              <Timer size={14} color="#f97316" />
              <Text className="text-xs text-orange-700 dark:text-orange-300 flex-1">
                This restaurant requires booking approval
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-1">
            <Text className="font-semibold">
              {formatSelectedDate(selectedDate)}
              {selectedTime && ` at ${selectedTime}`}
            </Text>
            <View className="flex-row items-center gap-2 flex-wrap">
              <Text className="text-sm text-muted-foreground">
                Party of {totalPartySize}
                {invitedFriends.length > 0 &&
                  ` (${partySize} + ${invitedFriends.length} friends)`}
                {!isRequestBooking &&
                  selectedLoyaltyPoints?.available &&
                  ` • Earn ${selectedLoyaltyPoints.pointsToAward} points`}
              </Text>
              {preselectedOffer && (
                <>
                  <Text className="text-sm text-muted-foreground">•</Text>
                  <Text className="text-sm font-medium text-green-600 dark:text-green-400">
                    {preselectedOffer.discount}% OFF applied
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Dynamic CTA based on step */}
          {currentStep === "time" ? (
            // Show different CTAs based on restaurant tier and time selection
            isBasicTier && selectedTime ? (
              // Basic tier with time selected - show Book Now button
              <Button
                onPress={handleBasicTierBooking}
                disabled={isConfirmingBooking || confirmingBooking}
                className="bg-primary min-w-[120px]"
              >
                {isConfirmingBooking || confirmingBooking ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-primary-foreground font-medium">
                      Booking...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-primary-foreground font-medium">
                    Book Now
                  </Text>
                )}
              </Button>
            ) : (
              // Default time step CTA (pro tier or no time selected)
              <View className="items-end ml-4">
                <Text className="text-xs text-muted-foreground mb-1 text-right">
                  {isLoading
                    ? "Loading times..."
                    : hasTimeSlots
                      ? isBasicTier
                        ? "Select time above"
                        : "Select time above"
                      : "No times available"}
                </Text>
                <View className="w-20 h-10 bg-muted/50 rounded-lg items-center justify-center">
                  {isLoading && <ActivityIndicator size="small" />}
                  {!isLoading && !hasTimeSlots && (
                    <Pressable onPress={() => refresh(true)}>
                      <Text className="text-xs text-primary">Retry</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )
          ) : (
            <View className="items-end ml-4">
              <Text className="text-xs text-muted-foreground mb-1 text-right">
                {isConfirmingBooking
                  ? "Creating booking..."
                  : confirmingBooking
                    ? "Processing..."
                    : "Select experience above"}
              </Text>
              {(isConfirmingBooking || confirmingBooking) && (
                <View className="w-20 h-10 bg-muted/50 rounded-lg items-center justify-center">
                  <ActivityIndicator size="small" />
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Time Range Selector Modal */}
      <TimeRangeSelector
        visible={showTimeRangeSelector}
        onClose={handleCloseTimeRangeSearch}
        onSearch={createSearchFunction(params.restaurantId || "")}
        onSelectResult={handleTimeRangeSearchResult}
        initialPartySize={partySize}
        selectedDate={selectedDate}
        restaurantName={restaurant?.name || "Restaurant"}
        restaurantId={params.restaurantId || ""}
      />

      {/* Invite Friends Modal */}
      <InviteFriendsModal
        visible={showInviteFriendsModal}
        onClose={() => setShowInviteFriendsModal(false)}
        onInvite={handleInvitesSent}
        restaurantName={restaurant?.name}
        bookingTime={
          selectedTime
            ? `${formatSelectedDate(selectedDate)} at ${selectedTime}`
            : `${formatSelectedDate(selectedDate)}`
        }
        currentlyInvited={invitedFriends}
      />
    </SafeAreaView>
  );
}
