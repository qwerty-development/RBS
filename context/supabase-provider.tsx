import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { View, ActivityIndicator, Text } from "react-native";

SplashScreen.preventAutoHideAsync();

// Profile type definition
type Profile = {
	id: string;
	full_name: string;
	phone_number?: string;
	avatar_url?: string;
	allergies?: string[];
	favorite_cuisines?: string[];
	dietary_restrictions?: string[];
	preferred_party_size?: number;
	notification_preferences?: {
		email: boolean;
		push: boolean;
		sms: boolean;
	};
	loyalty_points?: number;
	membership_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
	created_at?: string;
	updated_at?: string;
};

type AuthState = {
	initialized: boolean;
	session: Session | null;
	user: User | null;
	profile: Profile | null;
	signUp: (email: string, password: string, fullName: string, phoneNumber?: string) => Promise<void>;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	updateProfile: (updates: Partial<Profile>) => Promise<void>;
	refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthState>({
	initialized: false,
	session: null,
	user: null,
	profile: null,
	signUp: async () => {},
	signIn: async () => {},
	signOut: async () => {},
	updateProfile: async () => {},
	refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthContent({ children }: PropsWithChildren) {
	const [initialized, setInitialized] = useState(false);
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [isNavigating, setIsNavigating] = useState(false);
	const router = useRouter();

	// Fetch user profile
	const fetchProfile = async (userId: string): Promise<Profile | null> => {
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();

			if (error) {
				console.error('Error fetching profile:', error);
				return null;
			}
			
			setProfile(data);
			return data;
		} catch (error) {
			console.error('Error fetching profile:', error);
			return null;
		}
	};

	const signUp = async (email: string, password: string, fullName: string, phoneNumber?: string) => {
		try {
			// 1. Sign up the user
			const { data: authData, error: authError } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						full_name: fullName,
						phone_number: phoneNumber,
					},
				},
			});

			if (authError) throw authError;

			// 2. Create profile record
			if (authData.user) {
				const { error: profileError } = await supabase
					.from('profiles')
					.insert({
						id: authData.user.id,
						full_name: fullName,
						phone_number: phoneNumber,
						loyalty_points: 0,
						membership_tier: 'bronze',
						notification_preferences: {
							email: true,
							push: true,
							sms: false,
						},
					});

				if (profileError) throw profileError;

				// Set session and profile
				if (authData.session) {
					setSession(authData.session);
					setUser(authData.user);
					await fetchProfile(authData.user.id);
				}
			}
		} catch (error) {
			console.error('Error signing up:', error);
			throw error;
		}
	};

	const signIn = async (email: string, password: string) => {
		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) throw error;

			if (data.session && data.user) {
				setSession(data.session);
				setUser(data.user);
				await fetchProfile(data.user.id);
			}
		} catch (error) {
			console.error('Error signing in:', error);
			throw error;
		}
	};

	const signOut = async () => {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;

			setSession(null);
			setUser(null);
			setProfile(null);
		} catch (error) {
			console.error('Error signing out:', error);
			throw error;
		}
	};

	const updateProfile = async (updates: Partial<Profile>) => {
		if (!user) return;

		try {
			const { data, error } = await supabase
				.from('profiles')
				.update(updates)
				.eq('id', user.id)
				.select()
				.single();

			if (error) throw error;
			setProfile(data);
		} catch (error) {
			console.error('Error updating profile:', error);
			throw error;
		}
	};

	const refreshProfile = async () => {
		if (!user) return;
		await fetchProfile(user.id);
	};

	// Initialize auth state
	useEffect(() => {
		let isMounted = true;

		const initializeAuth = async () => {
			try {
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('Error getting session:', error);
				} else if (session && isMounted) {
					setSession(session);
					setUser(session.user);
					
					// Try to fetch profile, but don't block initialization
					try {
						await fetchProfile(session.user.id);
					} catch (profileError) {
						console.error('Error fetching profile during initialization:', profileError);
						// Continue with initialization even if profile fetch fails
					}
				}
			} catch (error) {
				console.error('Error initializing auth:', error);
			} finally {
				// Always set initialized to true, regardless of success/failure
				if (isMounted) {
					setInitialized(true);
				}
			}
		};

		initializeAuth();

		// Listen for auth changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('Auth state changed:', event, !!session);
			
			if (!isMounted) return;

			if (session) {
				setSession(session);
				setUser(session.user);
				// Don't await this to prevent blocking
				fetchProfile(session.user.id).catch(error => {
					console.error('Error fetching profile on auth change:', error);
				});
			} else {
				setSession(null);
				setUser(null);
				setProfile(null);
			}
		});

		return () => {
			isMounted = false;
			subscription.unsubscribe();
		};
	}, []);

	// Handle navigation after initialization
	useEffect(() => {
		if (!initialized || isNavigating) return;

		const handleNavigation = async () => {
			setIsNavigating(true);
			
			try {
				console.log('Handling navigation:', { session: !!session, profile: !!profile });
				
				// Hide splash screen
				await SplashScreen.hideAsync();
				
				if (session) {
					if (profile) {
						// User is authenticated and has profile
						console.log('Navigating to protected tabs');
						router.replace("/(protected)/(tabs)");
					} else {
						// User is authenticated but no profile - try to fetch again
						console.warn('Session exists but no profile found, attempting to fetch...');
						const fetchedProfile = await fetchProfile(session.user.id);
						
						if (fetchedProfile) {
							console.log('Profile fetched, navigating to protected tabs');
							router.replace("/(protected)/(tabs)");
						} else {
							// Profile fetch failed, but user is authenticated - handle gracefully
							console.error('Could not fetch profile for authenticated user');
							router.replace("/welcome");
						}
					}
				} else {
					// No session - go to welcome
					console.log('No session, navigating to welcome');
					router.replace("/welcome");
				}
			} catch (error) {
				console.error('Error during navigation:', error);
				// Fallback navigation
				router.replace("/welcome");
			} finally {
				setIsNavigating(false);
			}
		};

		// Small delay to prevent navigation race conditions
		const timeoutId = setTimeout(handleNavigation, 100);
		
		return () => clearTimeout(timeoutId);
	}, [initialized, session, profile, router, isNavigating]);

	// Show loading screen while initializing
	if (!initialized) {
		return (
			<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
				<ActivityIndicator size="large" color="#fff" />
				<Text style={{ color: '#fff', marginTop: 16 }}>Loading...</Text>
			</View>
		);
	}

	return (
		<AuthContext.Provider
			value={{
				initialized,
				session,
				user,
				profile,
				signUp,
				signIn,
				signOut,
				updateProfile,
				refreshProfile,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function AuthProvider({ children }: PropsWithChildren) {
	return <AuthContent>{children}</AuthContent>;
}