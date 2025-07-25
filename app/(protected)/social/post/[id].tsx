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

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

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

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);

  const fetchPostDetails = useCallback(async () => {
    if (!postId || !profile?.id) return;

    try {
      // Fetch post details
      const { data: postData, error: postError } = await supabase
        .from("posts_with_details")
        .select("*")
        .eq("id", postId)
        .single();

      if (postError) throw postError;

      // Check if user has liked the post
      const { data: likeData } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", profile.id)
        .single();

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

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (error) {
      console.error("Error fetching post details:", error);
      Alert.alert("Error", "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [postId, profile?.id]);

  const handleLike = async () => {
    if (!profile?.id || !post) return;

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
      console.error("Error toggling like:", error);
    }
  };

  const handleComment = async () => {
    if (!profile?.id || !newComment.trim()) return;

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

      if (error) throw error;

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
      console.error("Error posting comment:", error);
      Alert.alert("Error", "Failed to post comment");
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

    router.push(`/restaurant/${post.restaurant_id}`);
  }, [post?.restaurant_id, router]);

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
            onPress={() => router.push(`/profile/${post.user_id}`)}
            className="flex-row items-center p-4"
          >
            <Image
              source={{
                uri: post.user_avatar || "https://via.placeholder.com/50",
              }}
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
          </View>

          {/* Comments */}
          <View className="px-4 py-3">
            <H3 className="mb-4">Comments</H3>
            {comments.map((comment) => (
              <View key={comment.id} className="flex-row mb-4">
                <Pressable
                  onPress={() => router.push(`/profile/${comment.user_id}`)}
                >
                  <Image
                    source={{
                      uri:
                        comment.user.avatar_url ||
                        "https://via.placeholder.com/40",
                    }}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                </Pressable>
                <View className="flex-1">
                  <View className="bg-muted rounded-lg p-3">
                    <Text className="font-semibold mb-1">
                      {comment.user.full_name}
                    </Text>
                    <Text>{comment.comment}</Text>
                  </View>
                  <Muted className="text-xs mt-1">
                    {format(new Date(comment.created_at), "MMM d, h:mm a")}
                  </Muted>
                </View>
              </View>
            ))}
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
    </SafeAreaView>
  );
}
