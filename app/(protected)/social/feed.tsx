// app/(protected)/social/feed.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Camera,
  Plus,
  Users,
  Search,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// Types
interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  booking_id: string;
  content: string;
  images: Array<{
    id: string;
    image_url: string;
    image_order: number;
  }>;
  tagged_friends: Array<{
    id: string;
    full_name: string;
    avatar_url: string;
  }>;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_user?: boolean;
}

// Post Component
const PostCard: React.FC<{
  post: Post;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (post: Post) => void;
}> = ({ post, onLike, onComment, onShare }) => {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const [imageIndex, setImageIndex] = useState(0);

  return (
    <View className="bg-card mb-2 border-b border-border">
      {/* Header */}
      <Pressable
        onPress={() => router.push(`/profile/${post.user_id}`)}
        className="flex-row items-center p-4"
      >
        <Image
          source={{ uri: post.user_avatar || "https://via.placeholder.com/50" }}
          className="w-10 h-10 rounded-full mr-3"
        />
        <View className="flex-1">
          <Text className="font-semibold">{post.user_name}</Text>
          <View className="flex-row items-center mt-0.5">
            <Muted className="text-xs">
              {format(new Date(post.created_at), "MMM d, h:mm a")}
            </Muted>
            {post.restaurant_name && (
              <>
                <Muted className="text-xs mx-1">•</Muted>
                <Pressable
                  onPress={() => router.push(`/restaurant/${post.restaurant_id}`)}
                >
                  <Muted className="text-xs text-primary">
                    {post.restaurant_name}
                  </Muted>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <Pressable className="p-2">
          <MoreVertical size={20} color="#666" />
        </Pressable>
      </Pressable>

      {/* Content */}
      {post.content && (
        <View className="px-4 pb-3">
          <P>{post.content}</P>
        </View>
      )}

      {/* Tagged Friends */}
      {post.tagged_friends.length > 0 && (
        <View className="px-4 pb-3">
          <View className="flex-row items-center flex-wrap">
            <Users size={16} color="#666" />
            <Muted className="text-sm ml-2">with </Muted>
            {post.tagged_friends.map((friend, index) => (
              <React.Fragment key={friend.id}>
                <Pressable
                  onPress={() => router.push(`/profile/${friend.id}`)}
                >
                  <Text className="text-sm text-primary">
                    {friend.full_name}
                  </Text>
                </Pressable>
                {index < post.tagged_friends.length - 1 && (
                  <Muted className="text-sm">, </Muted>
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Images */}
      {post.images.length > 0 && (
        <View className="mb-3">
          <FlatList
            data={post.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
              );
              setImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/restaurant/${post.restaurant_id}`)}
              >
                <Image
                  source={{ uri: item.image_url }}
                  className="w-screen h-80"
                  contentFit="cover"
                />
              </Pressable>
            )}
            keyExtractor={(item) => item.id}
          />
          {post.images.length > 1 && (
            <View className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded">
              <Text className="text-white text-xs">
                {imageIndex + 1}/{post.images.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
        <View className="flex-row items-center gap-6">
          <Pressable
            onPress={() => onLike(post.id)}
            className="flex-row items-center"
          >
            <Heart
              size={22}
              color={post.liked_by_user ? "#ef4444" : "#666"}
              fill={post.liked_by_user ? "#ef4444" : "none"}
            />
            {post.likes_count > 0 && (
              <Text className="ml-1.5 text-sm">{post.likes_count}</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => onComment(post.id)}
            className="flex-row items-center"
          >
            <MessageCircle size={22} color="#666" />
            {post.comments_count > 0 && (
              <Text className="ml-1.5 text-sm">{post.comments_count}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => onShare(post)}>
            <Share2 size={22} color="#666" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default function SocialFeedScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // First, get all accepted friends
      const { data: friendships, error: friendsError } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)

      if (friendsError) throw friendsError;

      // Extract friend IDs
      const friendIds = friendships?.reduce((acc: string[], friendship) => {
        if (friendship.user_id === profile.id) {
          acc.push(friendship.friend_id);
        } else {
          acc.push(friendship.user_id);
        }
        return acc;
      }, []) || [];

      // Include user's own posts
      friendIds.push(profile.id);

      // Fetch posts from friends and user
      const { data: postsData, error: postsError } = await supabase
        .from("posts_with_details")
        .select("*")
        .in("user_id", friendIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      // Check which posts the user has liked
      const postIds = postsData?.map(p => p.id) || [];
      const { data: userLikes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", profile.id)
        .in("post_id", postIds);

      const likedPostIds = new Set(userLikes?.map(l => l.post_id) || []);

      // Format posts with liked status
      const formattedPosts = postsData?.map(post => ({
        ...post,
        liked_by_user: likedPostIds.has(post.id),
      })) || [];

      setPosts(formattedPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  const handleLike = async (postId: string) => {
    if (!profile?.id) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      if (post.liked_by_user) {
        // Unlike
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", profile.id);

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, liked_by_user: false, likes_count: p.likes_count - 1 }
            : p
        ));
      } else {
        // Like
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: profile.id });

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleComment = (postId: string) => {
    router.push(`/social/post/${postId}`);
  };

  const handleShare = async (post: Post) => {
    // Implement share functionality
    Alert.alert("Share", "Share functionality coming soon!");
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <PageHeader
        title="Social Feed"
        actions={
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.push("/friends")}
              className="p-2"
            >
              <Users size={24} color="#666" />
            </Pressable>
            <Pressable
              onPress={() => router.push("/social/create-post")}
              className="p-2"
            >
              <Plus size={24} color="#666" />
            </Pressable>
          </View>
        }
        className="border-b border-border"
      />

      {/* Posts */}
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
          />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Camera size={48} color="#666" />
            <H3 className="mt-4">No posts yet</H3>
            <Muted className="mt-2 text-center px-8">
              Connect with friends and share your dining experiences
            </Muted>
            <Button
              onPress={() => router.push("/social/friends")}
              variant="default"
              className="mt-6"
            >
              <Text>Find Friends</Text>
            </Button>
          </View>
        }
      />
    </SafeAreaView>
  );
}