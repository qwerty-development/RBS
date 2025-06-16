import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
	const { initialized, session, profile } = useAuth();

	// Show nothing while initializing to prevent flashing
	if (!initialized) {
		return null;
	}

	// Redirect to welcome if no session
	if (!session) {
		return <Redirect href="/welcome" />;
	}

	// Wait for profile to load if we have a session
	if (!profile) {
		return null; // Could show a loading spinner here
	}

	return (
		<Stack
			screenOptions={{
				headerShown: false,
			}}
		>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="modal" options={{ presentation: "modal" }} />
		</Stack>
	);
}