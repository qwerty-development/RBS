// hooks/useSocial.ts
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

interface CreatePostParams {
  content: string;
  bookingId?: string;
  restaurantId?: string;
  imageUrls: string[];
  taggedFriendIds: string[];
}

export function useSocial() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check if users are friends
  const checkFriendship = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!profile?.id) return false;

      try {
        const { data, error } = await supabase
          .from("friends")
          .select("id")
          .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .single();

        return !!data;
      } catch (error) {
        return false;
      }
    },
    [profile?.id],
  );

  // Send friend request
  const sendFriendRequest = useCallback(
    async (friendId: string) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      setLoading(true);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const { error } = await supabase.from("friends").insert({
          user_id: profile.id,
          friend_id: friendId,
        });

        if (error) throw error;

        return { success: true };
      } catch (error: any) {
        if (error.code === "23505") {
          return { success: false, error: "Friend request already exists" };
        }
        return { success: false, error: "Failed to send friend request" };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  // Accept friend request
  const acceptFriendRequest = useCallback(async (requestId: string) => {
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);

      const { error } = await supabase.from("friends").eq("id", requestId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to accept request" };
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a post
  const createPost = useCallback(
    async (params: CreatePostParams) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      setLoading(true);
      try {
        // Create the post
        const { data: post, error: postError } = await supabase
          .from("posts")
          .insert({
            user_id: profile.id,
            booking_id: params.bookingId || null,
            restaurant_id: params.restaurantId || null,
            content: params.content,
            visibility: "friends",
          })
          .select()
          .single();

        if (postError) throw postError;

        // Add images if any
        if (params.imageUrls.length > 0) {
          const imageRecords = params.imageUrls.map((url, index) => ({
            post_id: post.id,
            image_url: url,
            image_order: index,
          }));

          const { error: imagesError } = await supabase
            .from("post_images")
            .insert(imageRecords);

          if (imagesError) throw imagesError;
        }

        // Tag friends if any
        if (params.taggedFriendIds.length > 0) {
          const tags = params.taggedFriendIds.map((friendId) => ({
            post_id: post.id,
            tagged_user_id: friendId,
          }));

          const { error: tagsError } = await supabase
            .from("post_tags")
            .insert(tags);

          if (tagsError) throw tagsError;
        }

        return { success: true, postId: post.id };
      } catch (error) {
        console.error("Error creating post:", error);
        return { success: false, error: "Failed to create post" };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id],
  );

  // Like/Unlike a post
  const togglePostLike = useCallback(
    async (postId: string, isLiked: boolean) => {
      if (!profile?.id) return { success: false };

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (isLiked) {
          await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", profile.id);
        } else {
          await supabase
            .from("post_likes")
            .insert({ post_id: postId, user_id: profile.id });
        }

        return { success: true };
      } catch (error) {
        return { success: false };
      }
    },
    [profile?.id],
  );

  // Add comment to post
  const addComment = useCallback(
    async (postId: string, comment: string) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      try {
        const { data, error } = await supabase
          .from("post_comments")
          .insert({
            post_id: postId,
            user_id: profile.id,
            comment: comment.trim(),
          })
          .select(
            `
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `,
          )
          .single();

        if (error) throw error;

        return { success: true, comment: data };
      } catch (error) {
        return { success: false, error: "Failed to add comment" };
      }
    },
    [profile?.id],
  );

  // Get friend suggestions (users who are friends of friends)
  const getFriendSuggestions = useCallback(async () => {
    if (!profile?.id) return [];

    try {
      // Get current friends
      const { data: friends } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

      const friendIds =
        friends?.reduce((acc: string[], f) => {
          if (f.user_id === profile.id) acc.push(f.friend_id);
          else acc.push(f.user_id);
          return acc;
        }, []) || [];

      // Get friends of friends
      const { data: suggestions } = await supabase
        .from("friends")
        .select(
          `
          user_id,
          friend_id,
          user:profiles!friends_user_id_fkey (
            id,
            full_name,
            avatar_url
          ),
          friend:profiles!friends_friend_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .in("user_id", friendIds)
        .neq("friend_id", profile.id)
        .not("friend_id", "in", `(${friendIds.join(",")})`)
        .limit(10);

      // Format and deduplicate suggestions
      const uniqueSuggestions = new Map();
      suggestions?.forEach((s) => {
        if (s.friend_id !== profile.id && !friendIds.includes(s.friend_id)) {
          uniqueSuggestions.set(s.friend_id, s.friend);
        }
      });

      return Array.from(uniqueSuggestions.values());
    } catch (error) {
      console.error("Error getting friend suggestions:", error);
      return [];
    }
  }, [profile?.id]);

  return {
    loading,
    checkFriendship,
    sendFriendRequest,
    acceptFriendRequest,
    createPost,
    togglePostLike,
    addComment,
    getFriendSuggestions,
  };
}