import React, { useState, useCallback } from "react";
import {
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Phone, CheckCircle, AlertCircle, X } from "lucide-react-native";
import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { BackHeader } from "@/components/ui/back-header";
import { H2, P } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { sendOTP, verifyOTP } from "@/hooks/usePhoneVerification";

// Common country codes for Lebanon and region
const COUNTRY_CODES = [
  { code: "+961", country: "Lebanon", flag: "🇱🇧" },
  { code: "+1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
];

interface PhoneVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
  onSkip?: () => void;
  canSkip?: boolean;
  title?: string;
  description?: string;
  initialPhoneNumber?: string; // Pre-fill phone number if available
}

export function PhoneVerificationModal({
  visible,
  onClose,
  onVerified,
  onSkip,
  canSkip = true,
  title = "Verify Your Phone",
  description = "We need to verify your phone number to enable booking features.",
  initialPhoneNumber,
}: PhoneVerificationModalProps) {
  const { colorScheme } = useColorScheme();

  // Step 1: Phone entry, Step 2: OTP verification
  const [step, setStep] = useState<"phone" | "otp">("phone");

  // Parse initial phone number if provided
  const parsePhoneNumber = (phone: string) => {
    if (!phone) return { countryCode: COUNTRY_CODES[0], number: "" };
    
    // Try to match with country codes
    for (const country of COUNTRY_CODES) {
      if (phone.startsWith(country.code)) {
        return {
          countryCode: country,
          number: phone.substring(country.code.length),
        };
      }
    }
    
    // Default to first country if no match
    return { countryCode: COUNTRY_CODES[0], number: phone };
  };

  const { countryCode: initialCountryCode, number: initialNumber } = parsePhoneNumber(initialPhoneNumber || "");

  // Phone number state
  const [selectedCountryCode, setSelectedCountryCode] = useState(initialCountryCode);
  const [phoneNumber, setPhoneNumber] = useState(initialNumber);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const phoneE164 = `${selectedCountryCode.code}${phoneNumber.replace(/^0+/, "")}`;

  const handleSendOTP = useCallback(async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setError("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await sendOTP(phoneE164);

      if (result.success) {
        setStep("otp");
        Alert.alert(
          "Code Sent",
          `A verification code has been sent to ${phoneE164}`,
          [{ text: "OK" }]
        );
      } else {
        setError(result.error || "Failed to send verification code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, phoneE164]);

  const handleVerifyOTP = useCallback(async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await verifyOTP(otpCode, phoneE164);

      if (result.success) {
        Alert.alert(
          "Success!",
          "Your phone number has been verified successfully.",
          [
            {
              text: "OK",
              onPress: () => {
                handleClose();
                onVerified();
              },
            },
          ]
        );
      } else {
        setError(result.error || "Invalid verification code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  }, [otpCode, phoneE164, onVerified]);

  const handleClose = useCallback(() => {
    // If verification is mandatory and user tries to leave, show confirmation
    if (!canSkip) {
      Alert.alert(
        "Exit Verification?",
        "You'll need to verify your phone number to make bookings. You can complete this later from your profile.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Exit",
            onPress: () => {
              setStep("phone");
              setPhoneNumber("");
              setOtpCode("");
              setError("");
              onClose();
            },
          },
        ]
      );
      return;
    }
    
    // Can skip - close immediately
    setStep("phone");
    setPhoneNumber("");
    setOtpCode("");
    setError("");
    onClose();
  }, [onClose, canSkip]);

  const handleSkip = useCallback(() => {
    handleClose();
    onSkip?.();
  }, [handleClose, onSkip]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={canSkip ? handleClose : undefined}
    >
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {canSkip ? (
            <BackHeader 
              title="Verify Phone" 
              onBackPress={handleClose}
            />
          ) : (
            <View className="px-4 pt-4 pb-2">
              <View className="flex-row items-center justify-end">
                <Pressable
                  onPress={handleClose}
                  className="p-2 rounded-full bg-muted"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="p-6">
              {/* Icon */}
              <View className="items-center mb-6">
                <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center">
                  <Phone size={40} color="#792339" />
                </View>
              </View>

              {/* Content */}
              <H2 className="text-center mb-3">{title}</H2>
              <P className="text-center text-muted-foreground mb-8">
                {description}
              </P>

              {/* Phone Entry Step */}
              {step === "phone" && (
                <View className="gap-4">
                  {/* Country Code Selector */}
                  <View>
                    <Text className="text-sm font-medium mb-2">
                      Country Code <Text className="text-muted-foreground text-xs">(tap to change)</Text>
                    </Text>
                    <Pressable
                      onPress={() => setShowCountryPicker(!showCountryPicker)}
                      className="flex-row items-center justify-between p-4 bg-card border-2 border-border rounded-lg"
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.8 : 1,
                        borderColor: showCountryPicker ? "#792339" : undefined,
                      })}
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-2xl">{selectedCountryCode.flag}</Text>
                        <Text className="font-medium text-base">
                          {selectedCountryCode.code}
                        </Text>
                        <Text className="text-muted-foreground">
                          {selectedCountryCode.country}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Country Picker Dropdown */}
                    {showCountryPicker && (
                      <View className="mt-2 bg-card border-2 border-primary rounded-lg overflow-hidden" style={{ maxHeight: 240 }}>
                        <ScrollView nestedScrollEnabled={true}>
                          {COUNTRY_CODES.map((country) => (
                            <Pressable
                              key={country.code}
                              onPress={() => {
                                setSelectedCountryCode(country);
                                setShowCountryPicker(false);
                              }}
                              className="flex-row items-center gap-3 p-4 border-b border-border/50"
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                              })}
                            >
                              <Text className="text-3xl">{country.flag}</Text>
                              <Text className="font-semibold text-base">{country.code}</Text>
                              <Text className="text-muted-foreground flex-1 text-base">
                                {country.country}
                              </Text>
                              {selectedCountryCode.code === country.code && (
                                <CheckCircle size={22} color="#792339" />
                              )}
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Phone Number Input */}
                  <View>
                    <Text className="text-sm font-medium mb-2">Phone Number</Text>
                    <View className="flex-row items-center bg-card border-2 border-border rounded-lg px-4">
                      <Text className="text-muted-foreground mt-1 text-base">
                        {selectedCountryCode.code}
                      </Text>
                      <TextInput
                        value={phoneNumber}
                        onChangeText={(text) => {
                          setPhoneNumber(text.replace(/[^0-9]/g, ""));
                          setError("");
                        }}
                        placeholder="70 123 456"
                        placeholderTextColor={
                          colorScheme === "dark" ? "#666" : "#999"
                        }
                        keyboardType="phone-pad"
                        maxLength={15}
                        className="flex-1 py-4 px-3 text-foreground text-base"
                        editable={!loading}
                        returnKeyType="done"
                      />
                    </View>
                    <Text className="text-xs text-muted-foreground mt-1">
                      Enter your number without the country code
                    </Text>
                  </View>

                  {/* Error Message */}
                  {error && (
                    <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <AlertCircle size={20} color="#ef4444" />
                      <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="gap-3 mt-2">
                    <Button
                      onPress={handleSendOTP}
                      disabled={loading || !phoneNumber}
                      size="lg"
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="font-bold text-white">Send Verification Code</Text>
                      )}
                    </Button>
                    {canSkip && (
                      <Button onPress={handleSkip} variant="outline" size="lg">
                        <Text>Skip for Now</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )}

              {/* OTP Verification Step */}
              {step === "otp" && (
                <View className="gap-4">
                  <View className="bg-muted/50 rounded-lg p-4 mb-2">
                    <Text className="text-sm text-center text-muted-foreground">
                      Code sent to
                    </Text>
                    <Text className="text-center font-medium mt-1 text-base">
                      {phoneE164}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setStep("phone");
                        setOtpCode("");
                        setError("");
                      }}
                      className="mt-2"
                    >
                      <Text className="text-sm text-primary text-center">
                        Change Number
                      </Text>
                    </Pressable>
                  </View>

                  {/* OTP Input */}
                  <View>
                    <Text className="text-sm font-medium mb-2">
                      Verification Code
                    </Text>
                    <TextInput
                      value={otpCode}
                      onChangeText={(text) => {
                        setOtpCode(text.replace(/[^0-9]/g, ""));
                        setError("");
                      }}
                      placeholder="000000"
                      placeholderTextColor={
                        colorScheme === "dark" ? "#666" : "#999"
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                      className="py-4 px-4 bg-card border-2 border-border rounded-lg text-foreground text-center text-2xl tracking-widest"
                      editable={!loading}
                      autoFocus
                      returnKeyType="done"
                    />
                    <Text className="text-xs text-muted-foreground mt-1 text-center">
                      Enter the 6-digit code sent to your phone
                    </Text>
                  </View>

                  {/* Error Message */}
                  {error && (
                    <View className="flex-row items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <AlertCircle size={20} color="#ef4444" />
                      <Text className="flex-1 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View className="gap-3 mt-2">
                    <Button
                      onPress={handleVerifyOTP}
                      disabled={loading || otpCode.length !== 6}
                      size="lg"
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text className="font-bold text-white">Verify</Text>
                      )}
                    </Button>
                    <Button
                      onPress={handleSendOTP}
                      variant="ghost"
                      size="lg"
                      disabled={loading}
                    >
                      <Text>Resend Code</Text>
                    </Button>
                    {canSkip && (
                      <Button onPress={handleSkip} variant="outline" size="lg">
                        <Text>Skip for Now</Text>
                      </Button>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

