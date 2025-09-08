import { useState } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type ReviewReport = Database["public"]["Tables"]["review_reports"]["Row"];
type ReviewReportInsert =
  Database["public"]["Tables"]["review_reports"]["Insert"];

export type ReportReason =
  | "inappropriate_content"
  | "spam"
  | "fake_review"
  | "hate_speech"
  | "harassment"
  | "misinformation"
  | "privacy_violation"
  | "copyright_violation"
  | "off_topic"
  | "duplicate_review"
  | "other";

export const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  description: string;
}[] = [
  {
    value: "inappropriate_content",
    label: "Inappropriate Content",
    description: "Contains offensive, sexual, or inappropriate material",
  },
  {
    value: "spam",
    label: "Spam",
    description: "Irrelevant, promotional, or repetitive content",
  },
  {
    value: "fake_review",
    label: "Fake Review",
    description: "Appears to be fake, misleading, or not a genuine experience",
  },
  {
    value: "hate_speech",
    label: "Hate Speech",
    description: "Contains discriminatory, hateful, or threatening language",
  },
  {
    value: "harassment",
    label: "Harassment",
    description: "Targets or harasses individuals or groups",
  },
  {
    value: "misinformation",
    label: "Misinformation",
    description:
      "Contains false or misleading information about the restaurant",
  },
  {
    value: "privacy_violation",
    label: "Privacy Violation",
    description: "Shares personal information without consent",
  },
  {
    value: "copyright_violation",
    label: "Copyright Violation",
    description: "Contains copyrighted content used without permission",
  },
  {
    value: "off_topic",
    label: "Off Topic",
    description: "Not related to the restaurant or dining experience",
  },
  {
    value: "duplicate_review",
    label: "Duplicate Review",
    description: "Multiple reviews from the same user for the same visit",
  },
  {
    value: "other",
    label: "Other",
    description: "Other violation not covered by the above categories",
  },
];

export function useReviewReports() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportedReviews, setReportedReviews] = useState<Set<string>>(
    new Set(),
  );

  const { profile } = useAuth();
  const currentUserId = profile?.id ?? null;

  /**
   * Submit a report for a review
   */
  const submitReport = async (params: {
    reviewId: string;
    reason: ReportReason;
    description?: string;
  }): Promise<boolean> => {
    if (!currentUserId) {
      Alert.alert("Error", "You must be signed in to report a review");
      return false;
    }

    try {
      setIsSubmitting(true);

      const reportData: ReviewReportInsert = {
        review_id: params.reviewId,
        reporter_user_id: currentUserId,
        reason: params.reason,
        description: params.description || null,
        status: "pending",
      };

      const { error } = await supabase
        .from("review_reports")
        .insert([reportData])
        .select()
        .single();

      if (error) {
        console.error("Error submitting report:", error);

        // Handle duplicate report error
        if (error.code === "23505") {
          Alert.alert(
            "Already Reported",
            "You have already reported this review. We'll review it shortly.",
          );
          return true;
        }

        throw error;
      }

      // Add to reported reviews set
      setReportedReviews((prev) => new Set([...prev, params.reviewId]));

      Alert.alert(
        "Report Submitted",
        "Thank you for reporting this review. Our team will review it shortly.",
      );

      return true;
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Check if current user has already reported a specific review
   */
  const checkIfReported = async (reviewId: string): Promise<boolean> => {
    if (!currentUserId) return false;

    try {
      const { data, error } = await supabase
        .from("review_reports")
        .select("id")
        .eq("review_id", reviewId)
        .eq("reporter_user_id", currentUserId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error checking report status:", error);
        return false;
      }

      const isReported = !!data;

      // Update local state
      if (isReported) {
        setReportedReviews((prev) => new Set([...prev, reviewId]));
      }

      return isReported;
    } catch (error) {
      console.error("Error checking report status:", error);
      return false;
    }
  };

  /**
   * Get user's reports (for profile/history)
   */
  const getUserReports = async (): Promise<ReviewReport[]> => {
    if (!currentUserId) return [];

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("review_reports")
        .select("*")
        .eq("reporter_user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user reports:", error);
        throw error;
      }

      setReports(data);
      return data;
    } catch (error) {
      console.error("Error fetching user reports:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if current user has already reported a specific review (local check)
   */
  const isAlreadyReported = (reviewId: string): boolean => {
    return reportedReviews.has(reviewId);
  };

  /**
   * Bulk check if multiple reviews are reported
   */
  const checkMultipleReported = async (
    reviewIds: string[],
  ): Promise<string[]> => {
    if (!currentUserId || reviewIds.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from("review_reports")
        .select("review_id")
        .eq("reporter_user_id", currentUserId)
        .in("review_id", reviewIds);

      if (error) {
        console.error("Error checking multiple report statuses:", error);
        return [];
      }

      const reportedIds = data?.map((r) => r.review_id) || [];

      // Update local state
      setReportedReviews((prev) => {
        const newSet = new Set(prev);
        reportedIds.forEach((id) => newSet.add(id));
        return newSet;
      });

      return reportedIds;
    } catch (error) {
      console.error("Error checking multiple report statuses:", error);
      return [];
    }
  };

  return {
    isSubmitting,
    loading,
    reports,
    reportedReviews,
    submitReport,
    checkIfReported,
    getUserReports,
    isAlreadyReported,
    checkMultipleReported,
    REPORT_REASONS,
  };
}
