// app/(protected)/social/create-post.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  X,
  Camera,
  Image as ImageIcon,
  Users,
  MapPin,
  Send,
  Plus,
  Check,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
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
import { CreatePostSkeleton } from "@/components/skeletons/CreatePostSkeleton";

interface Friend {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface SelectedImage {
  uri: string;
  base64?: string;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  const bookingId = params.bookingId as string;
  const restaurantId = params.restaurantId as string;

  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch booking details if bookingId is provided
  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  // Fetch friends list
  useEffect(() => {
    fetchFriends();
  }, [profile?.id]);

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          restaurant:restaurants (
            id,
            name,
            main_image_url,
            address
          )
        `)
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      setBookingDetails(data);
    } catch (error) {
      console.error("Error fetching booking:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    if (!profile?.id) return;

    try {
      // Get accepted friendships
      const { data: friendships, error } = await supabase
        .from("friends")
        .select(`
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
        `)
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)

      if (error) throw error;

      // Format friends list
      const friendsList = friendships?.map(friendship => {
        if (friendship.user_id === profile.id) {
          return friendship.friend;
        } else {
          return friendship.user;
        }
      }) || [];

      setFriends(friendsList);
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => ({
        uri: asset.uri,
        base64: asset.base64,
      }));
      setSelectedImages([...selectedImages, ...newImages].slice(0, 5)); // Max 5 images
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your camera");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setSelectedImages([...selectedImages, {
        uri: result.assets[0].uri,
        base64: result.assets[0].base64,
      }].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const image of selectedImages) {
      const fileName = `post-${Date.now()}-${Math.random()}.jpg`;
      const filePath = `posts/${profile?.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from("images")
        .upload(filePath, 
          decode(image.base64!), // You'll need to implement base64 decode
          {
            contentType: "image/jpeg",
          }
        );

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handlePost = async () => {
    if (!profile?.id || (!content.trim() && selectedImages.length === 0)) {
      Alert.alert("Error", "Please add some content or images");
      return;
    }

    setPosting(true);

    try {
      // Upload images first
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        setUploadingImages(true);
        imageUrls = await uploadImages();
        setUploadingImages(false);
      }

      // Create post
      const { data: post, error: postError } = await supabase
        .from("posts")
        .insert({
          user_id: profile.id,
          booking_id: bookingId || null,
          restaurant_id: restaurantId || bookingDetails?.restaurant?.id || null,
          content: content.trim(),
          visibility: "friends",
        })
        .select()
        .single();

      if (postError) throw postError;

      // Add images to post
      if (imageUrls.length > 0) {
        const imageRecords = imageUrls.map((url, index) => ({
          post_id: post.id,
          image_url: url,
          image_order: index,
        }));

        const { error: imagesError } = await supabase
          .from("post_images")
          .insert(imageRecords);

        if (imagesError) throw imagesError;
      }

      // Tag friends
      if (selectedFriends.length > 0) {
        const tags = selectedFriends.map(friendId => ({
          post_id: post.id,
          tagged_user_id: friendId,
        }));

        const { error: tagsError } = await supabase
          .from("post_tags")
          .insert(tags);

        if (tagsError) throw tagsError;
      }

      Alert.alert("Success", "Your post has been shared!", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post");
    } finally {
      setPosting(false);
      setUploadingImages(false);
    }
  };

  // Helper function to decode base64 (simplified version)
  const decode = (base64: string): Blob => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: "image/jpeg" });
  };

  if (loading) {
    return <CreatePostSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2">
            <X size={24} color="#666" />
          </Pressable>
          <H3>Create Post</H3>
          <Button
            onPress={handlePost}
            disabled={posting || (!content.trim() && selectedImages.length === 0)}
            variant="ghost"
            className="px-4"
          >
            {posting ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-primary font-semibold">Post</Text>
            )}
          </Button>
        </View>

        <ScrollView className="flex-1">
          {/* Booking/Restaurant Info */}
          {bookingDetails && (
            <View className="p-4 border-b border-border">
              <View className="flex-row items-center">
                <Image
                  source={{ uri: bookingDetails.restaurant.main_image_url }}
                  className="w-12 h-12 rounded-lg mr-3"
                />
                <View className="flex-1">
                  <Text className="font-semibold">
                    {bookingDetails.restaurant.name}
                  </Text>
                  <Muted className="text-sm">
                    {format(new Date(bookingDetails.booking_time), "MMM d, h:mm a")}
                  </Muted>
                </View>
              </View>
            </View>
          )}

          {/* Content Input */}
          <View className="p-4">
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Share your dining experience..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              className="text-foreground text-base min-h-[100px]"
              style={{ textAlignVertical: "top" }}
            />
          </View>

          {/* Selected Images */}
          {selectedImages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-4 mb-4"
            >
              {selectedImages.map((image, index) => (
                <View key={index} className="mr-3">
                  <Image
                    source={{ uri: image.uri }}
                    className="w-24 h-24 rounded-lg"
                  />
                  <Pressable
                    onPress={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                  >
                    <X size={16} color="white" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          <View className="flex-row items-center gap-4 px-4 py-3 border-t border-border">
            <Pressable
              onPress={takePhoto}
              className="flex-row items-center gap-2"
            >
              <Camera size={24} color="#666" />
              <Text>Camera</Text>
            </Pressable>

            <Pressable
              onPress={pickImage}
              className="flex-row items-center gap-2"
            >
              <ImageIcon size={24} color="#666" />
              <Text>Gallery</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowFriendPicker(!showFriendPicker)}
              className="flex-row items-center gap-2"
            >
              <Users size={24} color="#666" />
              <Text>Tag Friends</Text>
              {selectedFriends.length > 0 && (
                <View className="bg-primary rounded-full px-2 py-0.5">
                  <Text className="text-white text-xs">
                    {selectedFriends.length}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Friend Picker */}
          {showFriendPicker && (
            <View className="px-4 py-3 border-t border-border">
              <H3 className="mb-3">Tag Friends</H3>
              {friends.map(friend => (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleFriend(friend.id)}
                  className="flex-row items-center py-2"
                >
                  <Image
                    source={{ uri: friend.avatar_url || "https://via.placeholder.com/40" }}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                  <Text className="flex-1">{friend.full_name}</Text>
                  {selectedFriends.includes(friend.id) && (
                    <Check size={20} color="#10b981" />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {/* Upload Progress */}
          {uploadingImages && (
            <View className="px-4 py-3">
              <View className="flex-row items-center">
                <ActivityIndicator size="small" className="mr-2" />
                <Text>Uploading images...</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}