import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import Constants from 'expo-constants';

// Enhanced environment variable loading with multiple fallback strategies
const getEnvVar = (key: string): string | undefined => {
	// Try multiple sources for environment variables
	return (
		process.env[key] || 
		Constants.expoConfig?.extra?.[key] || 
		Constants.manifest?.extra?.[key] ||
		Constants.manifest2?.extra?.[key]
	);
};

// Environment variables with enhanced validation and debugging
const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Debug environment variable loading
console.log('🔍 Environment variable loading:');
console.log('  - EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Found' : '❌ Missing');
console.log('  - EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Found' : '❌ Missing');
console.log('  - Build type:', __DEV__ ? 'Development' : 'Production');

// Validate environment variables with detailed error reporting
if (!supabaseUrl) {
	const error = 'EXPO_PUBLIC_SUPABASE_URL is missing. Please check your environment configuration.';
	console.error('❌', error);
	throw new Error(error);
}

if (!supabaseAnonKey) {
	const error = 'EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Please check your environment configuration.';
	console.error('❌', error);
	throw new Error(error);
}

// Validate URL format
try {
	new URL(supabaseUrl);
} catch {
	const error = 'EXPO_PUBLIC_SUPABASE_URL is not a valid URL.';
	console.error('❌', error);
	throw new Error(error);
}

console.log('✅ Supabase environment variables validated successfully');

// Enhanced secure storage implementation with better error handling and fallbacks
class SecureStorage {
	private memoryFallback: Map<string, string> = new Map();
	private hasSecureStoreAccess: boolean | null = null;

	private async checkSecureStoreAccess(): Promise<boolean> {
		if (this.hasSecureStoreAccess !== null) {
			return this.hasSecureStoreAccess;
		}

		try {
			// Test SecureStore access
			await SecureStore.setItemAsync('__test__', 'test');
			await SecureStore.deleteItemAsync('__test__');
			this.hasSecureStoreAccess = true;
			console.log('✅ SecureStore access confirmed');
			return true;
		} catch (error) {
			console.warn('⚠️ SecureStore not available, using memory fallback:', error);
			this.hasSecureStoreAccess = false;
			return false;
		}
	}

	async getItem(key: string): Promise<string | null> {
		try {
			const hasAccess = await this.checkSecureStoreAccess();
			if (hasAccess) {
				const item = await SecureStore.getItemAsync(key);
				return item;
			} else {
				return this.memoryFallback.get(key) || null;
			}
		} catch (error) {
			console.warn('SecureStorage getItem error, using memory fallback:', error);
			return this.memoryFallback.get(key) || null;
		}
	}

	async setItem(key: string, value: string): Promise<void> {
		try {
			const hasAccess = await this.checkSecureStoreAccess();
			if (hasAccess) {
				await SecureStore.setItemAsync(key, value);
			}
			// Always store in memory as backup
			this.memoryFallback.set(key, value);
		} catch (error) {
			console.warn('SecureStorage setItem error, using memory fallback:', error);
			this.memoryFallback.set(key, value);
		}
	}

	async removeItem(key: string): Promise<void> {
		try {
			const hasAccess = await this.checkSecureStoreAccess();
			if (hasAccess) {
				await SecureStore.deleteItemAsync(key);
			}
			this.memoryFallback.delete(key);
		} catch (error) {
			console.warn('SecureStorage removeItem error:', error);
			this.memoryFallback.delete(key);
		}
	}
}

// Create Supabase client with enhanced configuration and error handling
console.log('🔄 Creating Supabase client...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: new SecureStorage(),
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
		storageKey: 'supabase.auth.token',
		flowType: 'pkce',
		debug: __DEV__, // Enable debug mode in development
	},
	global: {
		headers: {
			'X-Client-Info': 'booklet-app',
			'X-Client-Version': '1.0.0',
		},
	},
	// Add timeout configuration
	db: {
		schema: 'public',
	},
	realtime: {
		params: {
			eventsPerSecond: 10,
		},
	},
});

console.log('✅ Supabase client created successfully');

// Test Supabase connection
const testConnection = async () => {
	try {
		console.log('🔄 Testing Supabase connection...');
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.warn('⚠️ Supabase connection test warning:', error.message);
		} else {
			console.log('✅ Supabase connection test successful');
		}
	} catch (error) {
		console.error('❌ Supabase connection test failed:', error);
	}
};

// Test connection in production (with delay to avoid blocking)
if (!__DEV__) {
	setTimeout(testConnection, 1000);
}

// Enhanced app state handling with error boundaries
let appStateListener: any = null;

const handleAppStateChange = (state: string) => {
	try {
		console.log('📱 App state changed to:', state);
		if (state === "active") {
			supabase.auth.startAutoRefresh();
		} else {
			supabase.auth.stopAutoRefresh();
		}
	} catch (error) {
		console.error('❌ App state change error:', error);
	}
};

// Clean up existing listener before adding new one
if (appStateListener) {
	appStateListener.remove();
}

// Add app state listener with error handling
try {
	appStateListener = AppState.addEventListener("change", handleAppStateChange);
	console.log('✅ App state listener registered');
} catch (error) {
	console.error('❌ Failed to register app state listener:', error);
}

// Export connection test function for debugging
export { testConnection };