import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, View, Text, ActivityIndicator, Alert } from "react-native";
import { useEffect, useState } from "react";
import * as Updates from "expo-updates";

// Filter out known development warnings
LogBox.ignoreLogs([
	"Setting a timer",
	"Non-serializable values were found in the navigation state",
	"Warning: Failed prop type: Invalid prop `children` of type `object` supplied to `TabBarLabel`, expected `node`.",
	"Require cycle:", // Common in React Native development
]);

export default function AppLayout() {
	const { colorScheme } = useColorScheme();
	const [isUpdating, setIsUpdating] = useState(false);
	const [updateStatus, setUpdateStatus] = useState<string>("");

	useEffect(() => {
		const checkForUpdates = async () => {
			try {
				// Only check for updates in production builds
				if (!Updates.isEnabled) {
					console.log('Updates not enabled - running in development');
					return;
				}

				console.log('Checking for updates...');
				setUpdateStatus("Checking for updates...");

				const update = await Updates.checkForUpdateAsync();
				
				if (update.isAvailable) {
					console.log('Update available, downloading...');
					setIsUpdating(true);
					setUpdateStatus("Downloading update...");

					await Updates.fetchUpdateAsync();
					
					console.log('Update downloaded, reloading app...');
					setUpdateStatus("Update ready, reloading...");
					
					// Small delay to show the message
					setTimeout(async () => {
						await Updates.reloadAsync();
					}, 1000);
				} else {
					console.log('No updates available');
					setUpdateStatus("");
				}
			} catch (error) {
				console.error('Error checking for updates:', error);
				setIsUpdating(false);
				setUpdateStatus("");
				
				// Only show alert for critical update errors
				if (error instanceof Error && error.message.includes('network')) {
					// Network errors are common, don't alert user
					console.warn('Network error while checking for updates');
				} else {
					Alert.alert(
						'Update Error',
						'Failed to check for app updates. Please ensure you have an internet connection.',
						[{ text: 'OK' }]
					);
				}
			}
		};

		// Check for updates when app starts
		checkForUpdates();

		// Listen for update events
		const subscription = Updates.addListener((event) => {
			if (event.type === Updates.UpdateEventType.ERROR) {
				console.error('Update error:', event.message);
				setIsUpdating(false);
				setUpdateStatus("");
			} else if (event.type === Updates.UpdateEventType.NO_UPDATE_AVAILABLE) {
				console.log('No update available');
				setUpdateStatus("");
			} else if (event.type === Updates.UpdateEventType.UPDATE_AVAILABLE) {
				console.log('Update available');
				setUpdateStatus("Update available, downloading...");
			}
		});

		return () => {
			subscription?.remove();
		};
	}, []);

	// Show update overlay when updating
	if (isUpdating) {
		return (
			<View style={{ 
				flex: 1, 
				justifyContent: 'center', 
				alignItems: 'center',
				backgroundColor: colorScheme === 'dark' ? '#000' : '#fff'
			}}>
				<ActivityIndicator 
					size="large" 
					color={colorScheme === 'dark' ? '#fff' : '#000'} 
				/>
				<Text style={{ 
					marginTop: 16, 
					fontSize: 16,
					color: colorScheme === 'dark' ? '#fff' : '#000'
				}}>
					{updateStatus}
				</Text>
				<Text style={{ 
					marginTop: 8, 
					fontSize: 14,
					color: colorScheme === 'dark' ? '#ccc' : '#666',
					textAlign: 'center',
					paddingHorizontal: 32
				}}>
					Please don't close the app while updating
				</Text>
			</View>
		);
	}

	return (
		<AuthProvider>
			<Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
				<Stack.Screen name="(protected)" />
				<Stack.Screen name="welcome" />
				<Stack.Screen
					name="sign-up"
					options={{
						presentation: "modal",
						headerShown: true,
						headerTitle: "Sign Up",
						headerStyle: {
							backgroundColor:
								colorScheme === "dark"
									? colors.dark.background
									: colors.light.background,
						},
						headerTintColor:
							colorScheme === "dark"
								? colors.dark.foreground
								: colors.light.foreground,
						gestureEnabled: true,
					}}
				/>
				<Stack.Screen
					name="sign-in"
					options={{
						presentation: "modal",
						headerShown: true,
						headerTitle: "Sign In",
						headerStyle: {
							backgroundColor:
								colorScheme === "dark"
									? colors.dark.background
									: colors.light.background,
						},
						headerTintColor:
							colorScheme === "dark"
								? colors.dark.foreground
								: colors.light.foreground,
						gestureEnabled: true,
					}}
				/>
			</Stack>
			
			{/* Show update status at bottom when checking */}
			{updateStatus && !isUpdating && (
				<View style={{
					position: 'absolute',
					bottom: 50,
					left: 20,
					right: 20,
					backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
					padding: 12,
					borderRadius: 8,
					alignItems: 'center'
				}}>
					<Text style={{
						color: colorScheme === 'dark' ? '#fff' : '#000',
						fontSize: 12
					}}>
						{updateStatus}
					</Text>
				</View>
			)}
		</AuthProvider>
	);
}