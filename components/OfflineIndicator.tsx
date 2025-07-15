// components/OfflineIndicator.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNetwork } from '@/context/network-provider';
import { offlineSync } from '@/services/offlineSync';
import { useColorScheme } from 'react-native';

export function OfflineIndicator() {
  const { isOffline, networkState } = useNetwork();
  const colorScheme = useColorScheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const wasOffline = useRef(false);

  // Check pending actions
  useEffect(() => {
    const checkPending = async () => {
      const count = await offlineSync.getPendingActionsCount();
      setPendingCount(count);
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle online/offline transitions
  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();

      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop pulsing
      pulseAnim.stopAnimation();
      
      // If we were offline and now online, sync pending actions
      if (wasOffline.current) {
        wasOffline.current = false;
        handleSync();
      }

      // Slide out after showing sync message
      setTimeout(() => {
        Animated.spring(slideAnim, {
          toValue: -100,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }, syncMessage ? 3000 : 500);
    }
  }, [isOffline, slideAnim, pulseAnim, syncMessage]);

  const handleSync = async () => {
    if (pendingCount === 0) return;

    setSyncing(true);
    setSyncMessage('Syncing offline changes...');

    try {
      const result = await offlineSync.syncOfflineActions();
      
      if (result.success) {
        if (result.synced > 0) {
          setSyncMessage(`✓ Synced ${result.synced} change${result.synced > 1 ? 's' : ''}`);
        }
        if (result.failed > 0) {
          setSyncMessage(prev => `${prev} (${result.failed} failed)`);
        }
      } else {
        setSyncMessage('Sync failed. Will retry later.');
      }

      // Update pending count
      const newCount = await offlineSync.getPendingActionsCount();
      setPendingCount(newCount);
    } catch (error) {
      setSyncMessage('Sync error. Will retry later.');
    } finally {
      setSyncing(false);
      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const bgColor = colorScheme === 'dark' ? 'bg-gray-800' : 'bg-gray-100';
  const textColor = colorScheme === 'dark' ? 'text-gray-200' : 'text-gray-800';
  const iconColor = colorScheme === 'dark' ? '#9CA3AF' : '#4B5563';

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
      className={`${bgColor} shadow-lg`}
    >
      <View className="px-4 pb-3 pt-12">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }],
              }}
            >
              <Feather 
                name={isOffline ? "wifi-off" : "wifi"} 
                size={20} 
                color={isOffline ? '#EF4444' : '#10B981'} 
              />
            </Animated.View>
            
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${textColor}`}>
                {isOffline ? 'You\'re offline' : syncMessage || 'Back online'}
              </Text>
              
              {isOffline && (
                <Text className={`text-sm mt-0.5 ${textColor} opacity-70`}>
                  {pendingCount > 0 
                    ? `${pendingCount} change${pendingCount > 1 ? 's' : ''} will sync when online`
                    : 'Some features may be limited'}
                </Text>
              )}

              {!isOffline && networkState.isSlowConnection && (
                <Text className={`text-sm mt-0.5 ${textColor} opacity-70`}>
                  Slow connection detected
                </Text>
              )}
            </View>
          </View>

          {isOffline && pendingCount > 0 && (
            <TouchableOpacity
              onPress={() => {}}
              disabled={syncing}
              className="ml-3 px-3 py-1.5 bg-blue-500 rounded-md"
            >
              <Text className="text-white text-sm font-medium">
                {syncing ? 'Syncing...' : `${pendingCount}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Connection quality indicator */}
      {!isOffline && networkState.connectionQuality && networkState.connectionQuality !== 'excellent' && (
        <View className={`h-1 ${bgColor} opacity-50`}>
          <View 
            className={`h-full ${
              networkState.connectionQuality === 'good' ? 'bg-yellow-500' :
              networkState.connectionQuality === 'fair' ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{
              width: networkState.connectionQuality === 'good' ? '75%' :
                     networkState.connectionQuality === 'fair' ? '50%' : '25%'
            }}
          />
        </View>
      )}
    </Animated.View>
  );
}