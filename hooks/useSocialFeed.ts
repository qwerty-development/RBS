// hooks/useSocialFeed.ts
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";
import type { Database } from "@/types/supabase-generated";

type Post = Database["public"]["Tables"]["posts"]["Row"];
type PostWithDetails = Post & {
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  restaurant?: {
    id: string;
    name: string;
    main_image_url: string | null;
  };
  _likes_count?: number;
  _comments_count?: number;
  _user_has_liked?: boolean;
};

export const useSocialFeed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load social feed posts
  const loadFeed = useCallback(async (limit: number = 20, offset: number = 0) => {
    if (!user) return [];

    try {
      setLoading(offset === 0);

      // Get posts from friends and own posts
      const { data: friendsData } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = friendsData?.reduce((acc: string[], f) => {
        if (f.user_id === user.id) acc.push(f.friend_id);
        else acc.push(f.user_id);
        return acc;
      }, []) || [];

      // Include current user in the feed
      const userIds = [user.id, ...friendIds];

      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          user:profiles!posts_user_id_fkey(id, full_name, avatar_url),
          restaurant:restaurants(id, name, main_image_url)
        `)
        .in("user_id", userIds)
        .eq("visibility", "friends")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get additional metadata (likes, comments)
      const postsWithMetadata = await Promise.all(
        (data || []).map(async (post) => {
          // Get likes count and user like status
          const { data: likesData } = await supabase
            .from("post_likes")
            .select("user_id")
            .eq("post_id", post.id);

          const _likes_count = likesData?.length || 0;
          const _user_has_liked = likesData?.some(like => like.user_id === user.id) || false;

          // Get comments count
          const { data: commentsData } = await supabase
            .from("post_comments")
            .select("id")
            .eq("post_id", post.id);

          const _comments_count = commentsData?.length || 0;

          return {
            ...post,
            _likes_count,
            _comments_count,
            _user_has_liked
          };
        })
      );

      if (offset === 0) {
        setPosts(postsWithMetadata);
      } else {
        setPosts(prev => [...prev, ...postsWithMetadata]);
      }

      return postsWithMetadata;

    } catch (error) {
      console.error("Error loading social feed:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refresh feed
  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(20, 0);
    setRefreshing(false);
  }, [loadFeed]);

  // Load more posts
  const loadMore = useCallback(async () => {
    if (!loading) {
      await loadFeed(20, posts.length);
    }
  }, [loadFeed, loading, posts.length]);

  // Like/unlike a post
  const toggleLike = useCallback(async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post._user_has_liked) {
        // Unlike
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, _user_has_liked: false, _likes_count: (p._likes_count || 1) - 1 }
            : p
        ));
      } else {
        // Like
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: user.id });

        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, _user_has_liked: true, _likes_count: (p._likes_count || 0) + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  }, [user, posts]);

  // Add comment to post
  const addComment = useCallback(async (postId: string, comment: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          comment: comment.trim()
        })
        .select(`
          *,
          user:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Update comments count
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, _comments_count: (p._comments_count || 0) + 1 }
          : p
      ));

      return data;
    } catch (error) {
      console.error("Error adding comment:", error);
      return null;
    }
  }, [user]);

  // Delete post (own posts only)
  const deletePost = useCallback(async (postId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      return false;
    }
  }, [user]);

  // Listen for real-time updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = realtimeSubscriptionService.subscribeToUser({
      userId: user.id,
      onPostChange: (payload) => {
        console.log("Post real-time update:", payload);

        if (payload.eventType === "INSERT" && payload.new) {
          // New post - could be from a friend, so reload feed
          refreshFeed();
        } else if (payload.eventType === "UPDATE" && payload.new) {
          // Post updated
          setPosts(prev => prev.map(p => 
            p.id === payload.new!.id 
              ? { ...p, ...payload.new! }
              : p
          ));
        } else if (payload.eventType === "DELETE" && payload.old) {
          // Post deleted
          setPosts(prev => prev.filter(p => p.id !== payload.old!.id));
        }
      }
    });

    return unsubscribe;
  }, [user, refreshFeed]);

  // Load initial feed
  useEffect(() => {
    if (user) {
      loadFeed();
    }
  }, [user, loadFeed]);

  return {
    // Data
    posts,
    loading,
    refreshing,

    // Actions
    loadFeed,
    refreshFeed,
    loadMore,
    toggleLike,
    addComment,
    deletePost,

    // State
    isEmpty: posts.length === 0,
    hasMore: true // Could implement proper pagination tracking
  };
};
