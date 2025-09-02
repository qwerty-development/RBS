import React, { useState } from "react";
import { View, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { CheckCircle, FileText, AlertCircle } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { H2, H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { useTermsAcceptance } from "@/hooks/useTermsAcceptance";

interface TermsAcceptanceModalProps {
  visible: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  allowDismiss?: boolean; // For existing users, they may need to accept to continue
}

export const TermsAcceptanceModal: React.FC<TermsAcceptanceModalProps> = ({
  visible,
  onAccept,
  onDecline,
  allowDismiss = false,
}) => {
  const router = useRouter();
  const { acceptTerms, loading } = useTermsAcceptance();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const handleAccept = async () => {
    try {
      const result = await acceptTerms();

      if (result.success) {
        Alert.alert(
          "Terms Accepted",
          "Thank you for accepting our updated terms and conditions.",
          [{ text: "Continue", onPress: onAccept }],
        );
      } else {
        Alert.alert(
          "Error",
          result.error || "Failed to accept terms. Please try again.",
          [{ text: "OK" }],
        );
      }
    } catch (error) {
      console.error("Error accepting terms:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Terms Required",
      "You must accept our terms and conditions to continue using Plate. This helps us maintain a safe and respectful community for all users.",
      [
        { text: "Review Again", style: "default" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: onDecline,
        },
      ],
    );
  };

  const handleViewFullTerms = () => {
    router.push("/legal/TERMS_OF_SERVICE");
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isScrolledToBottom =
      contentOffset.y >= contentSize.height - layoutMeasurement.height - 50;
    setHasScrolledToBottom(isScrolledToBottom);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/70 justify-center items-center p-4">
        <View className="bg-background rounded-3xl w-full max-w-lg max-h-[80%]">
          {/* Header */}
          <View className="flex-row items-center justify-center p-6 border-b border-border">
            <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-4">
              <FileText size={24} color="#059669" />
            </View>
            <View className="flex-1">
              <H2>Updated Terms & Conditions</H2>
              <Text className="text-muted-foreground mt-1">
                We've updated our community guidelines
              </Text>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1 px-6 py-4"
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {/* Important Notice */}
            <View className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <View className="flex-row items-start gap-3">
                <AlertCircle size={20} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                    Important Updates to Our Community Guidelines
                  </Text>
                  <Text className="text-sm text-amber-700 dark:text-amber-300">
                    We've strengthened our policies to maintain a safe,
                    respectful environment for all users.
                  </Text>
                </View>
              </View>
            </View>

            {/* Key Updates */}
            <H3 className="mb-3">What's New:</H3>

            <View className="space-y-4 mb-6">
              <View className="flex-row items-start gap-3">
                <View className="w-2 h-2 bg-red-500 rounded-full mt-2" />
                <View className="flex-1">
                  <Text className="font-medium text-red-600 mb-1">
                    Zero Tolerance Policy
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    We have absolutely no tolerance for harassment, hate speech,
                    threats, or abusive behavior. Violations result in immediate
                    permanent account termination.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                <View className="flex-1">
                  <Text className="font-medium text-blue-600 mb-1">
                    Enhanced Reporting System
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    New tools to flag inappropriate content and block abusive
                    users, with 24-hour review by our moderation team.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                <View className="flex-1">
                  <Text className="font-medium text-green-600 mb-1">
                    Community Safety Features
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Advanced content moderation and user blocking to protect all
                    community members from harmful content.
                  </Text>
                </View>
              </View>
            </View>

            {/* Terms Summary */}
            <View className="bg-muted/30 rounded-xl p-4 mb-6">
              <Text className="font-medium mb-3">
                By accepting these terms, you agree to:
              </Text>
              <Text className="text-sm text-muted-foreground leading-relaxed">
                • Treat all community members with respect and kindness{"\n"}•
                Report any inappropriate or harmful content you encounter{"\n"}•
                Follow our community guidelines and content policies{"\n"}•
                Accept consequences for policy violations{"\n"}• Help us
                maintain a safe dining community for everyone
              </Text>
            </View>

            {/* Full Terms Link */}
            <TouchableOpacity
              onPress={handleViewFullTerms}
              className="bg-card border border-border rounded-xl p-4 mb-4"
            >
              <View className="flex-row items-center gap-3">
                <FileText size={20} color="#059669" />
                <View className="flex-1">
                  <Text className="font-medium">
                    Read Full Terms & Conditions
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    View the complete terms and community guidelines
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Scroll Reminder */}
            {!hasScrolledToBottom && (
              <View className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                <Text className="text-sm text-blue-800 dark:text-blue-200 text-center">
                  Please scroll to read all updates before accepting
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View className="p-6 border-t border-border">
            <View className="space-y-3">
              <Button
                onPress={handleAccept}
                disabled={loading || !hasScrolledToBottom}
                className="w-full"
              >
                <View className="flex-row items-center gap-2">
                  <CheckCircle size={16} color="white" />
                  <Text className="text-white font-medium">
                    {loading ? "Accepting..." : "Accept Terms & Continue"}
                  </Text>
                </View>
              </Button>

              {allowDismiss && (
                <Button
                  onPress={handleDecline}
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  <Text>I Cannot Accept These Terms</Text>
                </Button>
              )}
            </View>

            <Text className="text-xs text-muted-foreground text-center mt-3">
              By accepting, you confirm you have read and agree to our updated
              terms and community guidelines.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TermsAcceptanceModal;
