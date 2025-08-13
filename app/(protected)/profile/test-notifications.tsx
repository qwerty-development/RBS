// app/(protected)/profile/test-notifications.tsx
import React from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, TestTube } from 'lucide-react-native';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { H2, Muted } from '@/components/ui/typography';
import { useColorScheme } from '@/lib/useColorScheme';
import { NotificationTester } from '@/components/testing/NotificationTester';

export default function TestNotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2 border-b border-border">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 p-2 rounded-full bg-muted"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === 'dark' ? '#fff' : '#000'}
            />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row items-center">
              <TestTube size={24} color="#3b82f6" />
              <H2 className="ml-2 text-2xl">Test Notifications</H2>
            </View>
            <Muted className="text-sm">
              Verify your notification setup is working correctly
            </Muted>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        <NotificationTester />
        
        <View className="mt-6 p-4 bg-muted/30 rounded-lg">
          <Text className="font-semibold mb-2">🔧 Setup Checklist:</Text>
          <View className="space-y-2">
            <Text className="text-sm">• Database migrations completed</Text>
            <Text className="text-sm">• Edge Functions deployed</Text>
            <Text className="text-sm">• Environment variables configured</Text>
            <Text className="text-sm">• pg_net extension enabled</Text>
            <Text className="text-sm">• Testing on physical device</Text>
            <Text className="text-sm">• Notification permissions granted</Text>
          </View>
        </View>

        <View className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Text className="font-semibold text-green-800 dark:text-green-200 mb-2">
            ✅ What Should Happen:
          </Text>
          <View className="space-y-1">
            <Text className="text-sm text-green-700 dark:text-green-300">
              • Notification appears in system notification center
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              • Notification appears in app notification screen
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              • Tapping notification navigates to relevant screen
            </Text>
            <Text className="text-sm text-green-700 dark:text-green-300">
              • Notification is logged in database
            </Text>
          </View>
        </View>

        <View className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <Text className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            ⚠️ Troubleshooting:
          </Text>
          <View className="space-y-1">
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              • No notifications: Check permissions and device settings
            </Text>
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              • Notifications not appearing in app: Check store integration
            </Text>
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              • Navigation not working: Check route definitions
            </Text>
            <Text className="text-sm text-amber-700 dark:text-amber-300">
              • Server errors: Check Supabase Edge Function logs
            </Text>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
