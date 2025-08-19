import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert } from "react-native";
import * as z from "zod";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1, P } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

export default function PasswordReset() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });
  const { from } = useLocalSearchParams<{ from?: string }>();

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(data.email);

      if (error) {
        throw error;
      }

      Alert.alert(
        "Password Reset",
        "A password reset token has been sent to your email.",
        [
          {
            text: "OK",
            onPress: () =>
              router.push({
                pathname: "/password-token-entry",
                params: { email: data.email },
              }),
          },
        ]
      );
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

  return (
    <SafeAreaView className="flex-1 bg-background p-4" edges={["top", "bottom"]}>
      <View className="flex-1 gap-4 web:m-4">
        <View>
          <H1 className="self-start">Reset Password</H1>
          <P className="text-muted-foreground mt-2">
            Enter your email to receive a password reset link.
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
          </View>
        </Form>
      </View>

      <View className="gap-4 web:m-4">
        <Button
          size="default"
          variant="default"
          onPress={form.handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text>Send Reset Link</Text>
          )}
        </Button>

        {from === "sign-in" && (
          <View className="flex-row items-center gap-2 justify-center mt-2">
            <Text
              className="text-primary font-medium"
              onPress={() => router.replace("/sign-in")}
            >
              Back to Sign In
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
