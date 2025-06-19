import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
	useRef,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { View, ActivityIndicator, Text } from "react-native";

// Prevent auto hide initially
SplashScreen.preventAutoHideAsync().catch(console.warn);

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
	const initializationAttempted = useRef(false);

	// Fetch user profile with enhanced error handling
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
			console.error('Unexpected error fetching profile:', error);
			return null;
		}
	};

	const signUp = async (email: string, password: string, fullName: string, phoneNumber?: string) => {
		try {
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

				if (profileError) {
					console.error('Profile creation error:', profileError);
					// Don't throw here - user is created, profile can be created later
				}

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

	// Initialize auth state with enhanced error handling
	useEffect(() => {
		if (initializationAttempted.current) return;
		initializationAttempted.current = true;

		const initializeAuth = async () => {
			try {
				console.log('Initializing auth state...');
				
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('Error getting session:', error);
				} else if (session) {
					console.log('Session found, setting auth state');
					setSession(session);
					setUser(session.user);
					
					// Fetch profile in background
					fetchProfile(session.user.id).catch(error => {
						console.error('Background profile fetch failed:', error);
					});
				} else {
					console.log('No session found');
				}
			} catch (error) {
				console.error('Error initializing auth:', error);
			} finally {
				setInitialized(true);
			}
		};

		initializeAuth();

		// Listen for auth changes with enhanced error handling
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('Auth state changed:', event, !!session);
			
			try {
				if (session) {
					setSession(session);
					setUser(session.user);
					// Fetch profile in background
					fetchProfile(session.user.id).catch(error => {
						console.error('Profile fetch failed on auth change:', error);
					});
				} else {
					setSession(null);
					setUser(null);
					setProfile(null);
				}
			} catch (error) {
				console.error('Error handling auth state change:', error);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	// Handle navigation after initialization - SIMPLIFIED
	useEffect(() => {
		if (!initialized || isNavigating) return;

		const handleNavigation = async () => {
			setIsNavigating(true);
			
			try {
				// Hide splash screen safely
				await SplashScreen.hideAsync();
				
				if (session && user) {
					if (profile) {
						console.log('Navigating to protected area with full auth');
						router.replace("/(protected)/(tabs)");
					} else {
						console.log('Session exists but no profile, attempting to fetch');
						const fetchedProfile = await fetchProfile(user.id);
						
						if (fetchedProfile) {
							console.log('Profile fetched successfully, navigating to protected area');
							router.replace("/(protected)/(tabs)");
						} else {
							console.warn('Could not fetch profile, navigating to welcome');
							router.replace("/welcome");
						}
					}
				} else {
					console.log('No session, navigating to welcome');
					router.replace("/welcome");
				}
			} catch (error) {
				console.error('Navigation error:', error);
				// Fallback navigation
				try {
					router.replace("/welcome");
				} catch (fallbackError) {
					console.error('Fallback navigation failed:', fallbackError);
				}
			} finally {
				setIsNavigating(false);
			}
		};

		// Small delay to ensure navigation is ready
		const timeout = setTimeout(handleNavigation, 100);
		
		return () => clearTimeout(timeout);
	}, [initialized, session, profile, isNavigating]);

	// Show loading screen while initializing
	if (!initialized) {
		return (
			<View style={{ 
				flex: 1, 
				justifyContent: 'center', 
				alignItems: 'center', 
				backgroundColor: '#000' 
			}}>
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