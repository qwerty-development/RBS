import * as React from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { Checkbox } from "@/components/ui/checkbox";
import SignUpScreenSkeleton from "@/components/skeletons/SignUpScreenSkeleton";

// Lebanese phone number validation regex
const lebanesPhoneRegex = /^(\+961|961|03|70|71|76|78|79|80|81)\d{6,7}$/;

const formSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Please enter at least 2 characters.")
      .max(50, "Please enter fewer than 50 characters.")
      .regex(
        /^[a-zA-Z\s\u0600-\u06FF\u002D\u0027]+$/,
        "Please enter a valid name.",
      ),
    email: z
      .string()
      .email("Please enter a valid email address.")
      .toLowerCase(),
    phoneNumber: z
      .string()
      .regex(lebanesPhoneRegex, "Please enter a valid Lebanese phone number.")
      .transform((val) => {
        // Normalize phone number format
        const cleaned = val.trim();
        if (
          cleaned.startsWith("03") ||
          cleaned.startsWith("7") ||
          cleaned.startsWith("8")
        ) {
          return `+961${cleaned.replace(/^0/, "")}`;
        }
        if (cleaned.startsWith("961")) {
          return `+${cleaned}`;
        }
        return cleaned;
      }),
    dateOfBirth: z
      .string()
      .min(1, "Please enter your date of birth.")
      .refine((date) => {
        const parsedDate = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - parsedDate.getFullYear();
        const monthDiff = today.getMonth() - parsedDate.getMonth();
        const dayDiff = today.getDate() - parsedDate.getDate();

        // Check if date is valid and person is at least 13 years old
        return (
          !isNaN(parsedDate.getTime()) &&
          (age > 13 ||
            (age === 13 &&
              (monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0))))
        );
      }, "You must be at least 13 years old to register."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be fewer than 128 characters.")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        "Password must contain uppercase, lowercase, number, and special character.",
      ),
    confirmPassword: z.string().min(8, "Please confirm your password."),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof formSchema>;

export default function SignUp() {
  const { signUp } = useAuth();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const isDark = colorScheme === "dark";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(data: FormData) {
    try {
      setLoading(true);
      await signUp(
        data.email,
        data.password,
        data.fullName,
        data.phoneNumber,
        data.dateOfBirth,
      );

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
    } finally {
      setLoading(false);
    }
  }

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
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormInput
                      label="Date of Birth"
                      placeholder="YYYY-MM-DD"
                      description="Must be at least 13 years old to register"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numeric"
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <View className="relative">
                      <FormInput
                        label="Password"
                        placeholder="Create a strong password"
                        description="At least 8 characters with uppercase, lowercase, number and special character"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        {...field}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-8 h-6 w-6 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showPassword ? "eye-off" : "eye"}
                          size={20}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <View className="relative">
                      <FormInput
                        label="Confirm Password"
                        placeholder="Re-enter your password"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showConfirmPassword}
                        {...field}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-8 h-6 w-6 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={showConfirmPassword ? "eye-off" : "eye"}
                          size={20}
                          color={isDark ? "#9CA3AF" : "#6B7280"}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agreeToTerms"
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
                            router.push("/legal/TERMS_OF_SERVICE");
                          }}
                        >
                          Terms and Conditions
                        </Text>{" "}
                        and{" "}
                        <Text
                          className="text-primary underline"
                          onPress={() => {
                            router.push("/legal/PRIVACY_POLICY");
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text>Create Account</Text>
              )}
            </Button>

            <View className="flex-row items-center gap-2 justify-center">
              <Text className="text-muted-foreground">
                Already have an account?
              </Text>
              <Text
                className="text-primary font-medium"
                onPress={() => {
                  router.replace("/sign-in");
                }}
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
