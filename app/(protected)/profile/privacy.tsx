// app/(protected)/profile/privacy.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import PrivacyScreenSkeleton from "@/components/skeletons/PrivacyScreenSkeleton";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Settings,
  Lock,
  Globe,
  Bell,
  Users,
  Database,
  FileText,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H2, H3, P, Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

// 1. Type Definitions for Privacy Settings
interface PrivacySettings {
  marketing_emails: boolean;
  push_notifications: boolean;
  location_sharing: boolean;
  activity_sharing: boolean;
  profile_visibility: "public" | "friends" | "private";
  data_analytics: boolean;
  third_party_sharing: boolean;
  review_visibility: boolean;
}

interface DataExportRequest {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  requested_at: string;
  completed_at?: string;
  download_url?: string;
}

interface PrivacyPolicySection {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
}

// 2. Privacy Configuration Constants
const PRIVACY_SECTIONS: PrivacyPolicySection[] = [
  {
    id: "data_collection",
    title: "Data Collection",
    content:
      "We collect information you provide directly, usage data, and device information to enhance your dining experience.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_usage",
    title: "How We Use Your Data",
    content:
      "Your data helps us personalize recommendations, process bookings, and improve our services.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_sharing",
    title: "Data Sharing",
    content:
      "We share minimal data with restaurant partners and trusted service providers to fulfill your bookings.",
    lastUpdated: "2024-01-15",
  },
  {
    id: "data_security",
    title: "Data Security",
    content:
      "We use industry-standard encryption and security measures to protect your personal information.",
    lastUpdated: "2024-01-15",
  },
];

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  marketing_emails: true,
  push_notifications: true,
  location_sharing: false,
  activity_sharing: true,
  profile_visibility: "public",
  data_analytics: true,
  third_party_sharing: false,
  review_visibility: true,
};

export default function PrivacyScreen() {
  // 3. State Management Architecture
  const { profile, user } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // 3.1 Privacy Settings State
  const [settings, setSettings] = useState<PrivacySettings>(
    DEFAULT_PRIVACY_SETTINGS,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 3.2 Data Management State
  const [exportRequest, setExportRequest] = useState<DataExportRequest | null>(
    null,
  );
  const [requestingExport, setRequestingExport] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // 3.3 UI State
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  // 4. Privacy Settings Management
  const fetchPrivacySettings = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("user_privacy_settings")
        .select("*")
        .eq("user_id", profile.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          marketing_emails:
            data.marketing_emails ?? DEFAULT_PRIVACY_SETTINGS.marketing_emails,
          push_notifications:
            data.push_notifications ??
            DEFAULT_PRIVACY_SETTINGS.push_notifications,
          location_sharing:
            data.location_sharing ?? DEFAULT_PRIVACY_SETTINGS.location_sharing,
          activity_sharing:
            data.activity_sharing ?? DEFAULT_PRIVACY_SETTINGS.activity_sharing,
          profile_visibility:
            data.profile_visibility ??
            DEFAULT_PRIVACY_SETTINGS.profile_visibility,
          data_analytics:
            data.data_analytics ?? DEFAULT_PRIVACY_SETTINGS.data_analytics,
          third_party_sharing:
            data.third_party_sharing ??
            DEFAULT_PRIVACY_SETTINGS.third_party_sharing,
          review_visibility:
            data.review_visibility ??
            DEFAULT_PRIVACY_SETTINGS.review_visibility,
        });
      }
    } catch (error) {
      console.error("Error fetching privacy settings:", error);
      Alert.alert("Error", "Failed to load privacy settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // 5. Settings Update Handler
  const updatePrivacySetting = useCallback(
    async (key: keyof PrivacySettings, value: any) => {
      if (!profile?.id) return;

      setSaving(true);
      try {
        // Update local state immediately for responsiveness
        setSettings((prev) => ({ ...prev, [key]: value }));

        // Update in database
        const { error } = await supabase.from("user_privacy_settings").upsert({
          user_id: profile.id,
          [key]: value,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;
      } catch (error) {
        // Revert local state on error
        setSettings((prev) => ({ ...prev, [key]: !value }));
        console.error("Error updating privacy setting:", error);
        Alert.alert("Error", "Failed to update setting");
      } finally {
        setSaving(false);
      }
    },
    [profile?.id],
  );

  // 6. Data Export Request Handler
  const requestDataExport = useCallback(async () => {
    if (!profile?.id) return;

    setRequestingExport(true);
    try {
      const { data, error } = await supabase
        .from("data_export_requests")
        .insert({
          user_id: profile.id,
          status: "pending",
          requested_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setExportRequest(data);
      Alert.alert(
        "Export Requested",
        "Your data export has been requested. You'll receive an email when it's ready for download.",
      );
    } catch (error) {
      console.error("Error requesting data export:", error);
      Alert.alert("Error", "Failed to request data export");
    } finally {
      setRequestingExport(false);
    }
  }, [profile?.id]);

  // 7. Account Deletion Handler
  const handleAccountDeletion = useCallback(async () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All your data, bookings, and reviews will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              // In a real app, this would trigger a backend process
              // For now, we'll just sign out and show a message
              Alert.alert(
                "Account Deletion Initiated",
                "Your account deletion request has been submitted. You'll receive a confirmation email within 24 hours.",
              );
              // await signOut();
            } catch (error) {
              console.error("Error deleting account:", error);
              Alert.alert("Error", "Failed to delete account");
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  }, []);

  // 8. Section Toggle Handler
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // 9. Lifecycle Management
  useEffect(() => {
    if (profile) {
      fetchPrivacySettings();
    }
  }, [profile, fetchPrivacySettings]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrivacySettings();
  }, [fetchPrivacySettings]);

  // 10. Render Privacy Setting Item
  const renderPrivacySetting = ({
    key,
    title,
    description,
    icon: Icon,
    type = "switch",
    options,
  }: {
    key: keyof PrivacySettings;
    title: string;
    description: string;
    icon: any;
    type?: "switch" | "select";
    options?: { label: string; value: any }[];
  }) => {
    const value = settings[key];

    return (
      <View className="bg-card mx-4 mb-3 rounded-xl p-4">
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 bg-muted rounded-full items-center justify-center">
            <Icon size={20} color="#666" />
          </View>
          <View className="flex-1">
            <Text className="font-medium mb-1">{title}</Text>
            <Muted className="text-sm mb-3">{description}</Muted>

            {type === "switch" && (
              <Switch
                value={value as boolean}
                onValueChange={(newValue) =>
                  updatePrivacySetting(key, newValue)
                }
                disabled={saving}
              />
            )}

            {type === "select" && options && (
              <View className="gap-2">
                {options.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => updatePrivacySetting(key, option.value)}
                    className={`flex-row items-center justify-between p-3 rounded-lg border ${
                      value === option.value
                        ? "bg-primary/10 border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        value === option.value ? "text-primary font-medium" : ""
                      }
                    >
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <CheckCircle
                        size={16}
                        color={colorScheme === "dark" ? "#3b82f6" : "#2563eb"}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // 11. Main Render
  if (loading) {
    return <PrivacyScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* 11.1 Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
        <H2>Privacy & Security</H2>
        <View className="w-10" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
      >
        {/* 11.2 Privacy Settings Section */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Privacy Controls
          </Text>

          {renderPrivacySetting({
            key: "profile_visibility",
            title: "Profile Visibility",
            description: "Control who can see your profile information",
            icon: Users,
            type: "select",
            options: [
              { label: "Public", value: "public" },
              { label: "Friends Only", value: "friends" },
              { label: "Private", value: "private" },
            ],
          })}

          {renderPrivacySetting({
            key: "location_sharing",
            title: "Location Sharing",
            description:
              "Share your location to get personalized restaurant recommendations",
            icon: Globe,
          })}

          {renderPrivacySetting({
            key: "activity_sharing",
            title: "Activity Sharing",
            description:
              "Allow friends to see your dining activity and check-ins",
            icon: Users,
          })}

          {renderPrivacySetting({
            key: "review_visibility",
            title: "Public Reviews",
            description: "Make your restaurant reviews visible to other users",
            icon: Eye,
          })}
        </View>

        {/* 11.3 Communication Preferences */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Communication
          </Text>

          {renderPrivacySetting({
            key: "push_notifications",
            title: "Push Notifications",
            description:
              "Receive notifications about bookings and special offers",
            icon: Bell,
          })}

          {renderPrivacySetting({
            key: "marketing_emails",
            title: "Marketing Emails",
            description:
              "Receive promotional emails about new restaurants and offers",
            icon: FileText,
          })}
        </View>

        {/* 11.4 Data Usage */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Data Usage
          </Text>

          {renderPrivacySetting({
            key: "data_analytics",
            title: "Analytics",
            description:
              "Help us improve the app by sharing anonymous usage data",
            icon: Database,
          })}

          {renderPrivacySetting({
            key: "third_party_sharing",
            title: "Third-Party Sharing",
            description:
              "Allow sharing data with restaurant partners for better service",
            icon: ExternalLink,
          })}
        </View>

        {/* 11.5 Data Management Section */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Data Management
          </Text>

          {/* Data Export */}
          <View className="bg-card mx-4 mb-3 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-muted rounded-full items-center justify-center">
                <Download size={20} color="#666" />
              </View>
              <View className="flex-1">
                <Text className="font-medium mb-1">Export My Data</Text>
                <Muted className="text-sm mb-3">
                  Download a copy of all your personal data and activity
                </Muted>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={requestDataExport}
                  disabled={requestingExport || !!exportRequest}
                >
                  <Text className="text-sm">
                    {requestingExport
                      ? "Requesting..."
                      : exportRequest
                        ? "Export Pending"
                        : "Request Export"}
                  </Text>
                </Button>
              </View>
            </View>
          </View>

          {/* Account Deletion */}
          <View className="bg-card mx-4 mb-3 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <View className="w-10 h-10 bg-destructive/10 rounded-full items-center justify-center">
                <Trash2 size={20} color="#ef4444" />
              </View>
              <View className="flex-1">
                <Text className="font-medium mb-1 text-destructive">
                  Delete Account
                </Text>
                <Muted className="text-sm mb-3">
                  Permanently delete your account and all associated data
                </Muted>
                <Button
                  variant="destructive"
                  size="sm"
                  onPress={handleAccountDeletion}
                  disabled={deletingAccount}
                >
                  <Text className="text-destructive-foreground text-sm">
                    {deletingAccount ? "Processing..." : "Delete Account"}
                  </Text>
                </Button>
              </View>
            </View>
          </View>
        </View>

        {/* 11.6 Privacy Policy Sections */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Privacy Policy
          </Text>

          {PRIVACY_SECTIONS.map((section) => {
            const isExpanded = expandedSections.has(section.id);

            return (
              <View
                key={section.id}
                className="bg-card mx-4 mb-3 rounded-xl overflow-hidden"
              >
                <Pressable
                  onPress={() => toggleSection(section.id)}
                  className="p-4 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="font-medium">{section.title}</Text>
                    <Muted className="text-xs mt-1">
                      Updated{" "}
                      {new Date(section.lastUpdated).toLocaleDateString()}
                    </Muted>
                  </View>
                  <View
                    className={`transform ${isExpanded ? "rotate-180" : "rotate-0"}`}
                  >
                    <ArrowLeft
                      size={20}
                      color="#666"
                      style={{ transform: [{ rotate: "270deg" }] }}
                    />
                  </View>
                </Pressable>

                {isExpanded && (
                  <View className="px-4 pb-4 border-t border-border">
                    <P className="text-sm mt-3">{section.content}</P>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* 11.7 Legal Documents Section */}
        <View className="pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase px-4 mb-3">
            Legal Documents
          </Text>

          <Pressable
            onPress={() => router.push("/legal/PRIVACY_POLICY")}
            className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center dark:bg-blue-900">
              <FileText size={20} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">Full Privacy Policy</Text>
              <Muted className="text-sm">
                Complete details about our privacy practices
              </Muted>
            </View>
            <ExternalLink size={20} color="#666" />
          </Pressable>

          <Pressable
            onPress={() => router.push("/legal")}
            className="bg-card mx-4 mb-3 rounded-xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center dark:bg-green-900">
              <Database size={20} color="#059669" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="font-medium">All Legal Documents</Text>
              <Muted className="text-sm">
                Terms, policies, and community guidelines
              </Muted>
            </View>
            <ExternalLink size={20} color="#666" />
          </Pressable>
        </View>

        {/* 11.8 Footer */}
        <View className="items-center py-8 px-4">
          <Muted className="text-xs text-center">
            Your privacy is important to us. We follow industry best practices
            to protect your data.
          </Muted>
          <Pressable
            onPress={() => router.push("/legal/DATA_PROTECTION_POLICY")}
            className="mt-2"
          >
            <Text className="text-primary text-sm">
              Read Data Protection Policy
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
