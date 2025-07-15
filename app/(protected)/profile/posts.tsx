// app/(protected)/profile/posts.tsx
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
  ArrowLeft,
  Heart,
  MessageCircle,
  MoreVertical,
  Trash2,
  Edit,
  Camera,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import PostsScreenSkeleton from "@/components/skeletons/PostsScreenSkeleton";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { OptimizedList } from "@/components/ui/optimized-list";

interface UserPost {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  content: string;
  images: {
    id: string;
    image_url: string;
    image_order: number;
  }[];
  tagged_friends: {
    id: string;
    full_name: string;
  }[];
  likes_count: number;
  comments_count: number;
  created_at: string;
}

const PostCard: React.FC<{
  post: UserPost;
  onDelete: (postId: string) => void;
  onPress: (postId: string) => void;
}> = ({ post, onDelete, onPress }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = () => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => onDelete(post.id),
      },
    ]);
  };

  return (
    <Pressable
      onPress={() => onPress(post.id)}
      className="bg-card mb-3 rounded-xl overflow-hidden border border-border"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between p-3">
        <View className="flex-row items-center flex-1">
          <Image
            source={{ uri: post.restaurant_image }}
            className="w-10 h-10 rounded-lg mr-3"
          />
          <View className="flex-1">
            <Text className="font-semibold">{post.restaurant_name}</Text>
            <Muted className="text-xs">
              {format(new Date(post.created_at), "MMM d, yyyy")}
            </Muted>
          </View>
        </View>
        <Pressable onPress={() => setShowMenu(!showMenu)} className="p-2">
          <MoreVertical size={20} color="#666" />
        </Pressable>
      </View>

      {/* Menu Options */}
      {showMenu && (
        <View className="absolute top-14 right-2 bg-card border border-border rounded-lg shadow-lg z-10">
          <Pressable
            onPress={handleDelete}
            className="flex-row items-center px-4 py-3"
          >
            <Trash2 size={16} color="#ef4444" />
            <Text className="ml-2 text-red-500">Delete Post</Text>
          </Pressable>
        </View>
      )}

      {/* Main Image */}
      {post.images.length > 0 && (
        <Image
          source={{ uri: post.images[0].image_url }}
          className="w-full h-48"
          contentFit="cover"
        />
      )}

      {/* Content Preview */}
      {post.content && (
        <View className="px-3 py-2">
          <P className="text-sm" numberOfLines={2}>
            {post.content}
          </P>
        </View>
      )}

      {/* Stats */}
      <View className="flex-row items-center justify-between px-3 py-2 border-t border-border">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center">
            <Heart size={18} color="#666" />
            <Text className="ml-1 text-sm">{post.likes_count}</Text>
          </View>
          <View className="flex-row items-center">
            <MessageCircle size={18} color="#666" />
            <Text className="ml-1 text-sm">{post.comments_count}</Text>
          </View>
        </View>
        {post.images.length > 1 && (
          <Text className="text-xs text-muted-foreground">
            +{post.images.length - 1} more
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default function UserPostsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("posts_with_details")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
      Alert.alert("Error", "Failed to load posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  const handleDeletePost = async (postId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Delete post (cascade will handle related records)
      const { error } = await supabase.from("posts").delete().eq("id", postId);

      if (error) throw error;

      // Update local state
      setPosts(posts.filter((p) => p.id !== postId));
      Alert.alert("Success", "Post deleted successfully");
    } catch (error) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", "Failed to delete post");
    }
  };

  const handlePostPress = (postId: string) => {
    router.push(`/social/post/${postId}`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return <PostsScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="#666" />
        </Pressable>
        <H2 className="flex-1 text-center">My Posts</H2>
        <View className="w-10" />
      </View>

      {/* Posts Grid */}
      <OptimizedList
        data={posts}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onDelete={handleDeletePost}
            onPress={handlePostPress}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Camera size={48} color="#666" />
            <H3 className="mt-4">No posts yet</H3>
            <Muted className="mt-2 text-center px-8">
              Share your dining experiences with friends
            </Muted>
            <Button
              onPress={() => router.push("/social/create-post")}
              variant="default"
              className="mt-6"
            >
              <Text>Create Your First Post</Text>
            </Button>
          </View>
        }
      />
    </SafeAreaView>
  );
}
