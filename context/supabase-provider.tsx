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
import { View, ActivityIndicator, Text, Alert, Platform } from "react-native";
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";

// Prevent auto hide initially
SplashScreen.preventAutoHideAsync().catch(console.warn);

// Configure WebBrowser for OAuth flows
WebBrowser.maybeCompleteAuthSession();

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
	appleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
	googleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
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
	appleSignIn: async () => ({}),
	googleSignIn: async () => ({}),
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
	
	// Create redirect URI for OAuth
	const redirectUri = makeRedirectUri({
		scheme: 'qwerty-booklet', // From your app.json
		preferLocalhost: false,
		isTripleSlashed: true,
	});

	console.log('🎯 OAuth Redirect URI:', redirectUri);

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

	// Process OAuth user - create profile if needed
	const processOAuthUser = useCallback(async (session: Session): Promise<Profile | null> => {
		try {
			console.log('🔄 Processing OAuth user:', session.user.id);
			
			// Check if user exists in profiles table
			const { data: existingProfile, error: fetchError } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', session.user.id)
				.single();

			if (fetchError && fetchError.code === 'PGRST116') {
				// User doesn't exist, create new profile
				const userName = session.user.user_metadata.full_name ||
								session.user.user_metadata.name ||
								session.user.email?.split('@')[0] ||
								'User';

				const newProfile: Partial<Profile> = {
					id: session.user.id,
					full_name: userName,
					phone_number: null,
					avatar_url: session.user.user_metadata.avatar_url || null,
					loyalty_points: 0,
					membership_tier: 'bronze',
					notification_preferences: {
						email: true,
						push: true,
						sms: false,
					},
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				console.log('🔄 Creating new profile for OAuth user');

				const { data: createdProfile, error: createError } = await supabase
					.from('profiles')
					.insert([newProfile])
					.select()
					.single();

				if (createError) {
					console.error('❌ Error creating profile after OAuth:', createError);
					return null;
				}

				return createdProfile as Profile;

			} else if (fetchError) {
				console.error('❌ Error fetching user profile:', fetchError);
				return null;
			}

			// Profile exists, return it
			return existingProfile as Profile;
		} catch (error) {
			console.error('❌ Error processing OAuth user:', error);
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
			} else if (authData.user && authData.session) {
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

	// Apple Sign In implementation
	const appleSignIn = useCallback(async () => {
		try {
			// Check if Apple Authentication is available on this device
			if (Platform.OS !== 'ios') {
				return { error: new Error('Apple authentication is only available on iOS devices') };
			}
			
			const isAvailable = await AppleAuthentication.isAvailableAsync();
			if (!isAvailable) {
				return { error: new Error('Apple authentication is not available on this device') };
			}

			// Request authentication with Apple
			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL,
				],
			});

			// Sign in via Supabase Auth
			if (credential.identityToken) {
				const { data, error } = await supabase.auth.signInWithIdToken({
					provider: 'apple',
					token: credential.identityToken,
				});

				if (error) {
					console.error("❌ Apple auth error:", error);
					return { error };
				}

				if (data.session) {
					setSession(data.session);
					setUser(data.session.user);
					console.log("✅ User signed in with Apple:", data.user);
					
					// Process OAuth user profile
					const userProfile = await processOAuthUser(data.session);
					if (userProfile) {
						setProfile(userProfile);
						// Check if profile needs additional info (like phone number)
						const needsUpdate = !userProfile.phone_number;
						return { needsProfileUpdate: needsUpdate };
					}
				}
			} else {
				return { error: new Error('No identity token received from Apple') };
			}
			
			return {};
		} catch (error: any) {
			if (error.code === 'ERR_REQUEST_CANCELED') {
				console.log('User canceled Apple sign-in');
				return {}; // Not an error, just a cancellation
			}
			
			console.error("❌ Apple authentication error:", error);
			return { error: error as Error };
		}
	}, [processOAuthUser]);

	// Google Sign In implementation
	const googleSignIn = useCallback(async () => {
		try {
			console.log('🚀 Starting Google sign in');
			console.log('🎯 Using redirect URI:', redirectUri);

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo: redirectUri,
					skipBrowserRedirect: true,
				},
			});

			if (error) {
				console.error('❌ Error initiating Google OAuth:', error);
				return { error };
			}

			console.log('✅ OAuth initiation successful');

			if (data?.url) {
				console.log('🌐 Opening Google auth session');

				// Open the OAuth flow in a web browser
				const result = await WebBrowser.openAuthSessionAsync(
					data.url, 
					redirectUri,
					{
						showInRecents: false,
						preferEphemeralSession: true,
					}
				);

				console.log('📱 WebBrowser result:', result.type);

				if (result.type === 'success') {
					console.log('✅ OAuth callback successful');
					
					// Extract tokens from the callback URL
					const url = new URL(result.url);
					
					// Try to extract tokens from fragment
					let accessToken = null;
					let refreshToken = null;
					
					if (url.hash) {
						const hashParams = new URLSearchParams(url.hash.substring(1));
						accessToken = hashParams.get('access_token');
						refreshToken = hashParams.get('refresh_token');
					}
					
					// Fallback to search params
					if (!accessToken && url.search) {
						const searchParams = new URLSearchParams(url.search);
						accessToken = searchParams.get('access_token');
						refreshToken = searchParams.get('refresh_token');
					}

					if (accessToken) {
						console.log('✅ Tokens extracted successfully');

						// Set session with extracted tokens
						const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
							access_token: accessToken,
							refresh_token: refreshToken || '',
						});

						if (sessionError) {
							console.error('❌ Session creation failed:', sessionError);
							return { error: sessionError };
						}

						if (sessionData.session) {
							console.log('🎉 Session established successfully');
							setSession(sessionData.session);
							setUser(sessionData.session.user);

							// Process user profile
							const userProfile = await processOAuthUser(sessionData.session);
							if (userProfile) {
								setProfile(userProfile);
								// Check if profile needs additional info (like phone number)
								const needsUpdate = !userProfile.phone_number;
								return { needsProfileUpdate: needsUpdate };
							}
						}
					} else {
						console.error('❌ No access token found in callback URL');
						return { error: new Error('No access token received') };
					}
				} else if (result.type === 'cancel') {
					console.log('👤 User canceled Google sign-in');
					return {}; // Not an error
				}
			}

			return { error: new Error('OAuth initialization failed') };
		} catch (error) {
			console.error('💥 Google sign in error:', error);
			return { error: error as Error };
		}
	}, [redirectUri, processOAuthUser]);

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

	// Handle navigation
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
				appleSignIn,
				googleSignIn,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function AuthProvider({ children }: PropsWithChildren) {
	return <AuthContent>{children}</AuthContent>;
}