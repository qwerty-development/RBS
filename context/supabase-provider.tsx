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
	const [isNavigationReady, setIsNavigationReady] = useState(false);
	const [splashHidden, setSplashHidden] = useState(false);
	const router = useRouter();

	// Fetch user profile with proper error handling
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

				if (profileError) throw profileError;

				if (authData.session) {
					setSession(authData.session);
					setUser(authData.user);
					const newProfile = await fetchProfile(authData.user.id);
					setProfile(newProfile);
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
				const userProfile = await fetchProfile(data.user.id);
				setProfile(userProfile);
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
		const userProfile = await fetchProfile(user.id);
		setProfile(userProfile);
	};

	// Initialize splash screen prevention
	useEffect(() => {
		const initSplash = async () => {
			try {
				await SplashScreen.preventAutoHideAsync();
			} catch (error) {
				console.warn('SplashScreen.preventAutoHideAsync failed:', error);
			}
		};
		
		initSplash();
	}, []);

	// Initialize auth state
	useEffect(() => {
		let isMounted = true;

		const initializeAuth = async () => {
			try {
				console.log('Starting auth initialization...');
				
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('Error getting session:', error);
				}

				if (session && isMounted) {
					console.log('Session found, setting auth state...');
					setSession(session);
					setUser(session.user);
					
					try {
						const userProfile = await fetchProfile(session.user.id);
						if (isMounted) {
							setProfile(userProfile);
						}
					} catch (profileError) {
						console.error('Error fetching profile during initialization:', profileError);
					}
				}

				if (isMounted) {
					console.log('Auth initialization complete');
					setInitialized(true);
				}
			} catch (error) {
				console.error('Error initializing auth:', error);
				if (isMounted) {
					setInitialized(true);
				}
			}
		};

		initializeAuth();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log('Auth state changed:', event);
			
			if (!isMounted) return;

			if (session) {
				setSession(session);
				setUser(session.user);
				try {
					const userProfile = await fetchProfile(session.user.id);
					setProfile(userProfile);
				} catch (error) {
					console.error('Error fetching profile on auth change:', error);
				}
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
		if (!initialized || isNavigationReady) return;

		const handleNavigation = async () => {
			try {
				console.log('Handling navigation...', { session: !!session, profile: !!profile });
				
				// Determine target route without navigating yet
				let targetRoute: string;
				
				if (session) {
					if (profile) {
						targetRoute = "/(protected)/(tabs)";
					} else {
						// Wait a bit for profile to load
						await new Promise(resolve => setTimeout(resolve, 1000));
						
						// Check again
						if (profile) {
							targetRoute = "/(protected)/(tabs)";
						} else {
							console.warn('Session exists but no profile found');
							targetRoute = "/welcome";
						}
					}
				} else {
					targetRoute = "/welcome";
				}
				
				// Hide splash screen first
				if (!splashHidden) {
					try {
						await SplashScreen.hideAsync();
						setSplashHidden(true);
					} catch (error) {
						console.warn('Error hiding splash screen:', error);
						setSplashHidden(true);
					}
				}
				
				// Small delay before navigation
				await new Promise(resolve => setTimeout(resolve, 100));
				
				console.log(`Navigating to: ${targetRoute}`);
				router.replace(targetRoute as any);
				
				setIsNavigationReady(true);
			} catch (error) {
				console.error('Error during navigation:', error);
				
				// Fallback: hide splash and go to welcome
				try {
					if (!splashHidden) {
						await SplashScreen.hideAsync();
						setSplashHidden(true);
					}
					router.replace("/welcome");
					setIsNavigationReady(true);
				} catch (fallbackError) {
					console.error('Fallback navigation failed:', fallbackError);
					setIsNavigationReady(true);
				}
			}
		};

		const timeoutId = setTimeout(handleNavigation, 200);
		
		return () => clearTimeout(timeoutId);
	}, [initialized, session, profile, router, isNavigationReady, splashHidden]);

	// Show loading screen while initializing
	if (!initialized || !isNavigationReady) {
		return (
			<View style={{ 
				flex: 1, 
				justifyContent: 'center', 
				alignItems: 'center', 
				backgroundColor: '#000' 
			}}>
				<ActivityIndicator size="large" color="#fff" />
				<Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>
					{!initialized ? 'Initializing...' : 'Loading...'}
				</Text>
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