import React, {
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
import { supabase } from "../config/supabase";
import { View, ActivityIndicator, Text, Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SecurityMonitor,
  RateLimiter,
  DeviceSecurity,
  withSecurityMiddleware,
  InputValidator,
} from "../lib/security";

const GUEST_MODE_KEY = "guest-mode-active";

// Add this at the top of your AuthContent component
WebBrowser.maybeCompleteAuthSession();
// Prevent auto hide initially
SplashScreen.preventAutoHideAsync().catch(console.warn);
// Absolute safety net: ensure native splash never persists indefinitely (e.g. deadlock during cold-start deep link)
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 3000); // 8s hard timeout

// Profile type definition
type Profile = {
  id: string;
  full_name: string;
  phone_number?: string;
  date_of_birth?: string;
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
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean; // NEW: Guest state
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    dateOfBirth?: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  appleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
  googleSignIn: () => Promise<{ error?: Error; needsProfileUpdate?: boolean }>;
  continueAsGuest: () => void; // NEW: Guest function
  convertGuestToUser: () => void; // NEW: Convert guest to user function
};

export const AuthContext = createContext<AuthState>({
  initialized: false,
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  appleSignIn: async () => ({}),
  googleSignIn: async () => ({}),
  continueAsGuest: () => {},
  convertGuestToUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthContent({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(false); // NEW: Guest state
  const [isOAuthFlow, setIsOAuthFlow] = useState(false); // NEW: OAuth flow tracker

  const router = useRouter();
  const initializationAttempted = useRef(false);
  const splashHidden = useRef(false);
  const oAuthFlowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationInProgress = useRef(false); // Prevent multiple navigation attempts
  const nativeSplashHidden = useRef(false); // Track native splash independently of navigation

  // Create redirect URI for OAuth
  const redirectUri = makeRedirectUri({
    scheme: "qwerty-plate", // From your app.json
    preferLocalhost: false,
    isTripleSlashed: true,
  });

  console.log("🎯 OAuth Redirect URI:", redirectUri);

  // NEW: Continue as guest function
  const continueAsGuest = useCallback(async () => {
    console.log("👻 Continuing as guest...");
    try {
      await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
      setIsGuest(true);
      setSession(null);
      setUser(null);
      setProfile(null);
      // Navigate to main app
      router.replace("/(protected)/(tabs)");
    } catch (error) {
      console.error("Failed to save guest mode status", error);
    }
  }, [router]);

  // NEW: Convert guest to user (redirect to welcome)
  const convertGuestToUser = useCallback(async () => {
    console.log("🔄 Converting guest to user...");
    try {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);
      router.replace("/welcome");
    } catch (error) {
      console.error("Failed to clear guest mode status", error);
    }
  }, [router]);

  // Fetch user profile with enhanced error handling
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        console.log("🔄 Fetching profile for user:", userId);

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("❌ Error fetching profile:", error);

          // If profile doesn't exist, try to create it
          if (error.code === "PGRST116") {
            console.log(
              "⚠️ Profile not found, will be created on next sign-up",
            );
            return null;
          }

          throw error;
        }

        console.log("✅ Profile fetched successfully");
        return data;
      } catch (error) {
        console.error("❌ Unexpected error fetching profile:", error);
        return null;
      }
    },
    [],
  );

  // Process OAuth user - create profile if needed
  const processOAuthUser = useCallback(
    async (session: Session): Promise<Profile | null> => {
      try {
        console.log("🔄 Processing OAuth user:", session.user.id);

        // Check if user exists in profiles table
        const { data: existingProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (fetchError && fetchError.code === "PGRST116") {
          // User doesn't exist, create new profile
          const userName =
            session.user.user_metadata.full_name ||
            session.user.user_metadata.name ||
            session.user.email?.split("@")[0] ||
            "User";

          const newProfile: Partial<Profile> = {
            id: session.user.id,
            full_name: userName,
            phone_number: undefined,
            date_of_birth: session.user.user_metadata.date_of_birth || null,
            avatar_url: session.user.user_metadata.avatar_url || null,
            loyalty_points: 0,
            membership_tier: "bronze",
            notification_preferences: {
              email: true,
              push: true,
              sms: false,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log("🔄 Creating new profile for OAuth user");

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert([newProfile])
            .select()
            .single();

          if (createError) {
            console.error(
              "❌ Error creating profile after OAuth:",
              createError,
            );
            return null;
          }

          return createdProfile as Profile;
        } else if (fetchError) {
          console.error("❌ Error fetching user profile:", fetchError);
          return null;
        }

        // Profile exists, return it
        return existingProfile as Profile;
      } catch (error) {
        console.error("❌ Error processing OAuth user:", error);
        return null;
      }
    },
    [],
  );

  const signUp = useCallback(
    withSecurityMiddleware(
      async (
        email: string,
        password: string,
        fullName: string,
        phoneNumber?: string,
        dateOfBirth?: string,
      ) => {
        try {
          console.log("🔄 Starting sign-up process for:", email);

          // Enhanced input validation
          if (!InputValidator.isValidEmail(email)) {
            throw new Error("Please enter a valid email address");
          }

          const passwordValidation = InputValidator.validatePassword(password);
          if (!passwordValidation.isValid) {
            throw new Error(
              passwordValidation.errors[0] || "Password is not strong enough",
            );
          }

          if (!fullName || fullName.trim().length < 2) {
            throw new Error("Please enter your full name");
          }

          if (phoneNumber && !InputValidator.isValidPhoneNumber(phoneNumber)) {
            throw new Error("Please enter a valid phone number");
          }

          // Check rate limits for registration attempts
          const rateLimitResult = await RateLimiter.checkActionRateLimit(
            email,
            "registration_attempts",
          );

          if (!rateLimitResult.allowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "registration_rate_limit",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Too many registration attempts. Please try again later.",
            );
          }

          // Check device account limits
          const deviceAllowed = await DeviceSecurity.checkDeviceAccountLimit();
          if (!deviceAllowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "device_account_limit_exceeded",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Maximum number of accounts reached for this device",
            );
          }

          // Clear guest mode when signing up
          setIsGuest(false);

          const { data: authData, error: authError } =
            await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: Linking.createURL("/auth-confirm"),
                data: {
                  full_name: fullName,
                  phone_number: phoneNumber,
                  date_of_birth: dateOfBirth,
                },
              },
            });

          if (authError) {
            console.error("❌ Auth sign-up error:", authError);

            // Monitor failed registration attempts
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                error: authError.message,
                reason: "registration_failed",
                timestamp: new Date().toISOString(),
              },
            });

            throw authError;
          }

          console.log("✅ Auth sign-up successful");

          // Create profile if user was created
          if (authData.user && !authData.session) {
            console.log("ℹ️ User created but needs email confirmation");
            Alert.alert(
              "Check Your Email",
              "We've sent you a confirmation link. Please check your email and click the link to activate your account.",
              [{ text: "OK" }],
            );
          } else if (authData.user && authData.session) {
            console.log("🔄 Creating user profile...");

            // Register device for the new user
            await DeviceSecurity.registerDeviceForUser(authData.user.id);

            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                full_name: fullName,
                phone_number: phoneNumber,
                date_of_birth: dateOfBirth,
                loyalty_points: 0,
                membership_tier: "bronze",
                user_rating: 5.0, // New users start with excellent rating
                notification_preferences: {
                  email: true,
                  push: true,
                  sms: false,
                },
              });

            if (profileError) {
              console.error(
                "⚠️ Profile creation error (non-critical):",
                profileError,
              );
            } else {
              console.log("✅ Profile created successfully");
            }
          }

          // Log successful registration for monitoring
          if (authData.user) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              userId: authData.user.id,
              metadata: {
                action: "successful_registration",
                email,
                timestamp: new Date().toISOString(),
              },
            });
          }
        } catch (error) {
          console.error("❌ Sign-up error:", error);
          throw error;
        }
      },
      {
        actionType: "registration_attempts",
        validateInput: true,
        monitorFailures: true,
      },
    ),
    [],
  );

  const signIn = useCallback(
    withSecurityMiddleware(
      async (email: string, password: string) => {
        try {
          console.log("🔄 Starting sign-in process for:", email);

          // Input validation
          if (!InputValidator.isValidEmail(email)) {
            throw new Error("Please enter a valid email address");
          }

          if (!password || password.length < 4) {
            throw new Error("Password must be at least 6 characters");
          }

          // Check rate limits for login attempts
          const rateLimitResult = await RateLimiter.checkActionRateLimit(
            email,
            "login_attempts",
          );

          if (!rateLimitResult.allowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "multiple_failed_logins",
              metadata: { email, timestamp: new Date().toISOString() },
            });

            throw new Error("Too many login attempts. Please try again later.");
          }

          // Check device account limits
          const deviceAllowed = await DeviceSecurity.checkDeviceAccountLimit();
          if (!deviceAllowed) {
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "account_abuse",
              metadata: {
                email,
                reason: "device_account_limit_exceeded",
                timestamp: new Date().toISOString(),
              },
            });

            throw new Error(
              "Maximum number of accounts reached for this device",
            );
          }

          // Clear guest mode when signing in
          setIsGuest(false);

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.error("❌ Sign-in error:", error);

            // Monitor failed login attempts
            await SecurityMonitor.monitorSuspiciousActivity({
              type: "multiple_failed_logins",
              metadata: {
                email,
                error: error.message,
                timestamp: new Date().toISOString(),
              },
            });

            throw error;
          }

          // Successful login - register device and check for security flags
          if (data.user) {
            await DeviceSecurity.registerDeviceForUser(data.user.id);

            // Check if user is flagged for suspicious activity
            const suspiciousFlags =
              await SecurityMonitor.checkUserSuspiciousFlags(data.user.id);
            if (
              suspiciousFlags.isFlagged &&
              suspiciousFlags.riskLevel === "high"
            ) {
              Alert.alert(
                "Account Review",
                "Your account has been flagged for review. Some features may be limited. Please contact support if you have questions.",
                [{ text: "OK" }],
              );
            }
          }

          console.log("✅ Sign-in successful");
        } catch (error) {
          console.error("❌ Sign-in error:", error);
          throw error;
        }
      },
      {
        actionType: "login_attempts",
        validateInput: true,
        monitorFailures: true,
      },
    ),
    [],
  );

  const signOut = useCallback(async () => {
    try {
      console.log("🔄 Starting sign-out process...");

      // Clear guest mode
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("❌ Sign-out error:", error);
        throw error;
      }

      console.log("✅ Sign-out successful");
    } catch (error) {
      console.error("❌ Sign-out error:", error);
      throw error;
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) {
        throw new Error("No user logged in");
      }

      try {
        console.log("🔄 Updating profile...");

        const { data, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          console.error("❌ Profile update error:", error);
          throw error;
        }

        setProfile(data);
        console.log("✅ Profile updated successfully");
      } catch (error) {
        console.error("❌ Error updating profile:", error);
        throw error;
      }
    },
    [user],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      console.log("🔄 Refreshing profile...");
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        console.log("✅ Profile refreshed successfully");
      }
    } catch (error) {
      console.error("❌ Error refreshing profile:", error);
    }
  }, [user, fetchProfile]);

  // Apple Sign In implementation
  const appleSignIn = useCallback(async () => {
    try {
      // Clear guest mode
      setIsGuest(false);

      // Check if Apple Authentication is available on this device
      if (Platform.OS !== "ios") {
        return {
          error: new Error(
            "Apple authentication is only available on iOS devices",
          ),
        };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          error: new Error(
            "Apple authentication is not available on this device",
          ),
        };
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
          provider: "apple",
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
        return { error: new Error("No identity token received from Apple") };
      }

      return {};
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        console.log("User canceled Apple sign-in");
        return {}; // Not an error, just a cancellation
      }

      console.error("❌ Apple authentication error:", error);
      return { error: error as Error };
    }
  }, [processOAuthUser]);

  // Google Sign In implementation (keeping your existing implementation)
  const googleSignIn = useCallback(async () => {
    try {
      // Clear guest mode and set OAuth flow state
      setIsGuest(false);
      setIsOAuthFlow(true);

      // Clear any existing OAuth timeout
      if (oAuthFlowTimeout.current) {
        clearTimeout(oAuthFlowTimeout.current);
      }

      // Set timeout to clear OAuth flow state if it takes too long
      oAuthFlowTimeout.current = setTimeout(() => {
        console.log("⏰ OAuth flow timeout, clearing state");
        setIsOAuthFlow(false);
      }, 60000); // 1 minute timeout

      console.log("🚀 Starting Google sign in");

      // Create the redirect URI - use expo-auth-session format
      const redirectUrl = makeRedirectUri({
        scheme: "qwerty-plate",
        preferLocalhost: false,
        isTripleSlashed: true,
        native: "qwerty-plate://google",
      });

      console.log("🎯 Using redirect URL:", redirectUrl);

      // Step 1: Start OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account consent",
            access_type: "offline",
            include_granted_scopes: "true",
          },
        },
      });

      if (error || !data?.url) {
        console.error("❌ Error initiating Google OAuth:", error);
        return { error: error || new Error("No OAuth URL received") };
      }

      console.log("🌐 Opening Google auth session");

      // Step 2: Set up a URL listener BEFORE opening the browser
      let urlSubscription: any;
      const urlPromise = new Promise<string>((resolve, reject) => {
        // Listen for the redirect
        urlSubscription = Linking.addEventListener("url", (event) => {
          console.log("🔗 Received URL:", event.url);
          if (
            event.url.includes("google") ||
            event.url.includes("#access_token") ||
            event.url.includes("code=")
          ) {
            resolve(event.url);
          }
        });

        // Android devices need longer timeout due to slower OAuth processing
        const timeoutDuration = Platform.OS === "android" ? 180000 : 120000; // 3 minutes for Android, 2 for iOS
        setTimeout(() => reject(new Error("OAuth timeout")), timeoutDuration);
      });

      // Step 3: Open the browser with platform-specific options
      const browserOptions = {
        showInRecents: false,
        createTask: false,
        preferEphemeralSession: false, // Allow account selection
        ...(Platform.OS === "android" && {
          // Android-specific optimizations
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          showTitle: false,
        }),
      };

      const browserPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        browserOptions,
      );

      // Step 4: Wait for either the browser to close or URL to be received
      try {
        const result = await Promise.race([
          browserPromise,
          urlPromise.then((url) => ({ type: "success" as const, url })),
        ]);

        console.log("📱 Auth result:", result);

        // Clean up the URL listener
        if (urlSubscription) {
          urlSubscription.remove();
        }

        if (result.type === "success" && result.url) {
          console.log("✅ OAuth callback received");

          // Step 5: Parse the callback URL
          const url = new URL(result.url);

          // Extract parameters from hash or query
          let params = new URLSearchParams();
          if (url.hash) {
            params = new URLSearchParams(url.hash.substring(1));
          } else if (url.search) {
            params = new URLSearchParams(url.search);
          }

          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          const code = params.get("code");
          const error_description = params.get("error_description");

          if (error_description) {
            console.error("❌ OAuth error:", error_description);
            return { error: new Error(error_description) };
          }

          // Step 6: Handle code exchange
          if (code && !access_token) {
            console.log("🔄 Exchanging code for session");

            const { data: sessionData, error: sessionError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
              console.error("❌ Code exchange error:", sessionError);
              return { error: sessionError };
            }

            if (sessionData?.session) {
              console.log("🎉 Session established via code exchange");

              // Android needs more time to process OAuth state changes
              const processingDelay = Platform.OS === "android" ? 1000 : 500;
              await new Promise((resolve) =>
                setTimeout(resolve, processingDelay),
              );

              // Process OAuth user profile
              const userProfile = await processOAuthUser(sessionData.session);
              if (userProfile) {
                setProfile(userProfile);
                // Check if profile needs additional info
                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          // Step 7: Handle direct token
          if (access_token) {
            console.log("✅ Access token found, setting session");

            // Platform-specific delay for proper state handling
            const stateDelay = Platform.OS === "android" ? 800 : 300;
            await new Promise((resolve) => setTimeout(resolve, stateDelay));

            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token || "",
              });

            if (sessionError) {
              console.error("❌ Session creation failed:", sessionError);
              return { error: sessionError };
            }

            if (sessionData?.session) {
              console.log("🎉 Session established via tokens");
              // Process OAuth user profile
              const userProfile = await processOAuthUser(sessionData.session);
              if (userProfile) {
                setProfile(userProfile);
                // Check if profile needs additional info
                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          // Step 8: Final fallback check with extended wait for Android
          console.log("🔄 Checking for session via getSession");
          const fallbackWait = Platform.OS === "android" ? 2000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, fallbackWait));

          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession) {
            console.log("✅ Session found via getSession");
            // Process OAuth user profile
            const userProfile = await processOAuthUser(currentSession);
            if (userProfile) {
              setProfile(userProfile);
              // Check if profile needs additional info
              const needsUpdate = !userProfile.phone_number;
              return { needsProfileUpdate: needsUpdate };
            }
            return {};
          }

          console.error("❌ No session established after OAuth");
          return { error: new Error("Failed to establish session") };
        } else if (result.type === "cancel") {
          console.log("👤 User canceled Google sign-in");
          return {};
        } else {
          console.error("❌ OAuth flow failed");
          return { error: new Error("OAuth flow failed") };
        }
      } catch (timeoutError) {
        // Clean up listener if timeout
        if (urlSubscription) {
          urlSubscription.remove();
        }
        console.error("⏱️ OAuth timeout:", timeoutError);

        // Check if session was created anyway
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          console.log("✅ Session found despite timeout");
          // Process OAuth user profile
          const userProfile = await processOAuthUser(session);
          if (userProfile) {
            setProfile(userProfile);
            // Check if profile needs additional info
            const needsUpdate = !userProfile.phone_number;
            return { needsProfileUpdate: needsUpdate };
          }
          return {};
        }

        return { error: new Error("OAuth timeout") };
      }
    } catch (error) {
      console.error("💥 Google sign in error:", error);
      return { error: error as Error };
    } finally {
      // Clear OAuth flow state after completion
      setIsOAuthFlow(false);
      if (oAuthFlowTimeout.current) {
        clearTimeout(oAuthFlowTimeout.current);
        oAuthFlowTimeout.current = null;
      }
    }
  }, [processOAuthUser]);

  // Listen for URL callbacks
  useEffect(() => {
    // Listen for incoming URLs when app resumes
    const handleUrl = (url: string) => {
      console.log("🔗 App opened with URL:", url);

      // Check if it's an OAuth callback
      if (url.includes("#access_token") || url.includes("code=")) {
        console.log("🔄 Processing OAuth callback");

        // Supabase should handle this automatically
        // Just check for session after a short delay
        setTimeout(async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            console.log("✅ Session established from URL");
          }
        }, 500);
      }
    };

    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Listen for URL changes
    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  // Initialize auth state - RUNS ONLY ONCE
  useEffect(() => {
    if (initializationAttempted.current) return;
    initializationAttempted.current = true;

    let authSubscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth state...");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        if (error) {
          console.error("❌ Error getting session:", error);
        } else if (session) {
          console.log("✅ Session found during initialization");
          setSession(session);
          setUser(session.user);
          setIsGuest(false);
        } else {
          // Check for guest mode
          const guestModeActive = await AsyncStorage.getItem(GUEST_MODE_KEY);
          if (guestModeActive === "true") {
            console.log("👻 Guest mode active from storage");
            setIsGuest(true);
          } else {
            console.log("ℹ️ No session found during initialization");
          }
        }
      } catch (error) {
        console.error("❌ Error initializing auth:", error);
      } finally {
        if (isMounted) {
          setInitialized(true);
          console.log("✅ Auth initialization complete");
        }
      }
    };

    initializeAuth();

    // Listen for auth changes with proper cleanup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state changed:", event, !!session);

      // Check if component is still mounted before updating state
      if (!isMounted) return;

      try {
        if (session) {
          setSession(session);
          setUser(session.user);
          setIsGuest(false);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          // Don't set guest mode here - only via explicit action
        }
      } catch (error) {
        console.error("❌ Error handling auth state change:", error);
      }
    });

    authSubscription = subscription;

    // Cleanup function
    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }
      console.log("🧹 Auth subscription cleaned up");
    };
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !profile && !isGuest) {
      console.log("🔄 User found, fetching profile...");
      fetchProfile(user.id)
        .then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            console.log("✅ Profile loaded");
          } else {
            console.log("⚠️ Profile not found");
          }
        })
        .catch((error) => {
          console.error("❌ Failed to fetch profile:", error);
        });
    }
  }, [user?.id, profile, fetchProfile, isGuest]);

  // Handle navigation
  useEffect(() => {
    if (!initialized) return;

    const navigate = async () => {
      // Prevent multiple simultaneous navigation attempts
      if (navigationInProgress.current) {
        console.log("🔒 Navigation already in progress, skipping...");
        return;
      }

      try {
        navigationInProgress.current = true;
        console.log("🔄 Handling navigation...", {
          hasSession: !!session,
          isGuest,
          platform: Platform.OS,
        });

        // Hide native splash ASAP once initialized – decouple from navigation success
        if (!nativeSplashHidden.current) {
          try {
            await SplashScreen.hideAsync();
            nativeSplashHidden.current = true;
            console.log("✅ Native splash hidden (post-init phase)");
          } catch (e) {
            console.warn("⚠️ Failed to hide native splash immediately:", e);
          }
        }

        // Add platform-specific delays for OAuth scenarios to prevent race conditions
        // Check if this is an OAuth flow by looking at recent auth events
        const recentAuthTime = session?.expires_at
          ? Date.now() -
            new Date(session.expires_at).getTime() +
            (session.expires_in || 3600) * 1000
          : Date.now();
        const isRecentAuth = recentAuthTime < 30000; // Less than 30 seconds ago

        const isOAuthFlow =
          isRecentAuth &&
          session?.user?.app_metadata?.provider &&
          ["google", "apple"].includes(session.user.app_metadata.provider);

        if (isOAuthFlow) {
          // Android devices need more time for OAuth navigation
          const oauthDelay = Platform.OS === "android" ? 3500 : 2000;
          console.log(
            `🔄 OAuth flow detected on ${Platform.OS}, adding ${oauthDelay}ms delay to prevent race conditions`,
          );
          await new Promise((resolve) => setTimeout(resolve, oauthDelay));
        } else if (Platform.OS === "android") {
          // Even non-OAuth Android navigation benefits from a small delay
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Verify router is ready before navigation
        if (!router || typeof router.replace !== "function") {
          console.warn("⚠️ Router not ready, scheduling retry");
          throw new Error("Router not ready");
        }

        // Simple navigation based on session or guest mode
        if (session || isGuest) {
          console.log(
            "✅ Session exists or guest mode, navigating to protected area",
          );
          router.replace("/(protected)/(tabs)");
        } else {
          console.log("ℹ️ No session and not guest, navigating to welcome");
          router.replace("/welcome");
        }
      } catch (error) {
        console.error("❌ Navigation error (will auto-recover):", error);

        // SILENT fallback navigation - never throw errors to UI
        const attemptFallbackNavigation = (attempt = 1) => {
          const maxAttempts = 5; // Increased attempts for more reliability
          const delay = Platform.OS === "android" ? attempt * 800 : 300;

          setTimeout(() => {
            try {
              console.log(
                `🔄 Silent fallback navigation attempt ${attempt}/${maxAttempts} on ${Platform.OS}`,
              );

              if (!router || typeof router.replace !== "function") {
                if (attempt < maxAttempts) {
                  console.log("Router still not ready, retrying silently...");
                  attemptFallbackNavigation(attempt + 1);
                  return;
                } else {
                  console.log(
                    "❌ Router unavailable after all attempts - user will see loading",
                  );
                  return;
                }
              }

              if (!nativeSplashHidden.current) {
                SplashScreen.hideAsync()
                  .then(() => {
                    nativeSplashHidden.current = true;
                    console.log("✅ Native splash hidden (fallback phase)");
                  })
                  .catch(() => {});
              }

              if (session || isGuest) {
                router.replace("/(protected)/(tabs)");
                console.log("✅ Silent fallback navigation to tabs successful");
              } else {
                router.replace("/welcome");
                console.log(
                  "✅ Silent fallback navigation to welcome successful",
                );
              }
            } catch (fallbackError) {
              console.log(
                `❌ Silent fallback navigation attempt ${attempt} failed (continuing):`,
                fallbackError,
              );

              if (attempt < maxAttempts) {
                attemptFallbackNavigation(attempt + 1);
              } else {
                console.log(
                  "❌ All silent fallback attempts completed - user will see loading",
                );
              }
            }
          }, delay);
        };

        attemptFallbackNavigation();
      } finally {
        // Always release the navigation lock after a delay
        setTimeout(() => {
          navigationInProgress.current = false;
        }, 500);
      }
    };

    // Platform-specific timeout - Android needs more time
    const initialTimeout = Platform.OS === "android" ? 500 : 300;
    const timeout = setTimeout(navigate, initialTimeout);

    return () => {
      clearTimeout(timeout);
      // Release navigation lock on cleanup
      navigationInProgress.current = false;
    };
  }, [initialized, session, isGuest, router]);

  // Dedicated effect: hide native splash once auth initializes (even if navigation effect is delayed)
  useEffect(() => {
    if (initialized && !nativeSplashHidden.current) {
      SplashScreen.hideAsync()
        .then(() => {
          nativeSplashHidden.current = true;
          console.log("✅ Native splash hidden (auth initialized)");
        })
        .catch(() => {});
    }
  }, [initialized]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", marginTop: 16 }}>Initializing...</Text>
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
        isGuest,
        signUp,
        signIn,
        signOut,
        updateProfile,
        refreshProfile,
        appleSignIn,
        googleSignIn,
        continueAsGuest,
        convertGuestToUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  return <AuthContent>{children}</AuthContent>;
}
