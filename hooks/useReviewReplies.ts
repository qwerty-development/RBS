import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

// Type definitions
type ReviewReply = Database["public"]["Tables"]["review_replies"]["Row"] & {
  replied_by_profile: {
    full_name: string;
    avatar_url?: string | null;
  };
  restaurant: {
    name: string;
    main_image_url?: string | null;
  };
};

interface UseReviewRepliesOptions {
  reviewId?: string;
  restaurantId?: string;
}

export const useReviewReplies = ({
  reviewId,
  restaurantId,
}: UseReviewRepliesOptions = {}) => {
  const { session } = useAuth();
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch replies for a specific review
  const fetchReplies = useCallback(async (targetReviewId: string) => {
    if (!targetReviewId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("review_replies")
        .select(
          `
          *,
          replied_by_profile:profiles!replied_by (
            full_name,
            avatar_url
          ),
          restaurant:restaurants!restaurant_id (
            name,
            main_image_url
          )
        `,
        )
        .eq("review_id", targetReviewId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReplies(data || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
      Alert.alert("Error", "Failed to load replies");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch replies for multiple reviews
  const fetchRepliesForReviews = useCallback(async (reviewIds: string[]) => {
    if (!reviewIds.length) return {};

    try {
      const { data, error } = await supabase
        .from("review_replies")
        .select(
          `
          *,
          replied_by_profile:profiles!replied_by (
            full_name,
            avatar_url
          ),
          restaurant:restaurants!restaurant_id (
            name,
            main_image_url
          )
        `,
        )
        .in("review_id", reviewIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group replies by review_id
      const repliesByReview: Record<string, ReviewReply[]> = {};
      (data || []).forEach((reply) => {
        if (!repliesByReview[reply.review_id]) {
          repliesByReview[reply.review_id] = [];
        }
        repliesByReview[reply.review_id].push(reply);
      });

      return repliesByReview;
    } catch (error) {
      console.error("Error fetching replies for reviews:", error);
      return {};
    }
  }, []);

  // Create a new reply
  const createReply = useCallback(
    async (targetReviewId: string, replyMessage: string) => {
      if (!session?.user?.id || !targetReviewId || !replyMessage.trim()) {
        Alert.alert("Error", "Missing required information");
        return false;
      }

      if (!restaurantId) {
        Alert.alert("Error", "Restaurant ID is required");
        return false;
      }

      try {
        setSubmitting(true);

        const { data, error } = await supabase
          .from("review_replies")
          .insert({
            review_id: targetReviewId,
            restaurant_id: restaurantId,
            replied_by: session.user.id,
            reply_message: replyMessage.trim(),
          })
          .select(
            `
          *,
          replied_by_profile:profiles!replied_by (
            full_name,
            avatar_url
          ),
          restaurant:restaurants!restaurant_id (
            name,
            main_image_url
          )
        `,
          )
          .single();

        if (error) throw error;

        // Add the new reply to the existing replies
        if (data && reviewId === targetReviewId) {
          setReplies((prev) => [data, ...prev]);
        }

        Alert.alert("Success", "Reply posted successfully");
        return true;
      } catch (error: any) {
        console.error("Error creating reply:", error);

        // Handle specific error cases
        if (error.message?.includes("duplicate key")) {
          Alert.alert("Error", "A reply already exists for this review");
        } else {
          Alert.alert("Error", "Failed to post reply. Please try again.");
        }

        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [session?.user?.id, restaurantId, reviewId],
  );

  // Delete a reply (for authorized users only)
  const deleteReply = useCallback(
    async (replyId: string) => {
      if (!session?.user?.id) {
        Alert.alert("Error", "Not authorized to delete replies");
        return false;
      }

      try {
        const { error } = await supabase
          .from("review_replies")
          .delete()
          .eq("id", replyId)
          .eq("replied_by", session.user.id); // Ensure user can only delete their own replies

        if (error) throw error;

        // Remove the reply from the state
        setReplies((prev) => prev.filter((reply) => reply.id !== replyId));

        Alert.alert("Success", "Reply deleted successfully");
        return true;
      } catch (error) {
        console.error("Error deleting reply:", error);
        Alert.alert("Error", "Failed to delete reply");
        return false;
      }
    },
    [session?.user?.id],
  );

  // Update a reply
  const updateReply = useCallback(
    async (replyId: string, newMessage: string) => {
      if (!session?.user?.id || !newMessage.trim()) {
        Alert.alert("Error", "Missing required information");
        return false;
      }

      try {
        setSubmitting(true);

        const { data, error } = await supabase
          .from("review_replies")
          .update({
            reply_message: newMessage.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", replyId)
          .eq("replied_by", session.user.id) // Ensure user can only update their own replies
          .select(
            `
          *,
          replied_by_profile:profiles!replied_by (
            full_name,
            avatar_url
          ),
          restaurant:restaurants!restaurant_id (
            name,
            main_image_url
          )
        `,
          )
          .single();

        if (error) throw error;

        // Update the reply in the state
        if (data) {
          setReplies((prev) =>
            prev.map((reply) => (reply.id === replyId ? data : reply)),
          );
        }

        Alert.alert("Success", "Reply updated successfully");
        return true;
      } catch (error) {
        console.error("Error updating reply:", error);
        Alert.alert("Error", "Failed to update reply");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [session?.user?.id],
  );

  // Auto-fetch replies when reviewId changes
  useEffect(() => {
    if (reviewId) {
      fetchReplies(reviewId);
    }
  }, [reviewId, fetchReplies]);

  return {
    replies,
    loading,
    submitting,
    fetchReplies,
    fetchRepliesForReviews,
    createReply,
    deleteReply,
    updateReply,
    canReply: !!session?.user?.id && !!restaurantId,
  };
};
