import {
	createContext,
	PropsWithChildren,
	useContext,
	useEffect,
	useState,
	useRef,
	useCallback,
} from "react";
import { SplashScreen, useRouter } from "expo-router";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import { View, ActivityIndicator, Text, Alert } from "react-native";

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
	const splashHidden = useRef(false);

	// Fetch user profile with enhanced error handling
	const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
		try {
			console.log('🔄 Fetching profile for user:', userId);
			
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();

			if (error) {
				console.error('❌ Error fetching profile:', error);
				
				// If profile doesn't exist, try to create it
				if (error.code === 'PGRST116') {
					console.log('⚠️ Profile not found, will be created on next sign-up');
					return null;
				}
				
				throw error;
			}
			
			console.log('✅ Profile fetched successfully');
			return data;
		} catch (error) {
			console.error('❌ Unexpected error fetching profile:', error);
			return null;
		}
	}, []);

	const signUp = useCallback(async (email: string, password: string, fullName: string, phoneNumber?: string) => {
		try {
			console.log('🔄 Starting sign-up process for:', email);
			
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

			if (authError) {
				console.error('❌ Auth sign-up error:', authError);
				throw authError;
			}

			console.log('✅ Auth sign-up successful');

			// Create profile if user was created
			if (authData.user && !authData.session) {
				console.log('ℹ️ User created but needs email confirmation');
				Alert.alert(
					"Check Your Email",
					"We've sent you a confirmation link. Please check your email and click the link to activate your account.",
					[{ text: "OK" }]
				);
			} else if (authData.user) {
				console.log('🔄 Creating user profile...');
				
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
					console.error('⚠️ Profile creation error (non-critical):', profileError);
					// Don't throw here - user is created, profile can be created later
				} else {
					console.log('✅ Profile created successfully');
				}
			}
		} catch (error) {
			console.error('❌ Sign-up error:', error);
			throw error;
		}
	}, []);

	const signIn = useCallback(async (email: string, password: string) => {
		try {
			console.log('🔄 Starting sign-in process for:', email);
			
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				console.error('❌ Sign-in error:', error);
				throw error;
			}
			
			console.log('✅ Sign-in successful');
		} catch (error) {
			console.error('❌ Sign-in error:', error);
			throw error;
		}
	}, []);

	const signOut = useCallback(async () => {
		try {
			console.log('🔄 Starting sign-out process...');
			
			const { error } = await supabase.auth.signOut();
			if (error) {
				console.error('❌ Sign-out error:', error);
				throw error;
			}
			
			console.log('✅ Sign-out successful');
		} catch (error) {
			console.error('❌ Sign-out error:', error);
			throw error;
		}
	}, []);

	const updateProfile = useCallback(async (updates: Partial<Profile>) => {
		if (!user) {
			throw new Error('No user logged in');
		}

		try {
			console.log('🔄 Updating profile...');
			
			const { data, error } = await supabase
				.from('profiles')
				.update(updates)
				.eq('id', user.id)
				.select()
				.single();

			if (error) {
				console.error('❌ Profile update error:', error);
				throw error;
			}
			
			setProfile(data);
			console.log('✅ Profile updated successfully');
		} catch (error) {
			console.error('❌ Error updating profile:', error);
			throw error;
		}
	}, [user]);

	const refreshProfile = useCallback(async () => {
		if (!user) return;
		
		try {
			console.log('🔄 Refreshing profile...');
			const profileData = await fetchProfile(user.id);
			if (profileData) {
				setProfile(profileData);
				console.log('✅ Profile refreshed successfully');
			}
		} catch (error) {
			console.error('❌ Error refreshing profile:', error);
		}
	}, [user, fetchProfile]);

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
					// Don't throw here, just log the error
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

		// Listen for auth changes with enhanced error handling
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('🔄 Auth state changed:', event, !!session);
			
			try {
				if (session) {
					setSession(session);
					setUser(session.user);
				} else {
					setSession(null);
					setUser(null);
					setProfile(null);
				}
			} catch (error) {
				console.error('❌ Error handling auth state change:', error);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	// Fetch profile when user changes
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
	}, [user?.id, profile, fetchProfile]);

	// Handle navigation - SIMPLIFIED
	useEffect(() => {
		if (!initialized) return;

		const navigate = async () => {
			try {
				console.log('🔄 Handling navigation...', { hasSession: !!session });
				
				// Hide splash screen only once
				if (!splashHidden.current) {
					await SplashScreen.hideAsync();
					splashHidden.current = true;
					console.log('✅ Splash screen hidden');
				}
				
				// Simple navigation based on session
				if (session) {
					console.log('✅ Session exists, navigating to protected area');
					router.replace("/(protected)/(tabs)");
				} else {
					console.log('ℹ️ No session, navigating to welcome');
					router.replace("/welcome");
				}
			} catch (error) {
				console.error('❌ Navigation error:', error);
				// Fallback navigation
				if (session) {
					router.replace("/(protected)/(tabs)");
				} else {
					router.replace("/welcome");
				}
			}
		};

		// Small delay to ensure router is ready
		const timeout = setTimeout(navigate, 200);
		
		return () => clearTimeout(timeout);
	}, [initialized, session, router]);

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