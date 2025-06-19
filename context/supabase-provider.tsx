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
	
	const router = useRouter();
	const initializationAttempted = useRef(false);
	const navigationAttempted = useRef(false);
	const splashHidden = useRef(false);

	// Fetch user profile - PURE function, no side effects during navigation
	const fetchProfile = async (userId: string): Promise<Profile | null> => {
		try {
			console.log('Fetching profile for user:', userId);
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();

			if (error) {
				console.error('Error fetching profile:', error);
				return null;
			}
			
			console.log('Profile fetched successfully');
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
			}
			
			// Don't set state here - let auth state change handler do it
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
			
			// Don't set state here - let auth state change handler do it
		} catch (error) {
			console.error('Error signing in:', error);
			throw error;
		}
	};

	const signOut = async () => {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			
			// Reset refs when signing out
			navigationAttempted.current = false;
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
		try {
			const profileData = await fetchProfile(user.id);
			if (profileData) {
				setProfile(profileData);
			}
		} catch (error) {
			console.error('Error refreshing profile:', error);
		}
	};

	// Initialize auth state - RUNS ONLY ONCE
	useEffect(() => {
		if (initializationAttempted.current) return;
		initializationAttempted.current = true;

		const initializeAuth = async () => {
			try {
				console.log('🔄 Initializing auth state...');
				
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('❌ Error getting session:', error);
				} else if (session) {
					console.log('✅ Session found during initialization');
					setSession(session);
					setUser(session.user);
				} else {
					console.log('ℹ️ No session found during initialization');
				}
			} catch (error) {
				console.error('❌ Error initializing auth:', error);
			} finally {
				setInitialized(true);
				console.log('✅ Auth initialization complete');
			}
		};

		initializeAuth();

		// Listen for auth changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('🔄 Auth state changed:', event, !!session);
			
			if (session) {
				setSession(session);
				setUser(session.user);
				// Reset navigation flag when getting new session
				navigationAttempted.current = false;
			} else {
				setSession(null);
				setUser(null);
				setProfile(null);
				// Reset navigation flag when session ends
				navigationAttempted.current = false;
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []); // NO DEPENDENCIES - runs only once

	// Fetch profile when user changes - SEPARATE EFFECT
	useEffect(() => {
		if (user && !profile) {
			console.log('🔄 User found, fetching profile...');
			fetchProfile(user.id)
				.then(profileData => {
					if (profileData) {
						setProfile(profileData);
						console.log('✅ Profile loaded');
					} else {
						console.log('⚠️ Profile not found');
					}
				})
				.catch(error => {
					console.error('❌ Failed to fetch profile:', error);
				});
		}
	}, [user?.id]); // Only depend on user ID, not profile

	// Handle navigation - CLEAN and SIMPLE
	useEffect(() => {
		if (!initialized || navigationAttempted.current) return;

		const navigate = async () => {
			navigationAttempted.current = true;
			
			try {
				console.log('🔄 Handling navigation...');
				
				// Hide splash screen only once
				if (!splashHidden.current) {
					await SplashScreen.hideAsync();
					splashHidden.current = true;
					console.log('✅ Splash screen hidden');
				}
				
				// Simple navigation based ONLY on session
				if (session) {
					console.log('✅ Session exists, navigating to protected area');
					router.replace("/(protected)/(tabs)");
				} else {
					console.log('ℹ️ No session, navigating to welcome');
					router.replace("/welcome");
				}
			} catch (error) {
				console.error('❌ Navigation error:', error);
				// Reset flag to allow retry
				navigationAttempted.current = false;
			}
		};

		// Small delay to ensure router is ready
		const timeout = setTimeout(navigate, 100);
		
		return () => clearTimeout(timeout);
	}, [initialized, !!session]); // Only session boolean, not the object itself

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
				<Text style={{ color: '#fff', marginTop: 16 }}>Initializing...</Text>
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