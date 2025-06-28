import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox, Alert} from "react-native";
import { useEffect, useState } from "react";
import * as Updates from "expo-updates";
import { GestureHandlerRootView } from "react-native-gesture-handler";
LogBox.ignoreAllLogs();

export default function AppLayout() {
	const { colorScheme } = useColorScheme();
	const [showUpdateAlert, setShowUpdateAlert] = useState(false);

	useEffect(() => {
		const checkForUpdates = async () => {
			try {
				const update = await Updates.checkForUpdateAsync();
				if (update.isAvailable) {
					console.log("[RootLayout] Update available, downloading...");
					const result = await Updates.fetchUpdateAsync();

					if (result.isNew) {
						setShowUpdateAlert(true);
					}
				} else {
					console.log("[RootLayout] No updates available");
				}
			} catch (error) {
				console.error("[RootLayout] Update check error:", error);
			}
		};

		checkForUpdates();
	}, []);

	// Show update alert when new update is downloaded
	useEffect(() => {
		if (showUpdateAlert) {
			Alert.alert(
				"Update Available",
				"A new version has been downloaded. Restart the app to apply the update.",
				[
					{
						text: "Later",
						style: "cancel",
						onPress: () => setShowUpdateAlert(false),
					},
					{
						text: "Restart Now",
						onPress: async () => {
							setShowUpdateAlert(false);
							await Updates.reloadAsync();
						},
					},
				]
			);
		}
	}, [showUpdateAlert]);

	return (
		<GestureHandlerRootView>
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
			
		</AuthProvider>
		</GestureHandlerRootView>
	);
} 