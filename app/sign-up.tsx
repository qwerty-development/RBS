import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from "react-native";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { Checkbox } from "@/components/ui/checkbox";
import SignUpScreenSkeleton from "@/components/skeletons/SignUpScreenSkeleton";
import { useColorScheme } from "@/lib/useColorScheme";

// Lebanese phone number validation regex
const lebanesPhoneRegex = /^(\+961|961|03|70|71|76|78|79|80|81)\d{6,7}$/;

const formSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Please enter at least 2 characters.")
      .max(50, "Please enter fewer than 50 characters.")
      .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid name."),
    email: z
      .string()
      .email("Please enter a valid email address.")
      .toLowerCase(),
    phoneNumber: z
      .string()
      .regex(lebanesPhoneRegex, "Please enter a valid Lebanese phone number.")
      .transform((val) => {
        // Normalize phone number format
        if (
          val.startsWith("03") ||
          val.startsWith("7") ||
          val.startsWith("8")
        ) {
          return `+961${val.replace(/^0/, "")}`;
        }
        if (val.startsWith("961")) {
          return `+${val}`;
        }
        return val;
      }),
    password: z
      .string()
      .min(8, "Please enter at least 8 characters.")
      .max(64, "Please enter fewer than 64 characters.")
      .regex(
        /^(?=.*[a-z])/,
        "Your password must have at least one lowercase letter.",
      )
      .regex(
        /^(?=.*[A-Z])/,
        "Your password must have at least one uppercase letter.",
      )
      .regex(/^(?=.*[0-9])/, "Your password must have at least one number.")
      .regex(
        /^(?=.*[!@#$%^&*])/,
        "Your password must have at least one special character.",
      ),
    confirmPassword: z.string().min(8, "Please enter at least 8 characters."),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Your passwords do not match.",
    path: ["confirmPassword"],
  });

export default function SignUp() {
  const { signUp, loading, googleSignIn, appleSignIn } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      await signUp(data.email, data.password, data.fullName, data.phoneNumber);

      // Success - navigation handled by AuthContext
      form.reset();
    } catch (error: any) {
      console.error(error.message);

      // Show user-friendly error messages
      let errorMessage = "An error occurred during sign up.";

      if (error.message?.includes("already registered")) {
        errorMessage =
          "This email is already registered. Please sign in instead.";
      } else if (error.message?.includes("weak password")) {
        errorMessage = "Please choose a stronger password.";
      } else if (error.message?.includes("invalid email")) {
        errorMessage = "Please enter a valid email address.";
      }

      Alert.alert("Sign Up Error", errorMessage);
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true);
      const { error, needsProfileUpdate } = await googleSignIn();
      if (error) {
        Alert.alert("Sign Up Error", error.message);
      } else if (needsProfileUpdate) {
        router.replace("/(protected)/profile");
      } else {
        router.replace("/(protected)/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Sign Up Error", err.message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    try {
      setIsAppleLoading(true);
      const { error, needsProfileUpdate } = await appleSignIn();
      if (error) {
        Alert.alert("Sign Up Error", error.message);
      } else if (needsProfileUpdate) {
        router.replace("/(protected)/profile");
      } else {
        router.replace("/(protected)/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Sign Up Error", err.message);
    } finally {
      setIsAppleLoading(false);
    }
  };

  if (loading) {
    return <SignUpScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 gap-4 p-4 web:m-4">
            <View>
              <H1 className="self-start">Create Account</H1>
              <P className="text-muted-foreground mt-2">
                Join thousands discovering great restaurants in Lebanon
              </P>
            </View>

            <Form {...form}>
              <View className="gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormInput
                      label="Full Name"
                      placeholder="John Doe"
                      autoCapitalize="words"
                      autoComplete="name"
                      autoCorrect={false}
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormInput
                      label="Email"
                      placeholder="john@example.com"
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
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormInput
                      label="Phone Number"
                      placeholder="03 123 456 or 71 234 567"
                      description="Lebanese mobile number for booking confirmations"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="phone-pad"
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
                      placeholder="Create a strong password"
                      description="At least 8 characters with uppercase, lowercase, number and special character"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormInput
                      label="Confirm Password"
                      placeholder="Re-enter your password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <View className="flex-row items-start gap-2 px-1">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-1"
                      />
                      <Text className="flex-1 text-sm text-muted-foreground">
                        I agree to the{" "}
                        <Text
                          className="text-primary underline"
                          onPress={() => {
                            // Open terms and conditions
                          }}
                        >
                          Terms and Conditions
                        </Text>{" "}
                        and{" "}
                        <Text
                          className="text-primary underline"
                          onPress={() => {
                            // Open privacy policy
                          }}
                        >
                          Privacy Policy
                        </Text>
                      </Text>
                    </View>
                  )}
                />
              </View>
            </Form>
          </View>

          <View className="p-4 web:m-4 gap-4">
            <Button
              size="default"
              variant="default"
              onPress={form.handleSubmit(onSubmit)}
              disabled={form.formState.isSubmitting || isGoogleLoading || isAppleLoading}
            >
              {form.formState.isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text>Create Account</Text>
              )}
            </Button>

            <View className="items-center">
              <View className="flex-row items-center w-full mb-4">
                <View className="flex-1 h-px bg-border/30" />
                <Text className="mx-4 text-sm text-muted-foreground">
                  or continue with
                </Text>
                <View className="flex-1 h-px bg-border/30" />
              </View>

              <View className="flex-row gap-3 w-full">
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    onPress={handleAppleSignUp}
                    disabled={isAppleLoading || form.formState.isSubmitting}
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

                <TouchableOpacity
                  onPress={handleGoogleSignUp}
                  disabled={isGoogleLoading || form.formState.isSubmitting}
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
              </View>
            </View>

            <View className="flex-row items-center gap-2 justify-center">
              <Text className="text-muted-foreground">
                Already have an account?
              </Text>
              <Text
                className="text-primary font-medium"
                onPress={() => router.push("/sign-in")}
              >
                Sign In
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
