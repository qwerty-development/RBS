// hooks/useSocial.ts - Updated with offline support
import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useNetwork } from "@/context/network-provider";
import { offlineStorage } from "@/utils/offlineStorage";
import { offlineSync } from "@/services/offlineSync";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface CreatePostParams {
  content: string;
  bookingId?: string;
  restaurantId?: string;
  imageUrls: string[];
  taggedFriendIds: string[];
}

interface SocialData {
  posts: any[];
  friends: any[];
  friendRequests: any[];
  timestamp: number;
}

// Cache keys
const SOCIAL_CACHE_KEY = "@social_data";
const FRIENDS_CACHE_KEY = "@friends_cache";
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for social data

export function useSocial() {
  const { profile } = useAuth();
  const { isOnline, isOffline } = useNetwork();
  const [loading, setLoading] = useState(false);

  // Cache management functions
  const getCachedSocialData = useCallback(async (): Promise<SocialData | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(SOCIAL_CACHE_KEY);
      
      if (cachedData) {
        const parsedData: SocialData = JSON.parse(cachedData);
        const isStale = Date.now() - parsedData.timestamp > CACHE_DURATION;
        
        if (!isStale || isOffline) {
          console.log("📱 Using cached social data");
          return parsedData;
        }
      }
      return null;
    } catch (error) {
      console.error("Error reading cached social data:", error);
      return null;
    }
  }, [isOffline]);

  const cacheSocialData = useCallback(async (
    posts: any[], 
    friends: any[], 
    friendRequests: any[]
  ): Promise<void> => {
    try {
      const cacheData: SocialData = {
        posts,
        friends,
        friendRequests,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(SOCIAL_CACHE_KEY, JSON.stringify(cacheData));
      console.log("💾 Social data cached for offline use");
    } catch (error) {
      console.error("Error caching social data:", error);
    }
  }, []);

  // Check if users are friends with offline support
  const checkFriendship = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!profile?.id) return false;

      try {
        // Try cache first if offline
        if (isOffline) {
          const cachedData = await getCachedSocialData();
          if (cachedData) {
            return cachedData.friends.some(friend => 
              friend.user_id === userId || friend.friend_id === userId
            );
          }
          return false;
        }

        // Online check
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
    [profile?.id, isOffline, getCachedSocialData],
  );

  // Send friend request with offline support
  const sendFriendRequest = useCallback(
    async (friendId: string) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      setLoading(true);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // If offline, queue the action
        if (isOffline) {
          await offlineStorage.addToOfflineQueue({
            type: 'SEND_FRIEND_REQUEST', // You'll need to add this type
            payload: {
              user_id: profile.id,
              friend_id: friendId,
            },
          });

          Alert.alert(
            "Friend Request Queued",
            "Your friend request will be sent when you're back online."
          );

          return { success: true };
        }

        // Online operation
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
        return { 
          success: false, 
          error: isOffline 
            ? "Unable to send friend request while offline"
            : "Failed to send friend request" 
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id, isOffline],
  );

  // Accept friend request with offline support
  const acceptFriendRequest = useCallback(async (requestId: string) => {
    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);

      // If offline, queue the action
      if (isOffline) {
        await offlineStorage.addToOfflineQueue({
          type: 'ACCEPT_FRIEND_REQUEST', // You'll need to add this type
          payload: {
            request_id: requestId,
          },
        });

        Alert.alert(
          "Action Queued",
          "Friend request will be accepted when you're back online."
        );

        return { success: true };
      }

      // Online operation
      const { error } = await supabase
        .from("friends")
        .update({ status: 'accepted' })
        .eq("id", requestId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: isOffline 
          ? "Unable to accept request while offline"
          : "Failed to accept request" 
      };
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  // Create a post with offline support
  const createPost = useCallback(
    async (params: CreatePostParams) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      setLoading(true);
      try {
        // If offline, queue the action
        if (isOffline) {
          await offlineStorage.addToOfflineQueue({
            type: 'CREATE_POST', // You'll need to add this type
            payload: {
              user_id: profile.id,
              content: params.content,
              booking_id: params.bookingId,
              restaurant_id: params.restaurantId,
              image_urls: params.imageUrls,
              tagged_friend_ids: params.taggedFriendIds,
            },
          });

          Alert.alert(
            "Post Queued",
            "Your post will be published when you're back online."
          );

          return { success: true, postId: `offline_${Date.now()}` };
        }

        // Online operation
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
        return { 
          success: false, 
          error: isOffline 
            ? "Unable to create post while offline"
            : "Failed to create post" 
        };
      } finally {
        setLoading(false);
      }
    },
    [profile?.id, isOffline],
  );

  // Like/Unlike a post with offline support
  const togglePostLike = useCallback(
    async (postId: string, isLiked: boolean) => {
      if (!profile?.id) return { success: false };

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // If offline, queue the action
        if (isOffline) {
          await offlineStorage.addToOfflineQueue({
            type: isLiked ? 'UNLIKE_POST' : 'LIKE_POST', // You'll need to add these types
            payload: {
              post_id: postId,
              user_id: profile.id,
            },
          });

          return { success: true };
        }

        // Online operation
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
    [profile?.id, isOffline],
  );

  // Add comment to post with offline support
  const addComment = useCallback(
    async (postId: string, comment: string) => {
      if (!profile?.id) return { success: false, error: "Not authenticated" };

      try {
        // If offline, queue the action
        if (isOffline) {
          await offlineStorage.addToOfflineQueue({
            type: 'ADD_COMMENT', // You'll need to add this type
            payload: {
              post_id: postId,
              user_id: profile.id,
              comment: comment.trim(),
            },
          });

          Alert.alert(
            "Comment Queued",
            "Your comment will be posted when you're back online."
          );

          return { 
            success: true, 
            comment: {
              id: `offline_${Date.now()}`,
              post_id: postId,
              user_id: profile.id,
              comment: comment.trim(),
              created_at: new Date().toISOString(),
              user: {
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
            }
          };
        }

        // Online operation
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
        return { 
          success: false, 
          error: isOffline 
            ? "Unable to add comment while offline"
            : "Failed to add comment" 
        };
      }
    },
    [profile?.id, isOffline],
  );

  // Get friend suggestions with offline fallback
  const getFriendSuggestions = useCallback(async () => {
    if (!profile?.id) return [];

    try {
      // If offline, return empty array or cached suggestions
      if (isOffline) {
        const cachedData = await getCachedSocialData();
        if (cachedData) {
          // Return some basic suggestions from cached friends
          return cachedData.friends.slice(0, 5).map(friend => ({
            id: friend.friend_id === profile.id ? friend.user_id : friend.friend_id,
            full_name: friend.user?.full_name || friend.friend?.full_name || "Unknown",
            avatar_url: friend.user?.avatar_url || friend.friend?.avatar_url || null,
          }));
        }
        return [];
      }

      // Online operation
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
  }, [profile?.id, isOffline, getCachedSocialData]);

  // Get social feed with offline support
  const getSocialFeed = useCallback(async (forceOnline = false) => {
    if (!profile?.id) return { posts: [], friends: [], friendRequests: [] };

    try {
      // If offline and not forcing online, try to load from cache
      if (isOffline && !forceOnline) {
        console.log("📱 Loading social feed from cache (offline)");
        const cachedData = await getCachedSocialData();
        
        if (cachedData) {
          return {
            posts: cachedData.posts,
            friends: cachedData.friends,
            friendRequests: cachedData.friendRequests,
          };
        } else {
          throw new Error("No cached social data available");
        }
      }

      // Check if we can use cache first
      if (!forceOnline) {
        const cachedData = await getCachedSocialData();
        if (cachedData) {
          console.log("📱 Using cached social feed");
          return {
            posts: cachedData.posts,
            friends: cachedData.friends,
            friendRequests: cachedData.friendRequests,
          };
        }
      }

      // Online fetch
      console.log("🌐 Fetching social feed from server");
      
      const [postsResult, friendsResult, requestsResult] = await Promise.all([
        // Get posts from friends
        supabase
          .from("posts")
          .select(`
            *,
            user:profiles (full_name, avatar_url),
            restaurant:restaurants (name),
            images:post_images (*),
            tags:post_tags (tagged_user:profiles (full_name)),
            likes:post_likes (user_id),
            comments:post_comments (*, user:profiles (full_name, avatar_url))
          `)
          .order("created_at", { ascending: false })
          .limit(20),
          
        // Get friends list
        supabase
          .from("friends")
          .select(`
            *,
            user:profiles!friends_user_id_fkey (id, full_name, avatar_url),
            friend:profiles!friends_friend_id_fkey (id, full_name, avatar_url)
          `)
          .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`),
          
        // Get friend requests
        supabase
          .from("friends")
          .select(`
            *,
            user:profiles!friends_user_id_fkey (id, full_name, avatar_url)
          `)
          .eq("friend_id", profile.id)
          .eq("status", "pending"),
      ]);

      const posts = postsResult.data || [];
      const friends = friendsResult.data || [];
      const friendRequests = requestsResult.data || [];

      // Cache for offline use
      await cacheSocialData(posts, friends, friendRequests);

      return { posts, friends, friendRequests };
    } catch (error) {
      console.error("Error fetching social feed:", error);
      
      // If error and offline, try cache as fallback
      if (isOffline) {
        const cachedData = await getCachedSocialData();
        if (cachedData) {
          console.log("📱 Using cached social feed after error");
          return {
            posts: cachedData.posts,
            friends: cachedData.friends,
            friendRequests: cachedData.friendRequests,
          };
        }
      }
      
      return { posts: [], friends: [], friendRequests: [] };
    }
  }, [profile?.id, isOffline, getCachedSocialData, cacheSocialData]);

  return {
    loading,
    isOnline,
    isOffline,
    checkFriendship,
    sendFriendRequest,
    acceptFriendRequest,
    createPost,
    togglePostLike,
    addComment,
    getFriendSuggestions,
    getSocialFeed,
  };
}