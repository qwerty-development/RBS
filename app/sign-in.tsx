import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  View,
  Alert,
  Platform,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useColorScheme } from "@/lib/useColorScheme";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(64, "Please enter fewer than 64 characters."),
});

export default function SignIn() {
  const { signIn, appleSignIn, googleSignIn } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === "dark";

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { authenticate } = useBiometricAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const loadRememberedEmail = async () => {
      const rememberedEmail = await AsyncStorage.getItem("rememberedEmail");
      if (rememberedEmail) {
        form.setValue("email", rememberedEmail);
        setRememberMe(true);
      }
    };
    loadRememberedEmail();
  }, [form]);

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      if (Platform.OS === "ios") {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          setAppleAuthAvailable(isAvailable);
        } catch {
          setAppleAuthAvailable(false);
        }
      }
    };

    checkAppleAuthAvailability();
  }, []);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsEmailLoading(true);
      console.log("🔄 Starting sign-in process...");
      await signIn(data.email, data.password);
      if (rememberMe) {
        await AsyncStorage.setItem("rememberedEmail", data.email);
      } else {
        await AsyncStorage.removeItem("rememberedEmail");
      }
      // Redirect to the protected home/tabs stack after successful sign-in
      router.replace("/(protected)/(tabs)");
      console.log("✅ Sign-in successful");
      form.reset();
    } catch (error: any) {
      console.error("❌ Sign-in error:", error);

      // Show user-friendly error messages
      let errorMessage = "An error occurred during sign in.";

      if (error.message?.includes("Invalid login credentials")) {
        errorMessage =
          "Invalid email or password. Please check your credentials and try again.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage =
          "Please check your email and confirm your account before signing in.";
      } else if (error.message?.includes("Too many requests")) {
        errorMessage =
          "Too many sign-in attempts. Please wait a moment and try again.";
      } else if (error.message?.includes("Network")) {
        errorMessage =
          "Network error. Please check your internet connection and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert("Sign In Error", errorMessage, [
        { text: "OK", style: "default" },
      ]);
    } finally {
      setIsEmailLoading(false);
    }
  }

  // Handle Apple Sign In
  const handleAppleSignIn = async () => {
    try {
      setIsAppleLoading(true);
      const { error, needsProfileUpdate } = await appleSignIn();

      if (error) {
        if (error.message !== "User canceled Apple sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Apple sign in failed.",
          );
        }
      } else if (needsProfileUpdate) {
        // Navigate to profile completion if needed
        console.log("Profile needs updating after Apple sign in");
      } else {
        // Successful Apple sign-in, navigate to protected home
        router.replace("/(protected)/(tabs)");
      }
    } catch (err: any) {
      console.error("Apple sign in error:", err);
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Apple.",
      );
    } finally {
      setIsAppleLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const { error, needsProfileUpdate } = await googleSignIn();

      if (error) {
        if (error.message !== "User canceled Google sign-in") {
          Alert.alert(
            "Sign In Error",
            error.message || "Google sign in failed.",
          );
        }
      } else if (needsProfileUpdate) {
        // Navigate to profile completion if needed
        console.log("Profile needs updating after Google sign in");
      } else {
        // Successful Google sign-in, navigate to protected home
        router.replace("/(protected)/(tabs)");
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      Alert.alert(
        "Sign In Error",
        err.message || "Failed to sign in with Google.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    try {
      setIsBiometricLoading(true);
      const result = await authenticate();
      if (result.success) {
        // You would typically have a saved credential to use here
        Alert.alert("Biometric Success", "You would be signed in now.");
        router.replace("/(protected)/(tabs)");
      } else {
        Alert.alert("Biometric Failed", result.error);
      }
    } catch (err: any) {
      Alert.alert("Biometric Error", err.message);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20} // adjust as needed
      >
        <View className="flex-1 gap-4 web:m-4">
          <View>
            <H1 className="self-start">Welcome Back</H1>
            <P className="text-muted-foreground mt-2">
              Sign in to discover and book amazing restaurants
            </P>
          </View>

          <Form {...form}>
            <View className="gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormInput
                    label="Email"
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    {...field}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormInput
                    label="Password"
                    placeholder="Enter your password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    {...field}
                  />
                )}
              />
              <View className="flex-row justify-between items-center mt-2">
                <View className="flex-row items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={() => setRememberMe(!rememberMe)}
                  />
                  <Text>Remember Me</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/password-reset")}
                  className="self-end"
                >
                  <Text className="text-primary font-medium">Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Form>
        </View>

        <View className="gap-4 web:m-4">
          <Button
            size="default"
            variant="default"
            onPress={form.handleSubmit(onSubmit)}
            disabled={isEmailLoading || isAppleLoading || isGoogleLoading || isBiometricLoading}
          >
            {isEmailLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text>Sign In</Text>
            )}
          </Button>

          {/* Social Sign In Section */}
          <View className="items-center">
            <View className="flex-row items-center w-full mb-4">
              <View className="flex-1 h-px bg-border/30" />
              <Text className="mx-4 text-sm text-muted-foreground">
                or continue with
              </Text>
              <View className="flex-1 h-px bg-border/30" />
            </View>

            <View className="flex-row gap-3 w-full">
              {/* Apple Sign In Button */}
              {Platform.OS === "ios" && appleAuthAvailable && (
                <TouchableOpacity
                  onPress={handleAppleSignIn}
                  disabled={isAppleLoading || isEmailLoading || isGoogleLoading || isBiometricLoading}
                  className="flex-1"
                >
                  <View className="bg-foreground rounded-md h-12 items-center justify-center flex-row gap-2">
                    {isAppleLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? "#000" : "#fff"}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="logo-apple"
                          size={20}
                          color={isDark ? "#000" : "#fff"}
                        />
                        <Text
                          className={
                            isDark
                              ? "text-black font-medium"
                              : "text-white font-medium"
                          }
                        >
                          Apple
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {/* Google Sign In Button */}
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={isGoogleLoading || isEmailLoading || isAppleLoading || isBiometricLoading}
                className="flex-1"
              >
                <View className="bg-background border border-border rounded-md h-12 items-center justify-center flex-row gap-2">
                  {isGoogleLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#fff" : "#000"}
                    />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#EA4335" />
                      <Text className="text-foreground font-medium">Google</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Biometric Sign In Button */}
              <TouchableOpacity
                onPress={handleBiometricSignIn}
                disabled={isBiometricLoading || isEmailLoading || isAppleLoading || isGoogleLoading}
                className="flex-1"
              >
                <View className="bg-background border border-border rounded-md h-12 items-center justify-center flex-row gap-2">
                  {isBiometricLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isDark ? "#fff" : "#000"}
                    />
                  ) : (
                    <>
                      <Ionicons name="finger-print" size={20} color={isDark ? "#fff" : "#000"} />
                      <Text className="text-foreground font-medium">Biometric</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row items-center gap-2 justify-center mt-2">
            <Text className="text-muted-foreground">Don't have an account?</Text>
            <Text
              className="text-primary font-medium"
              onPress={() => router.push("/sign-up")}
            >
              Sign Up
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
