import './polyfills'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/supabase-provider';
import { NetworkProvider } from '@/context/network-provider';
import { useColorScheme } from '@/lib/useColorScheme';
import { colors } from '@/constants/colors';
import { LogBox, Alert, View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import * as Sentry from '@sentry/react-native';

import React from 'react';



// Network status bar component
function NetworkStatusBar() {
  const { isOnline, connectionQuality, isLoading, hasInitialized } = useNetworkMonitor({
    showOfflineAlert: true,
    showOnlineAlert: false,
    alertDelay: 5000,
  });

  const [showBanner, setShowBanner] = useState(false);

  // Control banner visibility with proper initialization checks
  useEffect(() => {
    // Don't show banner if still loading or not initialized
    if (isLoading || !hasInitialized) {
      setShowBanner(false);
      return;
    }

    // Add a small delay after initialization to ensure stable state
    const timer = setTimeout(() => {
      // Show banner if offline or poor connection
      const shouldShow = !isOnline || connectionQuality === 'poor';
      setShowBanner(shouldShow);
    }, 1000); // 1 second delay after initialization

    return () => clearTimeout(timer);
  }, [isOnline, connectionQuality, isLoading, hasInitialized]);

  // Don't render anything if banner shouldn't be shown
  if (!showBanner) {
    return null;
  }

  const backgroundColor = !isOnline ? '#F44336' : '#FF9800';
  const message = !isOnline
    ? 'No internet connection'
    : 'Slow connection detected';

  return (
    <View
      style={{
        backgroundColor,
        padding: 8,
        alignItems: 'center',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <Text style={{ color: 'white', fontSize: 12, fontWeight: '500' }}>
        {message}
      </Text>
    </View>
  );
}

// Main layout component
function RootLayoutContent() {
  const { colorScheme } = useColorScheme();
  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => {
    LogBox.ignoreLogs([
      'Clerk:',
      'Clerk has been loaded with development keys',
      'Unsupported Server Component type',
      'Warning: TNodeChildrenRenderer',
      'You seem to update props of the "TRenderEngineProvider" component',
    ]);
  }, []);

  useEffect(() => {
    if (__DEV__) return;

    async function checkForUpdates() {
      try {
        setUpdateChecking(true);
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          Alert.alert(
            'Update Available',
            'A new version of the app is available. Would you like to update now?',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (error) {
                    console.error('Failed to update:', error);
                    Alert.alert(
                      'Update Failed',
                      'Failed to download the update. Please try again later.'
                    );
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Update check failed:', error);
      } finally {
        setUpdateChecking(false);
      }
    }

    checkForUpdates();
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <NetworkStatusBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? colors.dark.background
                : colors.light.background,
          },
        }}
      />
    </>
  );
}

Sentry.init({
  dsn: "https://596c39f50e8604dcd468a29a63c1f442@o4509672135065600.ingest.de.sentry.io/4509672139587664",
  enabled: !__DEV__,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NetworkProvider>
          <AuthProvider>
       
              <RootLayoutContent />

          </AuthProvider>
        </NetworkProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}