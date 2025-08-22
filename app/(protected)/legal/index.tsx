// app/(protected)/legal/index.tsx
import React, { useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Shield,
  FileText,
  Cookie,
  Users,
  Database,
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
} from "lucide-react-native";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import {
  getLegalDocumentMetadata,
  LegalDocumentType,
  LEGAL_DOCUMENTS,
} from "@/constants/legalDocuments";

interface LegalDocumentItem {
  type: LegalDocumentType;
  title: string;
  description: string;
  icon: any;
  color: string;
  importance: "high" | "medium" | "low";
  lastUpdated: string;
  version: string;
}

const LEGAL_DOCUMENT_ITEMS: LegalDocumentItem[] = [
  {
    type: "PRIVACY_POLICY",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal information",
    icon: Shield,
    color: "#3b82f6",
    importance: "high",
    lastUpdated: LEGAL_DOCUMENTS.PRIVACY_POLICY.lastUpdated,
    version: LEGAL_DOCUMENTS.PRIVACY_POLICY.version,
  },
  {
    type: "TERMS_OF_SERVICE",
    title: "Terms and Conditions",
    description: "Rules and guidelines for using our service",
    icon: FileText,
    color: "#059669",
    importance: "high",
    lastUpdated: LEGAL_DOCUMENTS.TERMS_OF_SERVICE.lastUpdated,
    version: LEGAL_DOCUMENTS.TERMS_OF_SERVICE.version,
  },
  {
    type: "COMMUNITY_GUIDELINES",
    title: "Community Guidelines",
    description: "Standards for respectful community interaction",
    icon: Users,
    color: "#7c3aed",
    importance: "medium",
    lastUpdated: LEGAL_DOCUMENTS.COMMUNITY_GUIDELINES.lastUpdated,
    version: LEGAL_DOCUMENTS.COMMUNITY_GUIDELINES.version,
  },
  {
    type: "COOKIE_POLICY",
    title: "Cookie and Tracking Policy",
    description: "How we use cookies and similar technologies",
    icon: Cookie,
    color: "#dc2626",
    importance: "medium",
    lastUpdated: LEGAL_DOCUMENTS.COOKIE_POLICY.lastUpdated,
    version: LEGAL_DOCUMENTS.COOKIE_POLICY.version,
  },
  {
    type: "DATA_PROCESSING_AGREEMENT",
    title: "Data Processing Agreement",
    description: "Agreement between Plate and restaurant partners for data processing",
    icon: FileText,
    color: "#f59e0b",
    importance: "low",
    lastUpdated: LEGAL_DOCUMENTS.DATA_PROCESSING_AGREEMENT.lastUpdated,
    version: LEGAL_DOCUMENTS.DATA_PROCESSING_AGREEMENT.version,
  },
  {
    type: "DATA_PROTECTION_POLICY",
    title: "Data Protection Policy",
    description: "Our commitment to data protection and security",
    icon: Database,
    color: "#ea580c",
    importance: "low",
    lastUpdated: LEGAL_DOCUMENTS.DATA_PROTECTION_POLICY.lastUpdated,
    version: LEGAL_DOCUMENTS.DATA_PROTECTION_POLICY.version,
  },
];

const ADDITIONAL_RESOURCES = [
  {
    title: "Legal FAQ",
    description: "Frequently asked questions about our legal policies",
    icon: HelpCircle,
    action: () => {
      Alert.alert(
        "Legal FAQ",
        "Common questions about our terms, privacy, and policies will be available here soon.",
      );
    },
  },
      {
      title: "Contact Legal Team",
      description: "Get in touch with our legal department",
      icon: ExternalLink,
      action: async () => {
        try {
          await Linking.openURL("mailto:legal@plate-app.com");
        } catch (error) {
          Alert.alert(
            "Contact Legal Team",
            "You can reach our legal team at:\n\nEmail: legal@plate-app.com\nPhone: +961 1 234 567",
          );
        }
      },
    },
  {
    title: "Compliance Information",
    description: "Industry standards and compliance certifications",
    icon: CheckCircle,
    action: () => {
      Alert.alert(
        "Compliance Information",
        "We comply with relevant data protection laws including:\n\n• Lebanese Data Protection Laws\n• GDPR (for EU users)\n• Industry security standards\n\nDetailed compliance information will be available soon.",
      );
    },
  },
];

export default function LegalIndexScreen() {
  const { colorScheme } = useColorScheme();
  const router = useRouter();

  // Navigate to specific legal document
  const navigateToDocument = useCallback(
    (documentType: LegalDocumentType) => {
      router.push(`/legal/${documentType}`);
    },
    [router],
  );

  // Get importance badge info
  const getImportanceBadge = useCallback((importance: string) => {
    switch (importance) {
      case "high":
        return { text: "Important", color: "#ef4444", bgColor: "#fef2f2" };
      case "medium":
        return { text: "Recommended", color: "#f59e0b", bgColor: "#fffbeb" };
      case "low":
        return { text: "Reference", color: "#6b7280", bgColor: "#f9fafb" };
      default:
        return { text: "", color: "#6b7280", bgColor: "#f9fafb" };
    }
  }, []);

  // Calculate days since last update
  const getDaysSinceUpdate = useCallback((lastUpdated: string) => {
    const updateDate = new Date(lastUpdated);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - updateDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  // Render legal document item
  const renderLegalDocumentItem = useCallback(
    (item: LegalDocumentItem) => {
      const importanceBadge = getImportanceBadge(item.importance);
      const daysSinceUpdate = getDaysSinceUpdate(item.lastUpdated);
      const isRecentlyUpdated = daysSinceUpdate <= 30;

      return (
        <Pressable
          key={item.type}
          onPress={() => navigateToDocument(item.type)}
          className="bg-card rounded-xl border border-border p-4 mb-3 active:bg-muted/50"
        >
          <View className="flex-row items-start gap-3">
            {/* Icon */}
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: `${item.color}20` }}
            >
              <item.icon size={24} color={item.color} />
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="font-semibold text-foreground">
                  {item.title}
                </Text>
                <ChevronRight size={20} color="#666" />
              </View>
              
              <Text className="text-sm text-muted-foreground mb-3 leading-5">
                {item.description}
              </Text>

              {/* Badges and meta info */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  {/* Importance badge */}
                  {item.importance !== "low" && (
                    <View
                      className="px-2 py-1 rounded-full"
                      style={{ backgroundColor: importanceBadge.bgColor }}
                    >
                      <Text
                        className="text-xs font-medium"
                        style={{ color: importanceBadge.color }}
                      >
                        {importanceBadge.text}
                      </Text>
                    </View>
                  )}
                  
                  {/* Recently updated badge */}
                  {isRecentlyUpdated && (
                    <View className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900">
                      <Text className="text-xs font-medium text-green-700 dark:text-green-300">
                        Recently Updated
                      </Text>
                    </View>
                  )}
                </View>

                {/* Version and date */}
                <View className="flex-row items-center gap-3">
                  <Text className="text-xs text-muted-foreground">
                    v{item.version}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color="#666" />
                    <Text className="text-xs text-muted-foreground">
                      {new Date(item.lastUpdated).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [navigateToDocument, getImportanceBadge, getDaysSinceUpdate],
  );

  // Render additional resource item
  const renderAdditionalResource = useCallback(
    (resource: any, index: number) => {
      return (
        <Pressable
          key={index}
          onPress={resource.action}
          className="bg-card rounded-xl border border-border p-4 mb-3 active:bg-muted/50"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-muted rounded-full items-center justify-center">
              <resource.icon size={20} color="#666" />
            </View>
            <View className="flex-1">
              <Text className="font-medium text-foreground mb-1">
                {resource.title}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {resource.description}
              </Text>
            </View>
            <ChevronRight size={20} color="#666" />
          </View>
        </Pressable>
      );
    },
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft
            size={24}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
        <H2>Legal Information</H2>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View className="mb-6">
          <H1 className="mb-3">Legal Documents</H1>
          <P className="text-muted-foreground leading-6">
            Stay informed about your rights and our policies. These documents
            explain how we operate, protect your data, and what we expect from
            our community.
          </P>
        </View>

        {/* Important notice */}
        <View className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 dark:bg-amber-950 dark:border-amber-800">
          <View className="flex-row items-center gap-2 mb-2">
            <AlertTriangle size={16} color="#f59e0b" />
            <Text className="font-medium text-amber-900 dark:text-amber-100">
              Important Notice
            </Text>
          </View>
          <Text className="text-sm text-amber-800 dark:text-amber-200">
            By using Table Reserve, you agree to our Terms of Service and
            Privacy Policy. We recommend reading these documents to understand
            your rights and our responsibilities.
          </Text>
        </View>

        {/* Essential Documents */}
        <View className="mb-6">
          <H3 className="mb-4">Essential Documents</H3>
          {LEGAL_DOCUMENT_ITEMS.filter((item) => item.importance === "high").map(
            renderLegalDocumentItem,
          )}
        </View>

        {/* Additional Policies */}
        <View className="mb-6">
          <H3 className="mb-4">Additional Policies</H3>
          {LEGAL_DOCUMENT_ITEMS.filter((item) => item.importance !== "high").map(
            renderLegalDocumentItem,
          )}
        </View>

        {/* Additional Resources */}
        <View className="mb-6">
          <H3 className="mb-4">Additional Resources</H3>
          {ADDITIONAL_RESOURCES.map(renderAdditionalResource)}
        </View>

        {/* Quick Links */}
        <View className="mb-6">
          <H3 className="mb-4">Quick Actions</H3>
          
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                Alert.alert(
                  "Download All Documents",
                  "A downloadable PDF package of all legal documents will be available soon.",
                );
              }}
            >
              <Text className="text-sm">Download All</Text>
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              onPress={async () => {
                try {
                  await Linking.openURL("mailto:legal@plate-app.com");
                } catch (error) {
                  Alert.alert(
                    "Contact Legal",
                    "Email: legal@plate-app.com\nPhone: +961 1 234 567",
                  );
                }
              }}
            >
              <Text className="text-sm">Contact Legal</Text>
            </Button>
          </View>
        </View>

        {/* Footer information */}
        <View className="bg-muted/50 rounded-lg p-4 mb-8">
          <Text className="text-center text-sm text-muted-foreground mb-2">
            Legal documents are regularly reviewed and updated
          </Text>
          <Text className="text-center text-xs text-muted-foreground">
            Last review: {new Date().toLocaleDateString()} • Version 1.0
          </Text>
        </View>

        {/* Bottom spacing */}
        <View className="h-4" />
      </ScrollView>
    </SafeAreaView>
  );
}
