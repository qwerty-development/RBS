// app/(protected)/profile/edit.tsx
import React, { useState, useCallback } from "react";
import {
  ScrollView,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Camera,
  User,
  Phone,
  Mail,
  ChevronLeft,
  Save,
  AlertCircle,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, P, Muted } from "@/components/ui/typography";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// 1. Lebanese Phone Number Validation
const lebanesPhoneRegex = /^(\+961|961|03|70|71|76|78|79|80|81)\d{6,7}$/;

// 2. Form Schema
const profileEditSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid name"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase(),
  phone_number: z
    .string()
    .regex(lebanesPhoneRegex, "Please enter a valid Lebanese phone number")
    .transform((val) => {
      if (val.startsWith("03") || val.startsWith("7") || val.startsWith("8")) {
        return `+961${val.replace(/^0/, "")}`;
      }
      if (val.startsWith("961")) {
        return `+${val}`;
      }
      return val;
    }),
});

type ProfileEditFormData = z.infer<typeof profileEditSchema>;

export default function ProfileEditScreen() {
  const { profile, user, updateProfile } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  
  // 3. Form Setup with Current Values
  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      email: user?.email || "",
      phone_number: profile?.phone_number || "",
    },
  });

  // 4. Avatar Upload Handler
  const handleAvatarUpload = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to change your profile picture."
      );
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (result.canceled || !result.assets[0]) return;
    
    setUploadingAvatar(true);
    
    try {
      const file = result.assets[0];
      const fileExt = file.uri.split(".").pop();
      const fileName = `${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);
      
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, formData);
      
      if (uploadError) throw uploadError;
      
      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
      
      setAvatarUrl(publicUrl.publicUrl);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", "Failed to upload profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  }, [profile?.id]);

  // 5. Profile Update Handler
  const handleSaveProfile = useCallback(async (data: ProfileEditFormData) => {
    setSavingProfile(true);
    
    try {
      // 5.1 Update auth email if changed
      if (data.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        });
        
        if (emailError) throw emailError;
      }
      
      // 5.2 Update profile
      await updateProfile({
        full_name: data.full_name,
        phone_number: data.phone_number,
        avatar_url: avatarUrl,
      });
      
      Alert.alert(
        "Success",
        "Your profile has been updated successfully",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to update profile"
      );
    } finally {
      setSavingProfile(false);
    }
  }, [user?.email, avatarUrl, updateProfile, router]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <ChevronLeft size={24} />
          </Pressable>
          <H2>Edit Profile</H2>
          <View className="w-10" />
        </View>
        
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Avatar Section */}
          <View className="items-center py-6">
            <Pressable onPress={handleAvatarUpload} disabled={uploadingAvatar}>
              <View className="relative">
                <Image
                  source={
                    avatarUrl
                      ? { uri: avatarUrl }
                      : require("@/assets/default-avatar.jpeg")
                  }
                  className="w-32 h-32 rounded-full"
                  contentFit="cover"
                />
                {uploadingAvatar && (
                  <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                    <ActivityIndicator size="small" color="white" />
                  </View>
                )}
                <View className="absolute bottom-0 right-0 bg-primary rounded-full p-3">
                  <Camera size={20} color="white" />
                </View>
              </View>
            </Pressable>
            <Pressable onPress={handleAvatarUpload} className="mt-3">
              <Text className="text-primary font-medium">Change Photo</Text>
            </Pressable>
          </View>
          
          {/* Form Fields */}
          <View className="px-4 pb-6">
            <Form {...form}>
              <View className="gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormInput
                      label="Full Name"
                      placeholder="John Doe"
                      autoCapitalize="words"
                      autoComplete="name"
                      {...field}
                    />
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormInput
                      label="Email Address"
                      placeholder="john@example.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      description="You'll need to verify your new email if changed"
                      {...field}
                    />
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormInput
                      label="Phone Number"
                      placeholder="03 123 456"
                      description="Used for booking confirmations"
                      keyboardType="phone-pad"
                      {...field}
                    />
                  )}
                />
              </View>
            </Form>
            
            {/* Account Info */}
            <View className="mt-6 p-4 bg-muted/50 rounded-lg">
              <View className="flex-row items-center gap-2 mb-2">
                <AlertCircle size={16} color="#666" />
                <Text className="font-medium">Account Information</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                Member since {new Date(profile?.created_at || "").toLocaleDateString()}
              </Text>
              <Text className="text-sm text-muted-foreground">
                User ID: {profile?.id?.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </ScrollView>
        
        {/* Save Button */}
        <View className="p-4 border-t border-border">
          <Button
            onPress={form.handleSubmit(handleSaveProfile)}
            disabled={savingProfile || !form.formState.isDirty}
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Save size={20} />
                <Text>Save Changes</Text>
              </>
            )}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}