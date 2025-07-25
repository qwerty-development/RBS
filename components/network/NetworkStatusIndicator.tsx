import React from "react";
import { View } from "react-native";
import { Wifi, WifiOff, Signal } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useConnectionStatus } from "@/context/network-provider";
import { useColorScheme } from "@/lib/useColorScheme";

interface NetworkStatusIndicatorProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "badge" | "full";
}

export function NetworkStatusIndicator({
  showText = false,
  size = "md",
  variant = "icon",
}: NetworkStatusIndicatorProps) {
  const { isOnline, isSlowConnection, connectionQuality } =
    useConnectionStatus();
  const { colorScheme } = useColorScheme();

  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const iconSize = sizeMap[size];

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: "#ef4444", // red-500
        text: "Offline",
        bgColor: "bg-red-100 dark:bg-red-900",
        textColor: "text-red-700 dark:text-red-300",
      };
    }

    if (isSlowConnection) {
      return {
        icon: Signal,
        color: "#f59e0b", // amber-500
        text: `Slow (${connectionQuality})`,
        bgColor: "bg-amber-100 dark:bg-amber-900",
        textColor: "text-amber-700 dark:text-amber-300",
      };
    }

    return {
      icon: Wifi,
      color: "#10b981", // emerald-500
      text: `Online (${connectionQuality})`,
      bgColor: "bg-emerald-100 dark:bg-emerald-900",
      textColor: "text-emerald-700 dark:text-emerald-300",
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (variant === "icon") {
    return <Icon size={iconSize} color={config.color} />;
  }

  if (variant === "badge") {
    return (
      <View
        className={`${config.bgColor} px-2 py-1 rounded-full flex-row items-center`}
      >
        <Icon size={12} color={config.color} />
        {showText && (
          <Text className={`${config.textColor} text-xs font-medium ml-1`}>
            {config.text}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-row items-center">
      <Icon size={iconSize} color={config.color} />
      {showText && (
        <Text className={`${config.textColor} font-medium ml-2`}>
          {config.text}
        </Text>
      )}
    </View>
  );
}
