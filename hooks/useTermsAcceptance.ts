import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

const CURRENT_TERMS_VERSION = "1.0";

export interface TermsAcceptance {
  id: string;
  user_id: string;
  terms_version: string;
  accepted_at: string;
  ip_address?: string;
  user_agent?: string;
}

export const useTermsAcceptance = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasAcceptedCurrentTerms, setHasAcceptedCurrentTerms] = useState(false);
  const [checkingTerms, setCheckingTerms] = useState(true);

  const checkTermsAcceptance = useCallback(async (): Promise<{
    success: boolean;
    hasAccepted?: boolean;
    error?: string;
  }> => {
    if (!profile?.id) {
      return { success: false, error: "User not logged in" };
    }

    setCheckingTerms(true);
    try {
      const { data, error } = await supabase
        .from("terms_acceptance")
        .select("*")
        .eq("user_id", profile.id)
        .eq("terms_version", CURRENT_TERMS_VERSION)
        .maybeSingle();

      if (error) throw error;

      const hasAccepted = !!data;
      setHasAcceptedCurrentTerms(hasAccepted);

      return { success: true, hasAccepted };
    } catch (error: any) {
      console.error("Error checking terms acceptance:", error);
      return {
        success: false,
        error: error.message || "Failed to check terms acceptance",
      };
    } finally {
      setCheckingTerms(false);
    }
  }, [profile?.id]);

  const acceptTerms = useCallback(
    async (
      version: string = CURRENT_TERMS_VERSION,
      ipAddress?: string,
      userAgent?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!profile?.id) {
        return { success: false, error: "User not logged in" };
      }

      setLoading(true);
      try {
        const { error } = await supabase.from("terms_acceptance").insert({
          user_id: profile.id,
          terms_version: version,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

        if (error) {
          // If the error is due to unique constraint violation, it means terms were already accepted
          if (error.code === "23505") {
            setHasAcceptedCurrentTerms(true);
            return { success: true };
          }
          throw error;
        }

        setHasAcceptedCurrentTerms(true);
        return { success: true };
      } catch (error: any) {
        console.error("Error accepting terms:", error);
        return {
          success: false,
          error: error.message || "Failed to accept terms",
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  const getTermsAcceptanceHistory = useCallback(async (): Promise<{
    success: boolean;
    data?: TermsAcceptance[];
    error?: string;
  }> => {
    if (!profile?.id) {
      return { success: false, error: "User not logged in" };
    }

    try {
      const { data, error } = await supabase
        .from("terms_acceptance")
        .select("*")
        .eq("user_id", profile.id)
        .order("accepted_at", { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error("Error fetching terms acceptance history:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch terms history",
      };
    }
  }, [profile?.id]);

  // Auto-check terms acceptance when user is available
  useEffect(() => {
    if (profile?.id) {
      checkTermsAcceptance();
    }
  }, [profile?.id, checkTermsAcceptance]);

  return {
    loading,
    checkingTerms,
    hasAcceptedCurrentTerms,
    currentTermsVersion: CURRENT_TERMS_VERSION,
    checkTermsAcceptance,
    acceptTerms,
    getTermsAcceptanceHistory,
  };
};

export default useTermsAcceptance;
