import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, ActivityIndicator, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from 'expo-apple-authentication';

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H1, Muted } from "@/components/ui/typography";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";

export default function WelcomeScreen() {
	const router = useRouter();
	const { colorScheme } = useColorScheme();
	const { appleSignIn, googleSignIn } = useAuth();
	const isDark = colorScheme === "dark";
	
	const [isAppleLoading, setIsAppleLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);
	const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
	
	const appIcon =
		colorScheme === "dark"
			? require("@/assets/icon.png")
			: require("@/assets/icon-dark.png");

	// Check if Apple Authentication is available
	useEffect(() => {
		const checkAppleAuthAvailability = async () => {
			if (Platform.OS === 'ios') {
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

	// Handle Apple Sign In
	const handleAppleSignIn = async () => {
		try {
			setIsAppleLoading(true);
			const { error, needsProfileUpdate } = await appleSignIn();
			
			if (error) {
				if (error.message !== 'User canceled Apple sign-in') {
					Alert.alert("Sign In Error", error.message || "Apple sign in failed.");
				}
			}
			// Navigation handled by AuthContext
		} catch (err: any) {
			console.error("Apple sign in error:", err);
			Alert.alert("Sign In Error", err.message || "Failed to sign in with Apple.");
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
				if (error.message !== 'User canceled Google sign-in') {
					Alert.alert("Sign In Error", error.message || "Google sign in failed.");
				}
			}
			// Navigation handled by AuthContext
		} catch (err: any) {
			console.error("Google sign in error:", err);
			Alert.alert("Sign In Error", err.message || "Failed to sign in with Google.");
		} finally {
			setIsGoogleLoading(false);
		}
	};

	return (
		<SafeAreaView className="flex flex-1 bg-background p-4">
			<View className="flex flex-1 items-center justify-center gap-y-4 web:m-4">
				<Image source={appIcon} className="w-16 h-16 rounded-xl" />
				<H1 className="text-center">Welcome to Booklet</H1>
				<Muted className="text-center">
					Discover and book amazing restaurants in Lebanon with just a few taps
				</Muted>
			</View>
			<View className="flex flex-col gap-y-4 web:m-4">
				{/* Quick Sign In Options */}
				<View className="gap-3 mb-4">
					{Platform.OS === 'ios' && appleAuthAvailable && (
						<TouchableOpacity
							onPress={handleAppleSignIn}
							disabled={isAppleLoading || isGoogleLoading}
						>
							<View className="bg-foreground rounded-md h-14 items-center justify-center flex-row gap-2">
								{isAppleLoading ? (
									<ActivityIndicator size="small" color={isDark ? "#000" : "#fff"} />
								) : (
									<>
										<Ionicons name="logo-apple" size={24} color={isDark ? "#000" : "#fff"} />
										<Text className={`${isDark ? "text-black" : "text-white"} font-semibold text-base`}>
											Continue with Apple
										</Text>
									</>
								)}
							</View>
						</TouchableOpacity>
					)}
					
					<TouchableOpacity
						onPress={handleGoogleSignIn}
						disabled={isGoogleLoading || isAppleLoading}
					>
						<View className="bg-background border-2 border-border rounded-md h-14 items-center justify-center flex-row gap-2">
							{isGoogleLoading ? (
								<ActivityIndicator size="small" color={isDark ? "#fff" : "#000"} />
							) : (
								<>
									<Ionicons name="logo-google" size={24} color="#EA4335" />
									<Text className="text-foreground font-semibold text-base">
										Continue with Google
									</Text>
								</>
							)}
						</View>
					</TouchableOpacity>
				</View>

				{/* Divider */}
				<View className="flex-row items-center mb-2">
					<View className="flex-1 h-px bg-border/30" />
					<Text className="mx-4 text-sm text-muted-foreground">or</Text>
					<View className="flex-1 h-px bg-border/30" />
				</View>

				{/* Email Options */}
				<Button
					size="default"
					variant="default"
					onPress={() => {
						router.push("/sign-up");
					}}
					disabled={isAppleLoading || isGoogleLoading}
				>
					<Text>Sign Up with Email</Text>
				</Button>
				<Button
					size="default"
					variant="secondary"
					onPress={() => {
						router.push("/sign-in");
					}}
					disabled={isAppleLoading || isGoogleLoading}
				>
					<Text>Sign In with Email</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}