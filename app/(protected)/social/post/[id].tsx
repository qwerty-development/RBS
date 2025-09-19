// app/(protected)/social/post/[id].tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Send,
  MoreVertical,
  MapPin,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { useShare } from "@/hooks/useShare";
import { ShareModal } from "@/components/ui/share-modal";

const SCREEN_WIDTH = Dimensions.get("window").width;

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string;
  };
}

interface PostDetail {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  restaurant_image: string | null;
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

export default function PostDetailScreen() {
  const router = useRouter();
  const { id: postId } = useLocalSearchParams();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  const { shareSocialPost } = useShare();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);

  // Heart animation for double-tap on images
  const likeScale = useSharedValue(0);
  const likeOpacity = useSharedValue(0);

  const scrollViewRef = useRef<ScrollView>(null);

  const animateHeart = () => {
    likeOpacity.value = 1;
    likeScale.value = 0;
    likeScale.value = withSequence(
      withTiming(1.2, { duration: 160 }),
      withTiming(1, { duration: 120 }),
    );
    likeOpacity.value = withDelay(400, withTiming(0, { duration: 300 }));
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
    opacity: likeOpacity.value,
  }));

  const handleDoubleTapLike = () => {
    animateHeart();
    if (!post?.liked_by_user) {
      handleLike();
    }
  };

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(handleDoubleTapLike)();
    });

  const fetchPostDetails = useCallback(async () => {
    if (!postId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch post details (this doesn't require authentication)
      const { data: postData, error: postError } = await supabase
        .from("posts_with_details")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) {
        console.error("❌ Error fetching post:", postError);
        throw postError;
      }

      // Check if user has liked the post (only if user is authenticated)
      let likeData = null;
      if (profile?.id) {
        const { data } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", postId)
          .eq("user_id", profile.id)
          .single();
        likeData = data;
      }

      setPost({
        ...postData,
        liked_by_user: !!likeData,
      });

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("post_comments")
        .select(
          `
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `,
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (commentsError) {
        console.error("❌ Error fetching comments:", commentsError);
        throw commentsError;
      }

      setComments(commentsData || []);
    } catch (error) {
      console.error("❌ Error fetching post details:", error);
      Alert.alert("Error", "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [postId, profile?.id]);

  const handleLike = async () => {
    if (!profile?.id || !post) {
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (post.liked_by_user) {
        // Unlike
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", profile.id);

        setPost({
          ...post,
          liked_by_user: false,
          likes_count: post.likes_count - 1,
        });
      } else {
        // Like
        await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: profile.id });

        setPost({
          ...post,
          liked_by_user: true,
          likes_count: post.likes_count + 1,
        });
      }
    } catch (error) {
      console.error("❌ Error toggling like:", error);
      Alert.alert("Error", "Failed to update like. Please try again.");
    }
  };

  const handleShare = async () => {
    // Add haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareModal(true);
  };

  const handleComment = async () => {
    if (!profile?.id) {
      Alert.alert("Error", "Please sign in to comment");
      return;
    }

    if (!newComment.trim()) {
      return;
    }

    setPosting(true);
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: profile.id,
          comment: newComment.trim(),
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

      if (error) {
        console.error("❌ Error posting comment:", error);
        throw error;
      }

      setComments([...comments, data]);
      setNewComment("");

      // Update comment count
      if (post) {
        setPost({
          ...post,
          comments_count: post.comments_count + 1,
        });
      }

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("❌ Error posting comment:", error);
      Alert.alert("Error", "Failed to post comment. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // Navigate to restaurant with proper null validation
  const handleRestaurantPress = useCallback(() => {
    if (!post?.restaurant_id) {
      console.warn("Restaurant ID is null or undefined, cannot navigate");
      return;
    }

    router.push(`/(protected)/restaurant/${post.restaurant_id}`);
  }, [post?.restaurant_id, router]);

  // Monitor authentication state changes
  useEffect(() => {}, [profile, postId, loading]);

  // Timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    fetchPostDetails();
  }, [fetchPostDetails]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Text>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2">
            <ArrowLeft size={24} color="#666" />
          </Pressable>
          <H3 className="flex-1 text-center">Post</H3>
          <Pressable className="p-2">
            <MoreVertical size={20} color="#666" />
          </Pressable>
        </View>

        <ScrollView ref={scrollViewRef} className="flex-1">
          {/* Post Header */}
          <Pressable
            onPress={() => router.push(`/(protected)/profile`)}
            className="flex-row items-center p-4"
          >
            <Image
              source={
                post.user_avatar
                  ? { uri: post.user_avatar }
                  : require("@/assets/default-avatar.jpeg")
              }
              className="w-10 h-10 rounded-full mr-3"
            />
            <View className="flex-1">
              <Text className="font-semibold">{post.user_name}</Text>
              <View className="flex-row items-center mt-0.5">
                <Muted className="text-xs">
                  {format(new Date(post.created_at), "MMM d, h:mm a")}
                </Muted>
                {/* Only show restaurant link if restaurant_id and restaurant_name exist */}
                {post.restaurant_id && post.restaurant_name && (
                  <>
                    <Muted className="text-xs mx-1">•</Muted>
                    <Pressable onPress={handleRestaurantPress}>
                      <Muted className="text-xs text-primary">
                        {post.restaurant_name}
                      </Muted>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
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
                      onPress={() => router.push("/(protected)/profile")}
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
            <View className="mb-3 relative">
              {/* Animated heart overlay */}
              <Animated.View
                pointerEvents="none"
                className="absolute inset-0 items-center justify-center z-10"
                style={heartStyle}
              >
                <Heart size={96} color="#ef4444" fill="#ef4444" />
              </Animated.View>

              <GestureDetector gesture={doubleTapGesture}>
                <View>
                  <FlatList
                    data={post.images}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    getItemLayout={(_, index) => ({
                      length: SCREEN_WIDTH,
                      offset: SCREEN_WIDTH * index,
                      index,
                    })}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(
                        e.nativeEvent.contentOffset.x /
                          e.nativeEvent.layoutMeasurement.width,
                      );
                      setImageIndex(index);
                    }}
                    renderItem={({ item }) => (
                      <Image
                        source={{ uri: item.image_url }}
                        className="w-screen h-80"
                        contentFit="cover"
                      />
                    )}
                    keyExtractor={(item) => item.id}
                  />
                </View>
              </GestureDetector>

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
          <View className="flex-row items-center gap-6 px-4 py-3 border-y border-border">
            <Pressable onPress={handleLike} className="flex-row items-center">
              <Heart
                size={22}
                color={post.liked_by_user ? "#ef4444" : "#666"}
                fill={post.liked_by_user ? "#ef4444" : "none"}
              />
              <Text className="ml-1.5">{post.likes_count} likes</Text>
            </Pressable>

            <View className="flex-row items-center">
              <MessageCircle size={22} color="#666" />
              <Text className="ml-1.5">{post.comments_count} comments</Text>
            </View>

            <Pressable onPress={handleShare} className="flex-row items-center">
              <Share2 size={22} color="#666" />
            </Pressable>
          </View>

          {/* Comments */}
          <View className="px-4 py-3">
            <H3 className="mb-4">Comments</H3>
            {comments.length === 0 ? (
              <View className="py-8 items-center">
                <MessageCircle size={48} color="#ccc" />
                <Muted className="mt-2">No comments yet</Muted>
                <Muted className="text-xs mt-1">Be the first to comment!</Muted>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} className="flex-row mb-4">
                  <Pressable
                    onPress={() => router.push("/(protected)/profile")}
                  >
                    <Image
                      source={
                        comment.user.avatar_url
                          ? { uri: comment.user.avatar_url }
                          : require("@/assets/default-avatar.jpeg")
                      }
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  </Pressable>
                  <View className="flex-1">
                    <View className="bg-muted rounded-2xl px-4 py-3">
                      <Text className="font-semibold mb-1 text-sm">
                        {comment.user.full_name}
                      </Text>
                      <Text className="text-sm leading-5">
                        {comment.comment}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-2 px-2">
                      <Muted className="text-xs">
                        {format(new Date(comment.created_at), "MMM d, h:mm a")}
                      </Muted>
                      <Pressable className="ml-4">
                        <Muted className="text-xs font-medium">Reply</Muted>
                      </Pressable>
                      <Pressable className="ml-4">
                        <Muted className="text-xs font-medium">Like</Muted>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View className="border-t border-border p-4">
          <View className="flex-row items-center">
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              className="flex-1 bg-muted rounded-full px-4 py-2 mr-2 text-foreground"
            />
            <Pressable
              onPress={handleComment}
              disabled={!newComment.trim() || posting}
              className={`p-2 rounded-full ${
                newComment.trim() ? "bg-primary" : "bg-muted"
              }`}
            >
              {posting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Send size={20} color={newComment.trim() ? "white" : "#666"} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Share Modal */}
      {post && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Share Post"
          description="Share this post with your friends"
          shareOptions={{
            url: `https://plate-app.com/social/post/${post.id}`,
            title: "Social Post",
            message: post.content
              ? `Check out this post on Plate: "${post.content.substring(0, 100)}${post.content.length > 100 ? "..." : ""}"`
              : "Check out this post on Plate!",
            subject: "Social Post - Plate",
          }}
        />
      )}
    </SafeAreaView>
  );
}
