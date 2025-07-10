import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ActivityIndicator, View, Alert } from "react-native";
import * as z from "zod";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormInput } from "@/components/ui/form";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useAuth } from "@/context/supabase-provider";
import SignInScreenSkeleton from '@/components/skeletons/SignInScreenSkeleton';

const formSchema = z.object({
	email: z.string().email("Please enter a valid email address."),
	password: z
		.string()
		.min(1, "Password is required.")
		.max(64, "Please enter fewer than 64 characters."),
});



export default function SignIn() {
	const { signIn, loading } = useAuth();



	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: z.infer<typeof formSchema>) {
		try {
			console.log('🔄 Starting sign-in process...');
			await signIn(data.email, data.password);
			console.log('✅ Sign-in successful');
			form.reset();
		} catch (error: any) {
			console.error('❌ Sign-in error:', error);
			
			// Show user-friendly error messages
			let errorMessage = "An error occurred during sign in.";
			
			if (error.message?.includes("Invalid login credentials")) {
				errorMessage = "Invalid email or password. Please check your credentials and try again.";
			} else if (error.message?.includes("Email not confirmed")) {
				errorMessage = "Please check your email and confirm your account before signing in.";
			} else if (error.message?.includes("Too many requests")) {
				errorMessage = "Too many sign-in attempts. Please wait a moment and try again.";
			} else if (error.message?.includes("Network")) {
				errorMessage = "Network error. Please check your internet connection and try again.";
			} else if (error.message) {
				errorMessage = error.message;
			}
			
			Alert.alert("Sign In Error", errorMessage, [
				{ text: "OK", style: "default" }
			]);
		}
	}

  if (loading) {
    return <SignInScreenSkeleton />;
  }
	return (
		<SafeAreaView className="flex-1 bg-background p-4" edges={["bottom"]}>
			<View className="flex-1 gap-4 web:m-4">
				<H1 className="self-start">Sign In</H1>
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
					</View>
				</Form>
			</View>
			<Button
				size="default"
				variant="default"
				onPress={form.handleSubmit(onSubmit)}
				disabled={form.formState.isSubmitting}
				className="web:m-4"
			>
				{form.formState.isSubmitting ? (
					<ActivityIndicator size="small" color="white" />
				) : (
					<Text>Sign In</Text>
				)}
			</Button>
		</SafeAreaView>
	);
}