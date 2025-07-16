import { useState, useCallback } from "react";
import { useAuth } from "@/context/supabase-provider";

export function useGuestGuard() {
  const { isGuest } = useAuth();
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const checkGuestAccess = useCallback((callback?: () => void) => {
    if (isGuest) {
      setShowGuestPrompt(true);
      return false;
    }
    
    if (callback) {
      callback();
    }
    return true;
  }, [isGuest]);

  const closeGuestPrompt = useCallback(() => {
    setShowGuestPrompt(false);
  }, []);

  return {
    isGuest,
    showGuestPrompt,
    checkGuestAccess,
    closeGuestPrompt,
  };
}