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
import {
  formatDDMMYYYYInput,
  isValidDDMMYYYYFormat,
  convertDDMMYYYYToYYYYMMDD,
} from "@/utils/birthday";

// Lebanese phone number validation regex
const lebanesPhoneRegex = /^(\+961|961|03|70|71|76|78|79|80|81)\d{6,7}$/;

const formSchema = z
  .object({
    first_name: z
      .string()
      .min(1, "First name is required")
      .max(25, "First name must be less than 25 characters")
      .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid first name"),
    last_name: z
      .string()
      .min(1, "Last name is required")
      .max(25, "Last name must be less than 25 characters")
      .regex(/^[a-zA-Z\s\u0600-\u06FF]+$/, "Please enter a valid last name"),
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
        return isValidDDMMYYYYFormat(date);
      }, "Please enter a valid date in DD-MM-YYYY format.")
      .refine((date) => {
        // Convert DD-MM-YYYY to YYYY-MM-DD for validation
        const yyyymmddFormat = convertDDMMYYYYToYYYYMMDD(date);
        const parsedDate = new Date(yyyymmddFormat);
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
      first_name: "",
      last_name: "",
      email: "",
      phoneNumber: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(data: FormData) {
    // Check if user agreed to terms
    if (!data.agreeToTerms) {
      Alert.alert(
        "Terms Required",
        "You must agree to the Terms and Conditions and Privacy Policy to create an account.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    try {
      setLoading(true);
      // Convert DD-MM-YYYY to YYYY-MM-DD for database storage
      const dobForDatabase = convertDDMMYYYYToYYYYMMDD(data.dateOfBirth);

      // Combine first and last name into full name
      const fullName =
        `${data.first_name.trim()} ${data.last_name.trim()}`.trim();

      await signUp(
        data.email,
        data.password,
        fullName,
        data.phoneNumber,
        dobForDatabase,
        data.first_name.trim(),
        data.last_name.trim(),
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
    <SafeAreaView className="flex-1 bg-primary" edges={["top", "bottom"]}>
      {/* Fixed Header */}
      <View className="p-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#fff" : "#000"}
            />
          </TouchableOpacity>
          <View className="flex-1">
            <H1 className="self-start text-white">Create Account</H1>
            <P className="text-white/90 mt-2">
              Join thousands discovering great restaurants in Lebanon
            </P>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 gap-4">

            <Form {...form}>
              <View className="gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormInput
                      label="First Name"
                      placeholder="John"
                      autoCapitalize="words"
                      autoComplete="given-name"
                      autoCorrect={false}
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                    />
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormInput
                      label="Last Name"
                      placeholder="Doe"
                      autoCapitalize="words"
                      autoComplete="family-name"
                      autoCorrect={false}
                      className="bg-gray-100 dark:bg-gray-800"
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
                      className="bg-gray-100 dark:bg-gray-800"
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
                      className="bg-gray-100 dark:bg-gray-800"
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
                      placeholder="DD-MM-YYYY"
                      description="Must be at least 13 years old to register"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numeric"
                      className="bg-gray-100 dark:bg-gray-800"
                      {...field}
                      onChangeText={(value) => {
                        const formattedValue = formatDDMMYYYYInput(value);
                        field.onChange(formattedValue);
                      }}
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
                        className="bg-gray-100 dark:bg-gray-800"
                        {...field}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
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
                        className="bg-gray-100 dark:bg-gray-800"
                        {...field}
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-11 h-6 w-6 items-center justify-center"
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
                      <TouchableOpacity
                        onPress={() => field.onChange(!field.value)}
                        className="h-4 w-4 rounded border items-center justify-center mt-1"
                        style={{
                          borderColor: isDark ? "#fff" : "#000",
                          backgroundColor: field.value ? (isDark ? "#fff" : "#000") : "transparent"
                        }}
                      >
                        {field.value && (
                          <Ionicons 
                            name="checkmark" 
                            size={12} 
                            color={isDark ? "#000" : "#fff"} 
                          />
                        )}
                      </TouchableOpacity>
                      <Text className="flex-1 text-xs text-white/70 leading-4">
                        I agree to the{" "}
                        <Text
                          className="text-white/90 underline"
                          onPress={() => {
                            router.push("/legal/TERMS_OF_SERVICE");
                          }}
                        >
                          Terms and Conditions
                        </Text>{" "}
                        and{" "}
                        <Text
                          className="text-white/90 underline"
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

          <View className="gap-4 p-4">
            <TouchableOpacity
              onPress={form.handleSubmit(onSubmit)}
              disabled={form.formState.isSubmitting}
              className={`h-14 rounded-lg items-center justify-center ${
                form.formState.isSubmitting ? "opacity-50" : ""
              }`}
              activeOpacity={0.7}
              style={{ backgroundColor: "#000", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
            >
              {form.formState.isSubmitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="font-medium text-white">Create Account</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center gap-2 justify-center">
              <Text className="text-white/80">
                Already have an account?
              </Text>
              <Text
                className="text-white font-medium"
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
