import "../global.css";
import { Stack } from "expo-router";
import { AuthProvider } from "@/context/supabase-provider";
import { useColorScheme } from "@/lib/useColorScheme";
import { colors } from "@/constants/colors";
import { View, ActivityIndicator,Text } from "react-native";
import { useAuth } from "@/context/supabase-provider";
export default function AppLayout() {
	const { colorScheme } = useColorScheme();
	const { initialized, session, profile } = useAuth();

    // Show loading while initializing
    if (!initialized) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" />
                <Text className="mt-4">Loading...</Text>
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
		</AuthProvider>
	);
}


