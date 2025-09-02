import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

export type ContentType = "review" | "post" | "comment" | "playlist";

export type FlagReason =
  | "inappropriate_language"
  | "harassment"
  | "spam"
  | "fake_review"
  | "hate_speech"
  | "violence_threats"
  | "sexual_content"
  | "discrimination"
  | "other";

export interface ContentFlag {
  id: string;
  flagged_by_user_id: string;
  content_type: ContentType;
  content_id: string;
  reason: FlagReason;
  description?: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  created_at: string;
}

export interface UserBlock {
  id: string;
  blocking_user_id: string;
  blocked_user_id: string;
  reason?: string;
  created_at: string;
}

export const useContentModeration = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const flagContent = useCallback(
    async (
      contentType: ContentType,
      contentId: string,
      reason: FlagReason,
      description?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!profile?.id) {
        return { success: false, error: "Must be logged in to flag content" };
      }

      setLoading(true);
      try {
        const { error } = await supabase.from("content_flags").insert({
          flagged_by_user_id: profile.id,
          content_type: contentType,
          content_id: contentId,
          reason,
          description,
          status: "pending",
        });

        if (error) {
          if (error.code === "23505") {
            // Unique constraint violation
            return {
              success: false,
              error: "You have already flagged this content",
            };
          }
          throw error;
        }

        return { success: true };
      } catch (error: any) {
        console.error("Error flagging content:", error);
        return {
          success: false,
          error: error.message || "Failed to flag content",
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  const blockUser = useCallback(
    async (
      blockedUserId: string,
      reason?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!profile?.id) {
        return { success: false, error: "Must be logged in to block users" };
      }

      if (profile.id === blockedUserId) {
        return { success: false, error: "Cannot block yourself" };
      }

      setLoading(true);
      try {
        const { error } = await supabase.from("user_blocks").insert({
          blocking_user_id: profile.id,
          blocked_user_id: blockedUserId,
          reason,
        });

        if (error) {
          if (error.code === "23505") {
            // Unique constraint violation
            return { success: false, error: "User is already blocked" };
          }
          throw error;
        }

        return { success: true };
      } catch (error: any) {
        console.error("Error blocking user:", error);
        return {
          success: false,
          error: error.message || "Failed to block user",
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  const unblockUser = useCallback(
    async (
      blockedUserId: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!profile?.id) {
        return { success: false, error: "Must be logged in to unblock users" };
      }

      setLoading(true);
      try {
        const { error } = await supabase.from("user_blocks").delete().match({
          blocking_user_id: profile.id,
          blocked_user_id: blockedUserId,
        });

        if (error) throw error;

        return { success: true };
      } catch (error: any) {
        console.error("Error unblocking user:", error);
        return {
          success: false,
          error: error.message || "Failed to unblock user",
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  const getBlockedUsers = useCallback(async (): Promise<{
    success: boolean;
    data?: UserBlock[];
    error?: string;
  }> => {
    if (!profile?.id) {
      return { success: false, error: "Must be logged in" };
    }

    try {
      const { data, error } = await supabase
        .from("user_blocks")
        .select(
          `
          *,
          blocked_user:profiles!user_blocks_blocked_user_id_fkey(
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("blocking_user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error("Error fetching blocked users:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch blocked users",
      };
    }
  }, [profile?.id]);

  const isUserBlocked = useCallback(
    async (
      userId: string,
    ): Promise<{ success: boolean; isBlocked?: boolean; error?: string }> => {
      if (!profile?.id) {
        return { success: true, isBlocked: false };
      }

      try {
        const { data, error } = await supabase
          .from("user_blocks")
          .select("id")
          .match({
            blocking_user_id: profile.id,
            blocked_user_id: userId,
          })
          .maybeSingle();

        if (error) throw error;

        return { success: true, isBlocked: !!data };
      } catch (error: any) {
        console.error("Error checking if user is blocked:", error);
        return { success: false, error: error.message };
      }
    },
    [profile?.id],
  );

  const getUserFlags = useCallback(async (): Promise<{
    success: boolean;
    data?: ContentFlag[];
    error?: string;
  }> => {
    if (!profile?.id) {
      return { success: false, error: "Must be logged in" };
    }

    try {
      const { data, error } = await supabase
        .from("content_flags")
        .select("*")
        .eq("flagged_by_user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error("Error fetching user flags:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch flags",
      };
    }
  }, [profile?.id]);

  const showFlagSuccessAlert = useCallback(() => {
    Alert.alert(
      "Content Flagged",
      "Thank you for reporting this content. Our moderation team will review it within 24 hours and take appropriate action.",
      [{ text: "OK" }],
    );
  }, []);

  const showBlockSuccessAlert = useCallback((userName?: string) => {
    Alert.alert(
      "User Blocked",
      `${userName || "This user"} has been blocked. They will no longer be able to interact with your content or contact you.`,
      [{ text: "OK" }],
    );
  }, []);

  return {
    loading,
    flagContent,
    blockUser,
    unblockUser,
    getBlockedUsers,
    isUserBlocked,
    getUserFlags,
    showFlagSuccessAlert,
    showBlockSuccessAlert,
  };
};

export default useContentModeration;
