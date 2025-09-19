import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase-generated";

type BlockedUser = Database["public"]["Tables"]["blocked_users"]["Row"] & {
  blocked_profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
};

interface UseBlockUserOptions {
  onBlockSuccess?: (blockedUserId: string) => void;
  onUnblockSuccess?: (unblockedUserId: string) => void;
  onError?: (error: Error) => void;
}

export const useBlockUser = (options: UseBlockUserOptions = {}) => {
  const { profile } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blockingUser, setBockingUser] = useState<string | null>(null);

  const { onBlockSuccess, onUnblockSuccess, onError } = options;

  // Fetch blocked users for current user (robust: separate profile fetch)
  const fetchBlockedUsers = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // 1) Fetch raw blocked rows
      const { data: blockedRows, error: blockedErr } = await supabase
        .from("blocked_users")
        .select("*")
        .eq("blocker_id", profile.id)
        .order("blocked_at", { ascending: false });

      if (blockedErr) throw blockedErr;

      const rows = blockedRows || [];
      if (rows.length === 0) {
        setBlockedUsers([]);
        return;
      }

      // 2) Fetch related profiles in one query
      const blockedIds = Array.from(new Set(rows.map((r) => r.blocked_id)));
      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", blockedIds);

      if (profilesErr) {
        // If profile fetch fails, still show raw blocked entries
        console.warn("Failed to fetch blocked profiles, showing IDs only");
        setBlockedUsers(rows as BlockedUser[]);
        return;
      }

      const idToProfile = new Map((profilesData || []).map((p) => [p.id, p]));

      const merged: BlockedUser[] = rows.map((r) => ({
        ...r,
        blocked_profile: idToProfile.get(r.blocked_id)
          ? {
              id: idToProfile.get(r.blocked_id)!.id,
              full_name: idToProfile.get(r.blocked_id)!.full_name,
              avatar_url: idToProfile.get(r.blocked_id)!.avatar_url,
            }
          : undefined,
      }));

      setBlockedUsers(merged);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, onError]);

  // Check if a specific user is blocked
  const isUserBlocked = useCallback(
    (userId: string): boolean => {
      return blockedUsers.some((blocked) => blocked.blocked_id === userId);
    },
    [blockedUsers],
  );

  // Block a user with confirmation
  const blockUser = useCallback(
    async (userId: string, reason?: string) => {
      if (!profile?.id) {
        Alert.alert("Error", "You must be logged in to block users");
        return false;
      }

      if (userId === profile.id) {
        Alert.alert("Error", "You cannot block yourself");
        return false;
      }

      if (isUserBlocked(userId)) {
        Alert.alert("Info", "This user is already blocked");
        return false;
      }

      try {
        setBockingUser(userId);

        // Start a transaction to handle blocking and friend removal atomically
        const { error } = await supabase.rpc(
          "block_user_and_remove_friendship",
          {
            p_blocker_id: profile.id,
            p_blocked_id: userId,
            p_reason: reason || null,
          },
        );

        if (error) {
          // Fallback to manual operations if RPC doesn't exist

          // First, insert the block record
          const { error: blockError } = await supabase
            .from("blocked_users")
            .insert({
              blocker_id: profile.id,
              blocked_id: userId,
              reason: reason || null,
            });

          if (blockError) throw blockError;

          // Remove existing friendships (bidirectional)
          const { error: friendshipError } = await supabase
            .from("friends")
            .delete()
            .or(
              `and(user_id.eq.${profile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${profile.id})`,
            );

          if (friendshipError) {
            console.error("Error removing friendships:", friendshipError);
            // Don't fail the blocking operation if friendship removal fails
          }

          // Remove/cancel any pending friend requests (bidirectional)
          const { error: requestError } = await supabase
            .from("friend_requests")
            .delete()
            .or(
              `and(from_user_id.eq.${profile.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${profile.id})`,
            );

          if (requestError) {
            console.error("Error removing friend requests:", requestError);
            // Don't fail the blocking operation if request removal fails
          }
        }

        // Update local state
        const newBlockedUser: BlockedUser = {
          id: `temp-${userId}`, // Temporary ID until refetch
          blocker_id: profile.id,
          blocked_id: userId,
          blocked_at: new Date().toISOString(),
          reason: reason || null,
        };

        setBlockedUsers((prev) => [newBlockedUser, ...prev]);

        Alert.alert(
          "Success",
          "User has been blocked and removed from your friends list",
        );
        onBlockSuccess?.(userId);

        // Refresh the list to get the real data
        await fetchBlockedUsers();

        return true;
      } catch (error) {
        console.error("Error blocking user:", error);
        Alert.alert("Error", "Failed to block user");
        onError?.(error as Error);
        return false;
      } finally {
        setBockingUser(null);
      }
    },
    [profile?.id, isUserBlocked, onBlockSuccess, onError, fetchBlockedUsers],
  );

  // Unblock a user with confirmation
  const unblockUser = useCallback(
    async (userId: string) => {
      if (!profile?.id) {
        Alert.alert("Error", "You must be logged in to unblock users");
        return false;
      }

      if (!isUserBlocked(userId)) {
        Alert.alert("Info", "This user is not blocked");
        return false;
      }

      try {
        setBockingUser(userId);

        const { error } = await supabase
          .from("blocked_users")
          .delete()
          .eq("blocker_id", profile.id)
          .eq("blocked_id", userId);

        if (error) throw error;

        // Update local state optimistically
        setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== userId));

        Alert.alert("Success", "User has been unblocked successfully");
        onUnblockSuccess?.(userId);

        // Ensure list reflects server truth
        await fetchBlockedUsers();
        return true;
      } catch (error) {
        console.error("Error unblocking user:", error);
        Alert.alert("Error", "Failed to unblock user");
        onError?.(error as Error);
        return false;
      } finally {
        setBockingUser(null);
      }
    },
    [profile?.id, isUserBlocked, onUnblockSuccess, onError],
  );

  // Block with confirmation dialog
  const blockUserWithConfirmation = useCallback(
    async (userId: string, userName?: string) => {
      const displayName = userName || "this user";

      Alert.alert(
        "Block User",
        `Are you sure you want to block ${displayName}?\n\n• You won't see their content anymore\n• They won't be able to interact with you\n• They will be removed from your friends list\n• Any pending friend requests will be cancelled`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: () => blockUser(userId),
          },
        ],
      );
    },
    [blockUser],
  );

  // Unblock with confirmation dialog
  const unblockUserWithConfirmation = useCallback(
    async (userId: string, userName?: string) => {
      const displayName = userName || "this user";

      Alert.alert(
        "Unblock User",
        `Are you sure you want to unblock ${displayName}? You'll be able to see their content again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: () => unblockUser(userId),
          },
        ],
      );
    },
    [unblockUser],
  );

  // Refresh blocked users list
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  // Initial fetch
  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  return {
    blockedUsers,
    loading,
    refreshing,
    blockingUser,
    isUserBlocked,
    blockUser,
    unblockUser,
    blockUserWithConfirmation,
    unblockUserWithConfirmation,
    fetchBlockedUsers,
    refresh,
  };
};
