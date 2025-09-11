// components/debug/RealtimeStatus.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { realtimeSubscriptionService } from "@/lib/RealtimeSubscriptionService";

export const RealtimeStatus: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  const updateStatus = () => {
    setStatus(realtimeSubscriptionService.debugStatus());
    setStats(realtimeSubscriptionService.getStats());
  };

  useEffect(() => {
    if (isVisible) {
      updateStatus();
      const interval = setInterval(updateStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const handleClearStats = () => {
    Alert.alert(
      "Clear Statistics",
      "Are you sure you want to clear all real-time statistics?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            // Note: We don't have a clearStats method yet, but we can add it
            updateStatus();
          },
        },
      ],
    );
  };

  const formatSubscription = (sub: any) => {
    return {
      id: sub.channelId,
      table: sub.table,
      status: sub.status,
      error: sub.lastError,
      events: sub.eventCount || 0,
      lastEvent: sub.lastEventTime
        ? new Date(sub.lastEventTime).toLocaleTimeString()
        : "Never",
    };
  };

  if (!__DEV__) {
    return null; // Only show in development
  }

  return (
    <View className="absolute top-12 right-4 z-50">
      <TouchableOpacity
        onPress={() => setIsVisible(!isVisible)}
        className={`px-3 py-1 rounded-full ${
          status?.isHealthy === false
            ? "bg-red-500"
            : stats?.totalSubscriptions > 0
              ? "bg-green-500"
              : "bg-yellow-500"
        }`}
      >
        <Text className="text-white text-xs font-semibold">
          RT: {stats?.totalSubscriptions || 0}
        </Text>
      </TouchableOpacity>

      {isVisible && (
        <View className="absolute top-8 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-80 max-w-96">
          <ScrollView className="max-h-96">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                Real-time Status
              </Text>
              <TouchableOpacity onPress={handleClearStats}>
                <Text className="text-blue-500 text-sm">Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Health Status */}
            <View className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Text className="font-semibold mb-2 text-gray-900 dark:text-white">
                Service Health
              </Text>
              <Text
                className={`text-sm ${
                  status?.isHealthy === false
                    ? "text-red-500"
                    : "text-green-500"
                }`}
              >
                Status: {status?.isHealthy === false ? "Unhealthy" : "Healthy"}
              </Text>
              {status?.connectionStatus && (
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Connection: {status.connectionStatus}
                </Text>
              )}
            </View>

            {/* Statistics */}
            {stats && (
              <View className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <Text className="font-semibold mb-2 text-gray-900 dark:text-white">
                  Statistics
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Total Subscriptions: {stats.totalSubscriptions}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Active Connections: {stats.activeConnections}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Total Events: {stats.totalEvents}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Error Count: {stats.errorCount}
                </Text>
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  Last Activity:{" "}
                  {stats.lastActivity
                    ? new Date(stats.lastActivity).toLocaleTimeString()
                    : "None"}
                </Text>
              </View>
            )}

            {/* Active Subscriptions */}
            {status?.subscriptions &&
              Object.keys(status.subscriptions).length > 0 && (
                <View className="mb-4">
                  <Text className="font-semibold mb-2 text-gray-900 dark:text-white">
                    Active Subscriptions
                  </Text>
                  {Object.entries(status.subscriptions).map(
                    ([channelId, sub]: [string, any]) => {
                      const formatted = formatSubscription(sub);
                      return (
                        <View
                          key={channelId}
                          className="mb-2 p-2 bg-gray-50 dark:bg-gray-700 rounded"
                        >
                          <Text className="text-xs font-mono text-gray-900 dark:text-white">
                            {formatted.id}
                          </Text>
                          <View className="flex-row justify-between">
                            <Text className="text-xs text-gray-600 dark:text-gray-300">
                              Table: {formatted.table}
                            </Text>
                            <Text
                              className={`text-xs ${
                                formatted.status === "connected"
                                  ? "text-green-500"
                                  : formatted.status === "error"
                                    ? "text-red-500"
                                    : "text-yellow-500"
                              }`}
                            >
                              {formatted.status}
                            </Text>
                          </View>
                          <View className="flex-row justify-between">
                            <Text className="text-xs text-gray-600 dark:text-gray-300">
                              Events: {formatted.events}
                            </Text>
                            <Text className="text-xs text-gray-600 dark:text-gray-300">
                              Last: {formatted.lastEvent}
                            </Text>
                          </View>
                          {formatted.error && (
                            <Text className="text-xs text-red-500 mt-1">
                              Error: {formatted.error}
                            </Text>
                          )}
                        </View>
                      );
                    },
                  )}
                </View>
              )}

            {/* Recent Errors */}
            {status?.recentErrors && status.recentErrors.length > 0 && (
              <View className="mb-4">
                <Text className="font-semibold mb-2 text-red-500">
                  Recent Errors
                </Text>
                {status.recentErrors
                  .slice(0, 3)
                  .map((error: any, index: number) => (
                    <View
                      key={index}
                      className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded"
                    >
                      <Text className="text-xs text-red-700 dark:text-red-300">
                        {new Date(error.timestamp).toLocaleTimeString()}:{" "}
                        {error.message}
                      </Text>
                      {error.channelId && (
                        <Text className="text-xs text-red-500 font-mono">
                          Channel: {error.channelId}
                        </Text>
                      )}
                    </View>
                  ))}
              </View>
            )}

            {/* Instructions */}
            <View className="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <Text className="text-xs text-blue-700 dark:text-blue-300">
                💡 This debug panel shows real-time subscription status.{"\n"}
                Green dot = Healthy, Yellow = Connecting, Red = Error
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default RealtimeStatus;
