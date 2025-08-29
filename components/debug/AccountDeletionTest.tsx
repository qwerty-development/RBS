// components/debug/AccountDeletionTest.tsx
// This component is for testing account deletion functionality in development
// Remove this from production builds

import React, { useState } from "react";
import { View, ScrollView, Alert } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P } from "@/components/ui/typography";
import {
  useAccountDeletion,
  UserDataSummary,
} from "@/lib/accountDeletionService";
import { useAuth } from "@/context/supabase-provider";

interface TestResult {
  title: string;
  status: "success" | "error" | "info";
  message: string;
  data?: any;
}

export default function AccountDeletionTest() {
  const { profile } = useAuth();
  const { getUserDataSummary, validateDeletion, requestDataExport } =
    useAccountDeletion();

  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [
      ...prev,
      { ...result, timestamp: new Date().toISOString() } as any,
    ]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testDataSummary = async () => {
    setLoading(true);
    try {
      const summary = await getUserDataSummary();

      if (summary) {
        addResult({
          title: "User Data Summary",
          status: "success",
          message: "Successfully retrieved user data summary",
          data: summary,
        });

        // Show summary in alert for easy viewing
        Alert.alert(
          "User Data Summary",
          `Profile: ${summary.profile_exists ? "Yes" : "No"}
Bookings: ${summary.bookings_count}
Reviews: ${summary.reviews_count}
Favorites: ${summary.favorites_count}
Friends: ${summary.friends_count}
Playlists: ${summary.playlists_count}
Posts: ${summary.posts_count}
Notifications: ${summary.notifications_count}
Waitlist: ${summary.waitlist_count}
Loyalty Activities: ${summary.loyalty_activities_count}
Staff Roles: ${summary.staff_roles_count}`,
        );
      } else {
        addResult({
          title: "User Data Summary",
          status: "error",
          message: "Failed to retrieve user data summary",
        });
      }
    } catch (error: any) {
      addResult({
        title: "User Data Summary",
        status: "error",
        message: error.message || "Unknown error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const testValidation = async () => {
    setLoading(true);
    try {
      const validation = await validateDeletion();

      addResult({
        title: "Deletion Validation",
        status: validation.canDelete ? "success" : "error",
        message: validation.canDelete
          ? "Account can be deleted"
          : "Account cannot be deleted",
        data: validation,
      });

      // Show validation details
      const restrictionsText =
        validation.restrictions.length > 0
          ? `\n\nRestrictions:\n${validation.restrictions.join("\n")}`
          : "";

      const warningsText =
        validation.warnings.length > 0
          ? `\n\nWarnings:\n${validation.warnings.join("\n")}`
          : "";

      Alert.alert(
        "Deletion Validation",
        `Can Delete: ${validation.canDelete ? "Yes" : "No"}${restrictionsText}${warningsText}`,
      );
    } catch (error: any) {
      addResult({
        title: "Deletion Validation",
        status: "error",
        message: error.message || "Validation failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const testDataExport = async () => {
    setLoading(true);
    try {
      const result = await requestDataExport();

      addResult({
        title: "Data Export Request",
        status: result.success ? "success" : "error",
        message: result.message,
      });

      Alert.alert(
        result.success ? "Export Requested" : "Export Failed",
        result.message,
      );
    } catch (error: any) {
      addResult({
        title: "Data Export Request",
        status: "error",
        message: error.message || "Export request failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return "text-green-600 dark:text-green-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "info":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "⚪";
    }
  };

  if (!profile) {
    return (
      <View className="p-4">
        <Text className="text-center text-muted-foreground">
          Please sign in to test account deletion functionality
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <H3 className="mb-4">Account Deletion Test Panel</H3>

      <P className="text-muted-foreground mb-6">
        This panel allows you to test the account deletion functionality without
        actually deleting your account. Only use this in development
        environments.
      </P>

      <View className="gap-3 mb-6">
        <Button onPress={testDataSummary} disabled={loading} variant="outline">
          <Text>Test Data Summary</Text>
        </Button>

        <Button onPress={testValidation} disabled={loading} variant="outline">
          <Text>Test Deletion Validation</Text>
        </Button>

        <Button onPress={testDataExport} disabled={loading} variant="outline">
          <Text>Test Data Export Request</Text>
        </Button>

        <Button onPress={clearResults} disabled={loading} variant="ghost">
          <Text>Clear Results</Text>
        </Button>
      </View>

      {results.length > 0 && (
        <View>
          <H3 className="mb-3">Test Results</H3>
          <View className="gap-3">
            {results.map((result, index) => (
              <View
                key={index}
                className="bg-card p-4 rounded-lg border border-border"
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Text className="text-lg">
                    {getStatusIcon(result.status)}
                  </Text>
                  <Text className="font-medium">{result.title}</Text>
                </View>

                <Text
                  className={`text-sm mb-2 ${getStatusColor(result.status)}`}
                >
                  {result.message}
                </Text>

                {result.data && (
                  <View className="bg-muted p-3 rounded mt-2">
                    <Text className="text-xs font-mono text-muted-foreground">
                      {JSON.stringify(result.data, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <Text className="text-yellow-800 dark:text-yellow-200 text-sm font-medium mb-1">
          ⚠️ Development Only
        </Text>
        <Text className="text-yellow-700 dark:text-yellow-300 text-xs">
          This component should be removed from production builds. It's intended
          for testing the account deletion functionality during development.
        </Text>
      </View>
    </ScrollView>
  );
}
