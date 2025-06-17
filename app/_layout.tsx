import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { LogBox } from "react-native";
LogBox.ignoreLogs(["Setting a timer", "Non-serializable values were found in the navigation state", "Warning: Failed prop type: Invalid prop `children` of type `object` supplied to `TabBarLabel`, expected `node`.",]);

export default function AppLayout() {
	const { colorScheme } = useColorScheme();

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
		</AuthProvider>
	);
}