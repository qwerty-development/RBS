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
import * as Linking from "expo-linking";
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
}

// Helper function to debug permissions on iOS
const debugPermissions = async () => {
  if (__DEV__ && Platform.OS === "ios") {
    try {
      const [cameraPerms, mediaPerms] = await Promise.all([
        ImagePicker.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);
    } catch (error) {
      console.error("❌ Error checking permissions:", error);
    }
  }
};

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

  // Initialize data loading
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);

      // Debug permissions in development
      await debugPermissions();

      // Fetch friends first
      await fetchFriends();

      // Fetch booking details if bookingId is provided
      if (bookingId) {
        await fetchBookingDetails();
      }

      setLoading(false);
    };

    initializeData();
  }, [bookingId, profile?.id]);

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (
            id,
            name,
            main_image_url,
            address
          )
        `,
        )
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      setBookingDetails(data);
    } catch (error) {
      console.error("Error fetching booking:", error);
    }
  };

  const fetchFriends = async () => {
    if (!profile?.id) return;

    try {
      // Get accepted friendships with a simpler query
      const { data: friendships, error } = await supabase
        .from("friends")
        .select(
          `
          user_id,
          friend_id
        `,
        )
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

      if (error) throw error;

      // Get friend IDs
      const friendIds =
        friendships?.map((friendship) => {
          return friendship.user_id === profile.id
            ? friendship.friend_id
            : friendship.user_id;
        }) || [];

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Get friend profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", friendIds);

      if (profilesError) throw profilesError;

      setFriends(profiles || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };

  const pickImage = async () => {
    try {
      // Prevent multiple simultaneous calls
      if (uploadingImages) {
        return;
      }

      // iOS-specific permission handling
      if (Platform.OS === "ios") {
        // Check if permissions are granted
        const { status: currentStatus, canAskAgain } =
          await ImagePicker.getMediaLibraryPermissionsAsync();

        let finalStatus = currentStatus;

        // Only request permission if we can ask again and it's not already granted
        if (currentStatus !== "granted" && canAskAgain) {
          const { status: requestStatus } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          finalStatus = requestStatus;
        }

        if (finalStatus !== "granted") {
          const title = canAskAgain
            ? "Permission Required"
            : "Permission Denied";
          const message = canAskAgain
            ? "Please allow access to your photo library to share photos."
            : "Photo library access was denied. Please enable it in Settings to share photos.";

          Alert.alert(title, message, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                try {
                  Linking.openURL("app-settings:");
                } catch (linkError) {
                  console.error("Error opening settings:", linkError);
                }
              },
            },
          ]);
          return;
        }
      } else {
        // Android permission handling (simpler)
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow access to your photo library to share photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: Platform.OS === "android",
        quality: Platform.OS === "ios" ? 0.7 : 0.8, // Higher quality on iOS to avoid compression issues
        base64: false,
        allowsEditing: Platform.OS === "ios", // Only allow editing on iOS where it's more stable
        aspect: Platform.OS === "ios" ? [1, 1] : undefined,
        exif: false, // Don't include EXIF data to reduce payload
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const assetsToProcess =
          Platform.OS === "ios" ? [result.assets[0]] : result.assets;

        const newImages: SelectedImage[] = assetsToProcess
          .filter((asset) => asset && asset.uri) // Double check for valid assets
          .map((asset) => ({
            uri: asset.uri,
          }));

        if (newImages.length > 0) {
          const totalImages = [...selectedImages, ...newImages];
          const maxImages = Platform.OS === "ios" ? 3 : 5;
          setSelectedImages(totalImages.slice(0, maxImages));

          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to access photo library: ${errorMessage}`);
    }
  };

  const takePhoto = async () => {
    try {
      // Prevent multiple simultaneous calls
      if (uploadingImages) {
        return;
      }

      // iOS-specific permission handling
      if (Platform.OS === "ios") {
        const { status: currentStatus, canAskAgain } =
          await ImagePicker.getCameraPermissionsAsync();

        let finalStatus = currentStatus;

        // Only request permission if we can ask again and it's not already granted
        if (currentStatus !== "granted" && canAskAgain) {
          const { status: requestStatus } =
            await ImagePicker.requestCameraPermissionsAsync();
          finalStatus = requestStatus;
        }

        if (finalStatus !== "granted") {
          const title = canAskAgain
            ? "Permission Required"
            : "Permission Denied";
          const message = canAskAgain
            ? "Please allow access to your camera to take photos."
            : "Camera access was denied. Please enable it in Settings to take photos.";

          Alert.alert(title, message, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                try {
                  Linking.openURL("app-settings:");
                } catch (linkError) {
                  console.error("Error opening settings:", linkError);
                }
              },
            },
          ]);
          return;
        }
      } else {
        // Android permission handling
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow access to your camera to take photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: Platform.OS === "ios" ? 0.7 : 0.8, // Better quality on iOS
        base64: false,
        allowsEditing: Platform.OS === "ios", // More stable on iOS
        aspect: Platform.OS === "ios" ? [1, 1] : undefined,
        exif: false, // Reduce payload size
      });

      if (
        !result.canceled &&
        result.assets &&
        result.assets[0] &&
        result.assets[0].uri
      ) {
        const newImage: SelectedImage = {
          uri: result.assets[0].uri,
        };

        const maxImages = Platform.OS === "ios" ? 3 : 5;
        setSelectedImages([...selectedImages, newImage].slice(0, maxImages));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to access camera: ${errorMessage}`);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const toggleFriend = (friendId: string) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of selectedImages) {
      try {
        const fileName = `post-${Date.now()}-${Math.random().toString(36)}.jpg`;
        const filePath = `posts/${profile?.id}/${fileName}`;

        // Create FormData for file upload
        const formData = new FormData();
        formData.append("file", {
          uri: image.uri,
          type: "image/jpeg",
          name: fileName,
        } as any);

        const { data, error } = await supabase.storage
          .from("images")
          .upload(filePath, formData, {
            contentType: "image/jpeg",
          });

        if (error) {
          console.error("Upload error:", error);
          throw error;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("images").getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (uploadError) {
        console.error("Error uploading individual image:", uploadError);
        // Continue with other images instead of failing completely
      }
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
        const tags = selectedFriends.map((friendId) => ({
          post_id: post.id,
          tagged_user_id: friendId,
        }));

        const { error: tagsError } = await supabase
          .from("post_tags")
          .insert(tags);

        if (tagsError) throw tagsError;
      }

      Alert.alert("Success", "Your post has been shared!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post");
    } finally {
      setPosting(false);
      setUploadingImages(false);
    }
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
            disabled={
              posting || (!content.trim() && selectedImages.length === 0)
            }
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
                    {format(
                      new Date(bookingDetails.booking_time),
                      "MMM d, h:mm a",
                    )}
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
              {friends.map((friend) => (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleFriend(friend.id)}
                  className="flex-row items-center py-2"
                >
                  <Image
                    source={{
                      uri:
                        friend.avatar_url || "https://via.placeholder.com/40",
                    }}
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
