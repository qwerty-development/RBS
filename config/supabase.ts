import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Simplified secure storage implementation
class SecureStorage {
	async getItem(key: string): Promise<string | null> {
		try {
			return await SecureStore.getItemAsync(key);
		} catch (error) {
			console.error('Error getting item from secure storage:', error);
			return null;
		}
	}

	async setItem(key: string, value: string): Promise<void> {
		try {
			await SecureStore.setItemAsync(key, value);
		} catch (error) {
			console.error('Error setting item in secure storage:', error);
			// Don't throw - let Supabase handle the fallback
		}
	}

	async removeItem(key: string): Promise<void> {
		try {
			await SecureStore.deleteItemAsync(key);
		} catch (error) {
			console.error('Error removing item from secure storage:', error);
			// Don't throw - let Supabase handle the fallback
		}
	}
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: new SecureStorage(),
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});

// Handle app state changes
AppState.addEventListener("change", (state) => {
	if (state === "active") {
		supabase.auth.startAutoRefresh();
	} else {
		supabase.auth.stopAutoRefresh();
	}
});