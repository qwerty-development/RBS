import React from "react";
import { Stack } from "expo-router";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";

export default function SocialLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
     
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Social",
          headerShown:false
        }}
      />
      <Stack.Screen
        name="feed"
        options={{
          title: "Feed",
        }}
      />
      <Stack.Screen
        name="friends"
        options={{
          title: "Friends",
        }}
      />
      <Stack.Screen
        name="create-post"
        options={{
          title: "Create Post",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="post/[id]"
        options={{
          title: "Post",
        }}
      />
      <Stack.Screen
        name="profile/[userId]"
        options={{
          title: "Profile",
        }}
      />
    </Stack>
  );
}