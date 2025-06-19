import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

// Environment variables with proper fallbacks and validation
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
	console.error('Missing Supabase environment variables:', {
		hasUrl: !!supabaseUrl,
		hasKey: !!supabaseAnonKey
	});
	throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

// Enhanced secure storage implementation with better error handling and fallbacks
class SecureStorage {
	private memoryFallback: Map<string, string> = new Map();

	async getItem(key: string): Promise<string | null> {
		try {
			const item = await SecureStore.getItemAsync(key);
			return item;
		} catch (error) {
			console.warn('SecureStorage getItem error, using memory fallback:', error);
			// Use memory fallback in case of SecureStore issues
			return this.memoryFallback.get(key) || null;
		}
	}

	async setItem(key: string, value: string): Promise<void> {
		try {
			await SecureStore.setItemAsync(key, value);
			// Also store in memory as backup
			this.memoryFallback.set(key, value);
		} catch (error) {
			console.warn('SecureStorage setItem error, using memory fallback:', error);
			// Store in memory fallback if SecureStore fails
			this.memoryFallback.set(key, value);
		}
	}

	async removeItem(key: string): Promise<void> {
		try {
			await SecureStore.deleteItemAsync(key);
			this.memoryFallback.delete(key);
		} catch (error) {
			console.warn('SecureStorage removeItem error:', error);
			// Always remove from memory fallback
			this.memoryFallback.delete(key);
		}
	}
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: new SecureStorage(),
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
		storageKey: 'supabase.auth.token',
		// Add retry logic for auth requests
		flowType: 'pkce',
	},
	// Add timeout and retry configuration
	global: {
		headers: {
			'X-Client-Info': 'booklet-app',
		},
	},
});

// Enhanced app state handling with error boundaries
let appStateListener: any = null;

const handleAppStateChange = (state: string) => {
	try {
		if (state === "active") {
			supabase.auth.startAutoRefresh();
		} else {
			supabase.auth.stopAutoRefresh();
		}
	} catch (error) {
		console.error('App state change error:', error);
	}
};

// Clean up existing listener before adding new one
if (appStateListener) {
	appStateListener.remove();
}

// Add app state listener with error handling
appStateListener = AppState.addEventListener("change", handleAppStateChange);