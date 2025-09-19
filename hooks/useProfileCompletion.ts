import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/supabase-provider";

export type MissingField =
  | "first_name"
  | "last_name"
  | "phone_number"
  | "date_of_birth";

interface ProfileCompletionState {
  shouldPrompt: boolean;
  showPrompt: () => void;
  hidePrompt: () => void;
  isVisible: boolean;
  missingFields: MissingField[];
  isProfileComplete: boolean;
  currentField?: MissingField;
  getBestAvailableName: () => string;
  getAppleName: () => string | null;
  splitName: (fullName: string) => { first_name: string; last_name: string };
}

export function useProfileCompletion(): ProfileCompletionState {
  const { profile, isGuest, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  const splitName = useCallback((fullName: string) => {
    const nameParts = (fullName || "").trim().split(/\s+/);
    return {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
    };
  }, []);

  const getAppleName = useCallback(() => {
    // Try to get the name from Apple login metadata
    if (user?.user_metadata) {
      return user.user_metadata.full_name || user.user_metadata.name || null;
    }
    return null;
  }, [user]);

  const getBestAvailableName = useCallback(() => {
    // First try Apple login name
    const appleName = getAppleName();
    if (appleName && appleName !== "User") {
      return appleName;
    }

    // Fall back to profile full_name if it's not just "User"
    if (profile?.full_name && profile.full_name !== "User") {
      return profile.full_name;
    }

    // If we have Apple name, use it even if it's "User"
    if (appleName) {
      return appleName;
    }

    // Final fallback
    return profile?.full_name || "";
  }, [profile?.full_name, getAppleName]);

  const missingFields = useCallback((): MissingField[] => {
    if (!profile) return [];

    const missing: MissingField[] = [];
    const bestName = getBestAvailableName();
    const { first_name, last_name } = splitName(bestName);

    // Check if first name is missing or is the generic "User" fallback
    if (!first_name.trim() || first_name.trim() === "User") {
      missing.push("first_name");
    }

    // Check if last name is missing
    if (!last_name.trim()) {
      missing.push("last_name");
    }

    // Check if phone number is missing
    if (!profile.phone_number?.trim()) {
      missing.push("phone_number");
    }

    // Check if date of birth is missing
    if (!profile.date_of_birth) {
      missing.push("date_of_birth");
    }

    return missing;
  }, [profile, splitName, getBestAvailableName]);

  const currentMissingFields = missingFields();
  const isProfileComplete = currentMissingFields.length === 0;
  const shouldPrompt = !isGuest && !isProfileComplete;
  const currentField = currentMissingFields[currentFieldIndex];

  const showPrompt = useCallback(() => {
    if (shouldPrompt && currentMissingFields.length > 0) {
      setIsVisible(true);
      setCurrentFieldIndex(0);
    }
  }, [shouldPrompt, currentMissingFields.length]);

  const hidePrompt = useCallback(() => {
    setIsVisible(false);
  }, []);

  const moveToNextField = useCallback(() => {
    if (currentFieldIndex < currentMissingFields.length - 1) {
      setCurrentFieldIndex((prev) => prev + 1);
    } else {
      // All fields completed, hide the prompt
      setIsVisible(false);
    }
  }, [currentFieldIndex, currentMissingFields.length]);

  // Auto-hide the prompt when profile is complete
  useEffect(() => {
    if (isProfileComplete && isVisible) {
      console.log("📋 Profile completed, auto-hiding prompt");
      setIsVisible(false);
    }
  }, [isProfileComplete, isVisible]);

  // Reset field index when missing fields change
  useEffect(() => {
    if (
      currentFieldIndex >= currentMissingFields.length &&
      currentMissingFields.length > 0
    ) {
      setCurrentFieldIndex(0);
    }
  }, [currentMissingFields.length, currentFieldIndex]);

  return {
    shouldPrompt,
    showPrompt,
    hidePrompt,
    isVisible,
    missingFields: currentMissingFields,
    isProfileComplete,
    currentField,
    moveToNextField,
    getBestAvailableName,
    getAppleName,
    splitName,
  };
}

// Hook for triggering profile completion prompt when needed for bookings
export function useBookingProfileCompletion() {
  const profileCompletion = useProfileCompletion();
  const { profile } = useAuth();

  const promptForBooking = useCallback(
    (onComplete?: () => void) => {
      if (!profileCompletion.isProfileComplete) {
        profileCompletion.showPrompt();
        return false; // Booking should not proceed
      }
      onComplete?.();
      return true; // Booking can proceed
    },
    [profileCompletion],
  );

  return {
    ...profileCompletion,
    promptForBooking,
  };
}
