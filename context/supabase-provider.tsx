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

export function AuthProvider({ children }: PropsWithChildren) {
	const [initialized, setInitialized] = useState(false);
	const [session, setSession] = useState<Session | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const router = useRouter();

	// Fetch user profile
	const fetchProfile = async (userId: string) => {
		try {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();

			if (error) throw error;
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

	useEffect(() => {
		// Initialize auth state
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session) {
				setSession(session);
				setUser(session.user);
				fetchProfile(session.user.id);
			}
			setInitialized(true);
		});

		// Listen for auth changes
		const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
			setSession(session);
			if (session) {
				setUser(session.user);
				await fetchProfile(session.user.id);
			} else {
				setUser(null);
				setProfile(null);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (initialized) {
			SplashScreen.hideAsync();
			if (session && profile) {
				router.replace("/");
			} else if (session && !profile) {
				// Profile creation pending
				router.replace("/profile-setup");
			} else {
				router.replace("/welcome");
			}
		}
	}, [initialized, session, profile]);

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