// components/network/NetworkStatusBanner.tsx
import React, { useEffect, useState } from "react";
import { View, Pressable, Animated } from "react-native";
import { 
  Wifi, 
  WifiOff, 
  Signal, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  X 
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useNetwork } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { getIconColor } from "@/lib/utils";

interface NetworkStatusBannerProps {
  showWhenOnline?: boolean;
  autoDismiss?: number; // ms
  position?: "top" | "bottom";
  onDismiss?: () => void;
}

export function NetworkStatusBanner({ 
  showWhenOnline = false,
  autoDismiss,
  position = "top",
  onDismiss
}: NetworkStatusBannerProps) {
  const { networkState, isOnline, refresh } = useNetwork();
  const { colorScheme } = useColorScheme();
  const [visible, setVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useState(new Animated.Value(0))[0];

  // Determine if banner should be shown
  const shouldShow = visible && (
    !isOnline || 
    (showWhenOnline && isOnline) ||
    networkState.isSlowConnection
  );

  // Auto-dismiss logic
  useEffect(() => {
    if (autoDismiss && isOnline && !networkState.isSlowConnection) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, isOnline, networkState.isSlowConnection]);

  // Slide animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, slideAnim]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const getBannerConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        message: "No internet connection",
        submessage: "Please check your connection and try again",
        bgColor: "bg-red-500",
        textColor: "text-white",
        showRefresh: true,
      };
    }

    if (networkState.isSlowConnection) {
      return {
        icon: Signal,
        message: "Slow connection detected",
        submessage: `${networkState.connectionQuality} quality - Some features may be limited`,
        bgColor: "bg-yellow-500 dark:bg-yellow-600",
        textColor: "text-black dark:text-white",
        showRefresh: true,
      };
    }

    if (showWhenOnline && isOnline) {
      return {
        icon: CheckCircle,
        message: "Connected",
        submessage: `${networkState.type} - ${networkState.connectionQuality} quality`,
        bgColor: "bg-green-500",
        textColor: "text-white",
        showRefresh: false,
      };
    }

    return null;
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: position === "top" ? [-100, 0] : [100, 0],
  });

  return (
    <Animated.View 
      style={{ 
        transform: [{ translateY }],
        zIndex: 1000,
        position: "absolute",
        [position]: 0,
        left: 0,
        right: 0,
      }}
    >
      <View className={`${config.bgColor} px-4 py-3 mx-4 mt-2 rounded-lg shadow-lg`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Icon 
              size={20} 
              color={getIconColor(colorScheme)} 
            />
            <View className="ml-3 flex-1">
              <Text className={`font-semibold ${config.textColor}`}>
                {config.message}
              </Text>
              <Text className={`text-sm ${config.textColor} opacity-90`}>
                {config.submessage}
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center ml-2">
            {config.showRefresh && (
              <Pressable 
                onPress={handleRefresh}
                className="p-2 mr-1"
                disabled={refreshing}
              >
                <RefreshCw 
                  size={18} 
                  color={getIconColor(colorScheme)}
                  style={{ 
                    transform: [{ rotate: refreshing ? "360deg" : "0deg" }] 
                  }}
                />
              </Pressable>
            )}
            
            <Pressable onPress={handleDismiss} className="p-2">
              <X 
                size={18} 
                color={getIconColor(colorScheme)} 
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}