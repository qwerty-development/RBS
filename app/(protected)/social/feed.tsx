// app/(protected)/social/feed.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
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
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { useAuth } from "@/context/supabase-provider";
import { SafeAreaView } from "@/components/safe-area-view";
import SocialFeedScreenSkeleton from "@/components/skeletons/SocialFeedScreenSkeleton";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { getRefreshControlColor } from "@/lib/utils";

// --- New Guest Prompt Modal ---
const GuestPromptModal = ({
  visible,
  onClose,
  onConfirm,
  feature,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  feature: string;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-center items-center bg-black/60">
        <View className="bg-background w-4/5 rounded-2xl p-6 items-center">
          <H3 className="mb-2 text-center">Join the Conversation</H3>
          <P className="text-muted-foreground text-center mb-6">
            Please sign up or log in to {feature}.
          </P>
          <Button onPress={onConfirm} className="w-full mb-3" size="lg">
            <Text className="font-bold text-white">Continue</Text>
          </Button>
          <Button onPress={onClose} variant="ghost" className="w-full">
            <Text>Not Now</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
};

// Types (Unchanged)
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
  images: {
    id: string;
    image_url: string;
    image_order: number;
  }[];
  tagged_friends: {
    id: string;
    full_name: string;
    avatar_url: string;
  }[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_user?: boolean;
}

// Post Component -- MODIFIED to accept isGuest prop
const PostCard: React.FC<{
  post: Post;
  isGuest: boolean;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (post: Post) => void;
}> = ({ post, isGuest, onLike, onComment, onShare }) => {
  const router = useRouter();
  const [imageIndex, setImageIndex] = useState(0);

  return (
    <View className="bg-card mb-2 border-b border-border">
      {/* Header */}
      <Pressable
        // Guests cannot navigate to user profiles
        onPress={() =>
          !isGuest && router.push(`/social/profile/${post.user_id}`)
        }
        className="flex-row items-center p-4"
        disabled={isGuest}
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
                  onPress={() =>
                    router.push(`/(protected)/restaurant/${post.restaurant_id}`)
                  }
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

      {/* Content, Images, etc. (Unchanged) */}
      {post.content && (
        <View className="px-4 pb-3">
          <P>{post.content}</P>
        </View>
      )}

      {post.tagged_friends.length > 0 && (
        <View className="px-4 pb-3">
          <View className="flex-row items-center flex-wrap">
            <Users size={16} color="#666" />
            <Muted className="text-sm ml-2">with </Muted>
            {post.tagged_friends.map((friend, index) => (
              <React.Fragment key={friend.id}>
                <Pressable
                  onPress={() =>
                    !isGuest && router.push(`/social/profile/${friend.id}`)
                  }
                  disabled={isGuest}
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

      {post.images.length > 0 && (
        <View className="mb-3">
          <FlatList
            data={post.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x /
                  e.nativeEvent.layoutMeasurement.width,
              );
              setImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push(`/(protected)/restaurant/${post.restaurant_id}`)
                }
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
  const { colorScheme } = useColorScheme();
  const { profile, isGuest, convertGuestToUser } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [promptedFeature, setPromptedFeature] = useState("");

  // --- NEW: Guest Guard Logic ---
  const runProtectedAction = (callback: () => void, featureName: string) => {
    if (isGuest) {
      setPromptedFeature(featureName);
      setShowGuestPrompt(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (profile) {
      callback();
    }
  };

  const handleConfirmGuestPrompt = async () => {
    setShowGuestPrompt(false);
    await convertGuestToUser();
  };

  // --- MODIFIED: fetchPosts now handles both guests and authenticated users ---
  const fetchPosts = useCallback(async () => {
    try {
      if (isGuest) {
        // --- Guest Path: Fetch latest public posts ---
        const { data: postsData, error: postsError } = await supabase
          .from("posts_with_details") // Ensure this view is publicly readable
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (postsError) throw postsError;
        // For guests, `liked_by_user` is always false
        const formattedPosts =
          postsData?.map((post) => ({ ...post, liked_by_user: false })) || [];
        setPosts(formattedPosts);
      } else if (profile?.id) {
        // --- Authenticated Path: Fetch posts from user and friends ---
        const { data: friendships, error: friendsError } = await supabase
          .from("friends")
          .select("user_id, friend_id")
          .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

        if (friendsError) throw friendsError;

        const friendIds =
          friendships?.reduce((acc: string[], friendship) => {
            if (friendship.user_id === profile.id)
              acc.push(friendship.friend_id);
            else acc.push(friendship.user_id);
            return acc;
          }, []) || [];
        friendIds.push(profile.id);

        const { data: postsData, error: postsError } = await supabase
          .from("posts_with_details")
          .select("*")
          .in("user_id", friendIds)
          .order("created_at", { ascending: false })
          .limit(50);

        if (postsError) throw postsError;

        const postIds = postsData?.map((p) => p.id) || [];
        const { data: userLikes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", profile.id)
          .in("post_id", postIds);

        const likedPostIds = new Set(userLikes?.map((l) => l.post_id) || []);
        const formattedPosts =
          postsData?.map((post) => ({
            ...post,
            liked_by_user: likedPostIds.has(post.id),
          })) || [];
        setPosts(formattedPosts);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, isGuest]);

  // --- MODIFIED: Guarded Actions ---
  const handleLike = (postId: string) => {
    runProtectedAction(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const post = posts.find((p) => p.id === postId);
      if (!post) return;
      try {
        if (post.liked_by_user) {
          await supabase
            .from("post_likes")
            .delete()
            .match({ post_id: postId, user_id: profile!.id });
          setPosts(
            posts.map((p) =>
              p.id === postId
                ? { ...p, liked_by_user: false, likes_count: p.likes_count - 1 }
                : p,
            ),
          );
        } else {
          await supabase
            .from("post_likes")
            .insert({ post_id: postId, user_id: profile!.id });
          setPosts(
            posts.map((p) =>
              p.id === postId
                ? { ...p, liked_by_user: true, likes_count: p.likes_count + 1 }
                : p,
            ),
          );
        }
      } catch (error) {
        console.error("Error toggling like:", error);
      }
    }, "like posts");
  };

  const handleComment = (postId: string) => {
    runProtectedAction(() => {
      router.push(`/(protected)/social/post/${postId}`);
    }, "comment on posts");
  };

  const handleFindFriends = () => {
    runProtectedAction(() => {
      router.push("/(protected)/friends");
    }, "find friends");
  };

  const handleCreatePost = () => {
    runProtectedAction(() => {
      router.push("/social/create-post");
    }, "create posts");
  };

  const handleShare = (post: Post) => {
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
    return <SocialFeedScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header -- MODIFIED with guarded actions */}
      <PageHeader
        title="Social Feed"
        actions={
          <View className="flex-row items-center gap-3">
            <Pressable onPress={handleFindFriends} className="p-2">
              <Users size={24} color="#666" />
            </Pressable>
            <Pressable onPress={handleCreatePost} className="p-2">
              <Plus size={24} color="#666" />
            </Pressable>
          </View>
        }
        className="border-b border-border"
      />

      {/* Content with ScrollView for pull-to-refresh */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {posts.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Camera size={48} color="#666" />
            <H3 className="mt-4">
              {isGuest ? "Welcome to the Feed!" : "No Posts Yet"}
            </H3>
            <Muted className="mt-2 text-center px-8">
              {isGuest
                ? "Sign up to connect with friends and share your experiences."
                : "Connect with friends to see their posts here."}
            </Muted>
            <Button
              onPress={handleFindFriends}
              variant="default"
              className="mt-6"
            >
              <Text>
                {isGuest ? "Sign Up to Find Friends" : "Find Friends"}
              </Text>
            </Button>
          </View>
        ) : (
          <View className="pb-20">
            {posts.map((item) => (
              <PostCard
                key={item.id}
                post={item}
                isGuest={isGuest}
                onLike={handleLike}
                onComment={handleComment}
                onShare={handleShare}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODIFIED: Add GuestPromptModal to the layout */}
      <GuestPromptModal
        visible={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onConfirm={handleConfirmGuestPrompt}
        feature={promptedFeature}
      />
    </SafeAreaView>
  );
}
