import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/context/supabase-provider";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

export default function ProtectedLayout() {
	const { initialized, session, profile } = useAuth();
	const [redirectReady, setRedirectReady] = useState(false);

	// Systematic validation rules for navigation state
	const validationRules = {
		// Rule 1: System must be fully initialized
		isInitialized: initialized === true,
		
		// Rule 2: Session validation with explicit null check
		hasValidSession: session !== null && session !== undefined,
		
		// Rule 3: Profile validation with data integrity check
		hasValidProfile: profile !== null && profile !== undefined && typeof profile.id === 'string',
		
		// Rule 4: Combined validation state
		get isFullyAuthenticated() {
			return this.isInitialized && this.hasValidSession && this.hasValidProfile;
		},
		
		// Rule 5: Should redirect to authentication flow
		get shouldRedirect() {
			return this.isInitialized && (!this.hasValidSession || !this.hasValidProfile);
		}
	};

	// Defensive state management with explicit timing control
	useEffect(() => {
		let timeoutId: NodeJS.Timeout;

		const processRedirect = () => {
			try {
				console.log('ProtectedLayout: Processing redirect logic', {
					initialized,
					hasSession: !!session,
					hasProfile: !!profile,
					profileId: profile?.id,
				});

				// Apply systematic validation rules
				if (validationRules.isFullyAuthenticated) {
					console.log('ProtectedLayout: Full authentication confirmed, allowing access');
					setRedirectReady(true);
					return;
				}

				if (validationRules.shouldRedirect) {
					console.log('ProtectedLayout: Authentication incomplete, preparing redirect');
					// Small delay to prevent race conditions with router
					timeoutId = setTimeout(() => {
						setRedirectReady(true);
					}, 100);
					return;
				}

				// System not ready - maintain loading state
				console.log('ProtectedLayout: System not ready, maintaining loading state');
			} catch (error) {
				console.error('ProtectedLayout: Error in redirect processing:', error);
				// Fail-safe: allow redirect on error
				setRedirectReady(true);
			}
		};

		processRedirect();

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	}, [initialized, session, profile]);

	// Loading state with explicit constraints
	if (!validationRules.isInitialized || !redirectReady) {
		return (
			<View style={{ 
				flex: 1, 
				justifyContent: 'center', 
				alignItems: 'center', 
				backgroundColor: '#000' 
			}}>
				<ActivityIndicator size="large" color="#fff" />
				<Text style={{ 
					color: '#fff', 
					marginTop: 16, 
					fontSize: 16,
					textAlign: 'center' 
				}}>
					{!validationRules.isInitialized ? 'Initializing authentication...' : 'Preparing app...'}
				</Text>
			</View>
		);
	}

	// Authentication validation with fail-safe redirect
	if (validationRules.shouldRedirect) {
		console.log('ProtectedLayout: Executing redirect to welcome screen');
		return <Redirect href="/welcome" />;
	}

	// Success state: render protected content
	console.log('ProtectedLayout: Rendering protected content');
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				// Add animation constraints for stability
				animation: 'fade',
				animationDuration: 200,
			}}
		>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen 
				name="modal" 
				options={{ 
					presentation: "modal",
					gestureEnabled: true,
				}} 
			/>
		</Stack>
	);
}