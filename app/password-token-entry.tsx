import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert, TouchableOpacity } from "react-native";
import * as z from "zod";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";

const formSchema = z
  .object({
    token: z.string().min(1, "Token is required."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function PasswordTokenEntry() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      if (!email) {
        throw new Error("Email is required.");
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: data.token,
        type: "recovery",
      });

      if (verifyError) {
        throw verifyError;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert("Success", "Your password has been updated successfully.", [
        { text: "OK", onPress: () => router.push("/sign-in") },
      ]);
    } catch (error: any) {
      let errorMessage = "An error occurred. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendToken() {
    try {
      setIsResending(true);
      if (!email) {
        throw new Error("Email is required.");
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        throw error;
      }
      Alert.alert("Token Resent", "A new password reset token has been sent to your email.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background p-4 mt-8" edges={["bottom"]}>
      <View className="flex-1 gap-4 web:m-4">
        <View>
          <H1 className="self-start">Enter Token</H1>
          <P className="text-muted-foreground mt-2">
            Enter the token from your email and set a new password.
          </P>
        </View>

        <Form {...form}>
          <View className="gap-4">
            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormInput
                  label="Token"
                  placeholder="Enter the token from your email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  {...field}
                />
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormInput
                  label="New Password"
                  placeholder="Enter your new password"
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
                  label="Confirm New Password"
                  placeholder="Confirm your new password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  {...field}
                />
              )}
            />
          </View>
        </Form>

        <TouchableOpacity onPress={handleResendToken} disabled={isResending} className="mt-4">
          <Text className="text-primary font-medium self-center">
            {isResending ? <ActivityIndicator size="small" /> : "Resend Token"}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="gap-4 web:m-4">
        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isLoading || isResending}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Update Password</Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
