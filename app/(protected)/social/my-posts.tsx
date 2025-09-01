// app/(protected)/social/my-posts.tsx
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
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  MoreVertical,
  Heart,
  MessageCircle,
  Share2,
  Save,
  X,
  Camera,
  Users,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { getRefreshControlColor } from "@/lib/utils";

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

// Edit Post Modal Component
const EditPostModal = ({
  visible,
  post,
  onClose,
  onSave,
  loading,
}: {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onSave: (postId: string, content: string) => void;
  loading: boolean;
}) => {
  const [editContent, setEditContent] = useState(post?.content || "");

  useEffect(() => {
    setEditContent(post?.content || "");
  }, [post]);

  const handleSave = () => {
    if (post && editContent.trim()) {
      onSave(post.id, editContent.trim());
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} className="p-2">
            <X size={24} color="#666" />
          </Pressable>
          <H3>Edit Post</H3>
          <Button
            onPress={handleSave}
            disabled={loading || !editContent.trim()}
            variant="ghost"
            className="px-4"
          >
            {loading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-primary font-semibold">Save</Text>
            )}
          </Button>
        </View>

        <ScrollView className="flex-1 p-4">
          <TextInput
            value={editContent}
            onChangeText={setEditContent}
            placeholder="Share your dining experience..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={6}
            className="text-foreground text-base min-h-[150px] p-3 border border-border rounded-lg"
            style={{ textAlignVertical: "top" }}
          />

          {post && post.images.length > 0 && (
            <View className="mt-4">
              <Muted className="mb-2">Post Images (cannot be edited)</Muted>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {post.images.map((image) => (
                  <Image
                    key={image.id}
                    source={{ uri: image.image_url }}
                    className="w-24 h-24 rounded-lg mr-3"
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {post && post.tagged_friends.length > 0 && (
            <View className="mt-4">
              <Muted className="mb-2">Tagged Friends (cannot be edited)</Muted>
              <View className="flex-row flex-wrap">
                {post.tagged_friends.map((friend) => (
                  <View key={friend.id} className="flex-row items-center mr-4 mb-2">
                    <Image
                      source={{
                        uri: friend.avatar_url || require("@/assets/default-avatar.jpeg"),
                      }}
                      className="w-6 h-6 rounded-full mr-2"
                    />
                    <Text className="text-sm">{friend.full_name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// Post Management Actions Modal
const PostActionsModal = ({
  visible,
  post,
  onClose,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <View className="bg-background rounded-t-3xl p-6">
          <View className="w-12 h-1 bg-muted rounded-full self-center mb-6" />
          
          <Pressable
            onPress={onEdit}
            className="flex-row items-center py-4"
          >
            <View className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full items-center justify-center mr-3">
              <Edit3 size={20} color="#3b82f6" />
            </View>
            <Text className="text-lg">Edit Post</Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            className="flex-row items-center py-4"
          >
            <View className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full items-center justify-center mr-3">
              <Trash2 size={20} color="#ef4444" />
            </View>
            <Text className="text-lg text-red-600 dark:text-red-400">Delete Post</Text>
          </Pressable>

          <Button
            onPress={onClose}
            variant="ghost"
            className="mt-4"
          >
            <Text>Cancel</Text>
          </Button>
        </View>
      </Pressable>
    </Modal>
  );
};

// Post Card Component for My Posts
const MyPostCard = ({
  post,
  onEdit,
  onDelete,
}: {
  post: Post;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}) => {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);

  const handlePostPress = () => {
    router.push(`/(protected)/social/post/${post.id}`);
  };

  const handleActionsPress = () => {
    setShowActions(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View className="bg-card mb-2 border-b border-border">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
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
              {post.restaurant_name && (
                <>
                  <Muted className="text-xs mx-1">•</Muted>
                  <Text className="text-xs text-primary">
                    {post.restaurant_name}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
        
        <Pressable onPress={handleActionsPress} className="p-2">
          <MoreVertical size={20} color="#666" />
        </Pressable>
      </View>

      {/* Content */}
      <Pressable onPress={handlePostPress}>
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
                  <Text className="text-sm text-primary">
                    {friend.full_name}
                  </Text>
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
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.images.map((image) => (
                <Image
                  key={image.id}
                  source={{ uri: image.image_url }}
                  className="w-screen h-80"
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {post.images.length > 1 && (
              <View className="absolute bottom-3 right-3 bg-black/60 px-2 py-1 rounded">
                <Text className="text-white text-xs">
                  1/{post.images.length}
                </Text>
              </View>
            )}
          </View>
        )}
      </Pressable>

      {/* Stats */}
      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
        <View className="flex-row items-center gap-6">
          <View className="flex-row items-center">
            <Heart
              size={22}
              color={post.liked_by_user ? "#ef4444" : "#666"}
              fill={post.liked_by_user ? "#ef4444" : "none"}
            />
            {post.likes_count > 0 && (
              <Text className="ml-1.5 text-sm">{post.likes_count}</Text>
            )}
          </View>

          <View className="flex-row items-center">
            <MessageCircle size={22} color="#666" />
            {post.comments_count > 0 && (
              <Text className="ml-1.5 text-sm">{post.comments_count}</Text>
            )}
          </View>

          <Share2 size={22} color="#666" />
        </View>
      </View>

      {/* Actions Modal */}
      <PostActionsModal
        visible={showActions}
        post={post}
        onClose={() => setShowActions(false)}
        onEdit={() => {
          setShowActions(false);
          onEdit(post);
        }}
        onDelete={() => {
          setShowActions(false);
          onDelete(post);
        }}
      />
    </View>
  );
};

export default function MyPostsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const fetchMyPosts = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data: postsData, error } = await supabase
        .from("posts_with_details")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedPosts =
        postsData?.map((post) => ({ ...post, liked_by_user: false })) || [];
      setPosts(formattedPosts);
    } catch (error) {
      console.error("Error fetching my posts:", error);
      Alert.alert("Error", "Failed to load your posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
  };

  const handleSaveEdit = async (postId: string, content: string) => {
    setEditLoading(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ content })
        .eq("id", postId);

      if (error) throw error;

      // Update local state
      setPosts(
        posts.map((post) =>
          post.id === postId ? { ...post, content } : post
        )
      );

      setEditingPost(null);
      Alert.alert("Success", "Post updated successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error updating post:", error);
      Alert.alert("Error", "Failed to update post");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePost = (post: Post) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDeletePost(post.id),
        },
      ]
    );
  };

  const confirmDeletePost = async (postId: string) => {
    try {
      // Delete post images first
      const { error: imagesError } = await supabase
        .from("post_images")
        .delete()
        .eq("post_id", postId);

      if (imagesError) throw imagesError;

      // Delete post tags
      const { error: tagsError } = await supabase
        .from("post_tags")
        .delete()
        .eq("post_id", postId);

      if (tagsError) throw tagsError;

      // Delete post likes
      const { error: likesError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId);

      if (likesError) throw likesError;

      // Delete post comments
      const { error: commentsError } = await supabase
        .from("post_comments")
        .delete()
        .eq("post_id", postId);

      if (commentsError) throw commentsError;

      // Finally delete the post
      const { error: postError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (postError) throw postError;

      // Update local state
      setPosts(posts.filter((post) => post.id !== postId));
      
      Alert.alert("Success", "Post deleted successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", "Failed to delete post");
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMyPosts();
  };

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="mt-4">Loading your posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <ArrowLeft size={24} color="#666" />
        </Pressable>
        <H2 className="flex-1">My Posts</H2>
      </View>

      {/* Content */}
      {posts.length === 0 ? (
        <View className="flex-1 items-center justify-center py-20">
          <Camera size={48} color="#666" />
          <H3 className="mt-4">No Posts Yet</H3>
          <Muted className="mt-2 text-center px-8">
            Share your dining experiences to see them here.
          </Muted>
          <Button
            onPress={() => router.push("/(protected)/social/create-post")}
            variant="default"
            className="mt-6"
          >
            <Text>Create Your First Post</Text>
          </Button>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => (
            <MyPostCard
              post={item}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
            />
          )}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getRefreshControlColor(colorScheme)}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Post Modal */}
      <EditPostModal
        visible={editingPost !== null}
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSave={handleSaveEdit}
        loading={editLoading}
      />
    </SafeAreaView>
  );
}