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
import {
  unregisterDeviceForPush,
  registerDeviceForPush,
} from "@/lib/notifications/setup";

const GUEST_MODE_KEY = "guest-mode-active";

// Add this at the top of your AuthContent component
WebBrowser.maybeCompleteAuthSession();

// AGGRESSIVE SPLASH HIDING: Hide splash as soon as possible, don't wait for complex logic
let splashHideAttempted = false;
const hideSplashImmediately = () => {
  if (!splashHideAttempted) {
    splashHideAttempted = true;
    SplashScreen.hideAsync().catch(() => {});
  }
};

// Multiple aggressive timeouts to ensure splash never stays visible
setTimeout(hideSplashImmediately, 100); // 100ms - almost immediate
setTimeout(hideSplashImmediately, 500); // 500ms - backup
setTimeout(hideSplashImmediately, 1000); // 1s - third attempt
setTimeout(hideSplashImmediately, 2000); // 2s - final backup

// Initial prevention (but will be overridden quickly)
SplashScreen.preventAutoHideAsync().catch(() => {});

// Profile type definition
type Profile = {
  id: string;
  first_name?: string;
  last_name?: string;
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
  onboarded?: boolean;
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  initialized: boolean;
  databaseReady: boolean; // NEW: Database readiness state
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
    firstName?: string,
    lastName?: string,
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
  databaseReady: false,
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
  const [databaseReady, setDatabaseReady] = useState(false); // NEW: Database readiness state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(false); // NEW: Guest state
  const [isOAuthFlow, setIsOAuthFlow] = useState(false); // NEW: OAuth flow tracker

  const router = useRouter();
  const initializationAttempted = useRef(false);
  const oAuthFlowTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationInProgress = useRef(false); // Prevent multiple navigation attempts

  // Create redirect URI for OAuth
  const redirectUri = makeRedirectUri({
    scheme: "qwerty-plate", // From your app.json
    preferLocalhost: false,
    isTripleSlashed: true,
  });

  // NEW: Continue as guest function
  const continueAsGuest = useCallback(async () => {
    try {
      await AsyncStorage.setItem(GUEST_MODE_KEY, "true");
      setIsGuest(true);
      setSession(null);
      setUser(null);
      setProfile(null);
      // Navigate to main app
      router.replace("/(protected)/(tabs)");
    } catch (error) {
      // Failed to save guest mode status
    }
  }, [router]);

  // NEW: Convert guest to user (redirect to welcome)
  const convertGuestToUser = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);
      router.replace("/welcome");
    } catch (error) {
      // Failed to clear guest mode status
    }
  }, [router]);

  // NEW: Database readiness check
  const checkDatabaseReadiness = useCallback(async (): Promise<boolean> => {
    try {
      // Simple query to test database connectivity
      const { data, error } = await supabase
        .from("restaurants")
        .select("id")
        .limit(1);

      if (error) {
        // Database readiness check failed
        return false;
      }

      return true;
    } catch (error) {
      // Database readiness check error
      return false;
    }
  }, []);

  // Fetch user profile with enhanced error handling
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          // Error fetching profile

          // If profile doesn't exist, try to create it
          if (error.code === "PGRST116") {
            return null;
          }

          throw error;
        }

        return data;
      } catch (error) {
        // Unexpected error fetching profile
        return null;
      }
    },
    [],
  );

  // Process OAuth user - create profile if needed
  const processOAuthUser = useCallback(
    async (session: Session): Promise<Profile | null> => {
      try {
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
            onboarded: false,
            notification_preferences: {
              email: true,
              push: true,
              sms: false,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert([newProfile])
            .select()
            .single();

          if (createError) {
            // Error creating profile after OAuth
            return null;
          }

          return createdProfile as Profile;
        } else if (fetchError) {
          // Error fetching user profile
          return null;
        }

        // Profile exists, return it
        return existingProfile as Profile;
      } catch (error) {
        // Error processing OAuth user
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
        firstName?: string,
        lastName?: string,
      ) => {
        try {
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
                emailRedirectTo: "https://plate-app.com/verify-email",
                data: {
                  full_name: fullName,
                  phone_number: phoneNumber,
                  date_of_birth: dateOfBirth,
                },
              },
            });

          if (authError) {
            // Auth sign-up error

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

          // Create profile if user was created
          if (authData.user && !authData.session) {
            Alert.alert(
              "Check Your Email",
              "We've sent you a confirmation link. Please check your email and click the link to activate your account.",
              [
                {
                  text: "OK",
                  onPress: () => {
                    router.replace("/sign-in");
                  },
                },
              ],
            );
          } else if (authData.user && authData.session) {
            // Register device for the new user
            await DeviceSecurity.registerDeviceForUser(authData.user.id);

            const { error: profileError } = await supabase
              .from("profiles")
              .insert({
                id: authData.user.id,
                full_name: fullName,
                first_name: firstName || "",
                last_name: lastName || "",
                phone_number: phoneNumber,
                date_of_birth: dateOfBirth,
                loyalty_points: 0,
                membership_tier: "bronze",
                user_rating: 5.0, // New users start with excellent rating
                onboarded: false,
                notification_preferences: {
                  email: true,
                  push: true,
                  sms: false,
                },
              });

            if (profileError) {
              // Profile creation error (non-critical)
            } else {
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
          // Sign-up error
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
            // Try to get user_id from email for better security tracking
            let userId = null;
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();
              userId = profileData?.id || null;
            } catch (profileError) {
              // User doesn't exist or other error - continue with null userId
            }

            await SecurityMonitor.monitorSuspiciousActivity({
              type: "multiple_failed_logins",
              userId,
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
            // Sign-in error

            // Try to get user_id from email for better security tracking
            let userId = null;
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();
              userId = profileData?.id || null;
            } catch (profileError) {
              // User doesn't exist or other error - continue with null userId
            }

            // Monitor failed login attempts
            try {
              await SecurityMonitor.monitorSuspiciousActivity({
                type: "multiple_failed_logins",
                userId,
                metadata: {
                  email,
                  error: error.message,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (securityError) {
              // Security monitoring failed - log but don't block user
            }

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
        } catch (error) {
          // Sign-in error
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
      // Clear guest mode
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      setIsGuest(false);

      if (user?.id) {
        await unregisterDeviceForPush(user.id);
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        // Sign-out error
        throw error;
      }
    } catch (error) {
      // Sign-out error
      throw error;
    }
  }, [user]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) {
        throw new Error("No user logged in");
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          // Profile update error
          throw error;
        }

        setProfile(data);
        // Profile updated successfully
      } catch (error) {
        // Error updating profile
        throw error;
      }
    },
    [user],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      // Refreshing profile
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        // Profile refreshed successfully
      }
    } catch (error) {
      // Error refreshing profile
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
          // Apple auth error
          return { error };
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          // User signed in with Apple

          // Process OAuth user profile
          const userProfile = await processOAuthUser(data.session);
          if (userProfile) {
            console.log(
              "🍎 [Apple OAuth] Profile obtained, setting profile...",
            );
            setProfile(userProfile);

            // Register device for push notifications immediately after profile is set
            console.log(
              "🍎 [Apple OAuth] Registering device for push notifications...",
            );
            try {
              await registerDeviceForPush(userProfile.id);
              console.log("🍎 [Apple OAuth] Device registered successfully");
            } catch (error) {
              console.error(
                "🍎 [Apple OAuth] Failed to register device:",
                error,
              );
              // Failed to register device for push notifications, will retry on app restart
            }

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
        // User canceled Apple sign-in
        return {}; // Not an error, just a cancellation
      }

      // Apple authentication error
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
        // OAuth flow timeout, clearing state
        setIsOAuthFlow(false);
      }, 60000); // 1 minute timeout

      // Starting Google sign in

      // Create the redirect URI using plate scheme for consistency
      const redirectUrl = "plate://auth-callback";

      // Using redirect URL

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
        // Error initiating Google OAuth
        return { error: error || new Error("No OAuth URL received") };
      }

      // Opening Google auth session

      // Step 2: Set up a URL listener BEFORE opening the browser
      let urlSubscription: any;
      const urlPromise = new Promise<string>((resolve, reject) => {
        // Listen for the redirect
        urlSubscription = Linking.addEventListener("url", (event) => {
          // Received URL
          if (
            event.url.includes("auth-callback") ||
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

        // Auth result

        // Clean up the URL listener
        if (urlSubscription) {
          urlSubscription.remove();
        }

        if (result.type === "success" && result.url) {
          // OAuth callback received

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
            // OAuth error
            return { error: new Error(error_description) };
          }

          // Step 6: Handle code exchange
          if (code && !access_token) {
            // Exchanging code for session

            const { data: sessionData, error: sessionError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
              // Code exchange error
              return { error: sessionError };
            }

            if (sessionData?.session) {
              // Session established via code exchange

              // Android needs more time to process OAuth state changes
              const processingDelay = Platform.OS === "android" ? 1000 : 500;
              await new Promise((resolve) =>
                setTimeout(resolve, processingDelay),
              );

              // Process OAuth user profile
              const userProfile = await processOAuthUser(sessionData.session);
              if (userProfile) {
                setProfile(userProfile);

                // Register device for push notifications immediately after profile is set
                try {
                  await registerDeviceForPush(userProfile.id);
                  // Device registered for push notifications after Google sign-in (code exchange)
                } catch (error) {
                  // Failed to register device for push notifications, will retry on app restart
                }

                // Check if profile needs additional info
                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          // Step 7: Handle direct token
          if (access_token) {
            // Access token found, setting session

            // Platform-specific delay for proper state handling
            const stateDelay = Platform.OS === "android" ? 800 : 300;
            await new Promise((resolve) => setTimeout(resolve, stateDelay));

            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token || "",
              });

            if (sessionError) {
              // Session creation failed
              return { error: sessionError };
            }

            if (sessionData?.session) {
              // Session established via tokens
              // Process OAuth user profile
              const userProfile = await processOAuthUser(sessionData.session);
              if (userProfile) {
                setProfile(userProfile);

                // Register device for push notifications immediately after profile is set
                try {
                  await registerDeviceForPush(userProfile.id);
                  // Device registered for push notifications after Google sign-in (direct token)
                } catch (error) {
                  // Failed to register device for push notifications, will retry on app restart
                }

                // Check if profile needs additional info
                const needsUpdate = !userProfile.phone_number;
                return { needsProfileUpdate: needsUpdate };
              }
              return {};
            }
          }

          // Step 8: Final fallback check with extended wait for Android
          // Checking for session via getSession
          const fallbackWait = Platform.OS === "android" ? 2000 : 1000;
          await new Promise((resolve) => setTimeout(resolve, fallbackWait));

          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession) {
            // Session found via getSession
            // Process OAuth user profile
            const userProfile = await processOAuthUser(currentSession);
            if (userProfile) {
              setProfile(userProfile);

              // Register device for push notifications immediately after profile is set
              try {
                await registerDeviceForPush(userProfile.id);
                // Device registered for push notifications after Google sign-in (fallback)
              } catch (error) {
                // Failed to register device for push notifications, will retry on app restart
              }

              // Check if profile needs additional info
              const needsUpdate = !userProfile.phone_number;
              return { needsProfileUpdate: needsUpdate };
            }
            return {};
          }

          // No session established after OAuth
          return { error: new Error("Failed to establish session") };
        } else if (result.type === "cancel") {
          // User canceled Google sign-in
          return {};
        } else {
          // OAuth flow failed
          return { error: new Error("OAuth flow failed") };
        }
      } catch (timeoutError) {
        // Clean up listener if timeout
        if (urlSubscription) {
          urlSubscription.remove();
        }
        // OAuth timeout

        // Check if session was created anyway
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          // Session found despite timeout
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
      // Google sign in error
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
    const handleUrl = async (url: string) => {
      // App opened with URL

      // Check if it's an OAuth callback
      if (url.includes("#access_token") || url.includes("code=")) {
        // Processing OAuth callback
        try {
          // Explicitly exchange code for session
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(url);

          if (error) {
            console.error("Error exchanging code for session:", error);
            return;
          }

          if (data?.session) {
            // Session established from URL
          }
        } catch (err) {
          console.error("Failed to process auth callback URL:", err);
        }
      }
    };

    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url).catch((err) =>
          console.error("Error handling initial URL:", err),
        );
      }
    });

    // Listen for URL changes
    const subscription = Linking.addEventListener("url", (event) => {
      if (event.url) {
        // Need to handle async function properly
        handleUrl(event.url).catch((err) =>
          console.error("Error handling incoming URL:", err),
        );
      }
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
        // Initializing auth state

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        // Check if component is still mounted before updating state
        if (!isMounted) return;

        if (error) {
          // Error getting session
        } else if (session) {
          // Session found during initialization
          setSession(session);
          setUser(session.user);
          setIsGuest(false);
        } else {
          // Check for guest mode
          const guestModeActive = await AsyncStorage.getItem(GUEST_MODE_KEY);
          if (guestModeActive === "true") {
            // Guest mode active from storage
            setIsGuest(true);
          } else {
            // No session found during initialization
          }
        }
      } catch (error) {
        // Error initializing auth
      } finally {
        if (isMounted) {
          setInitialized(true);
          // Auth initialization complete
        }
      }
    };

    // Check database readiness in background (non-blocking)
    const checkDatabaseReadinessBackground = async () => {
      try {
        // Add retries for cold start scenarios with exponential backoff
        let databaseReadySuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Database readiness attempt

          const isReady = await checkDatabaseReadiness();
          if (isReady) {
            databaseReadySuccess = true;
            break;
          }

          // Exponential backoff: 1s, 2s, 4s
          if (attempt < 3) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            // Retrying database check
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        if (isMounted) {
          setDatabaseReady(databaseReadySuccess);
          // Database readiness check result
        }
      } catch (error) {
        // Error checking database readiness (non-critical)
        if (isMounted) {
          setDatabaseReady(false);
        }
      }
    };

    initializeAuth();
    checkDatabaseReadinessBackground();

    // Listen for auth changes with proper cleanup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Auth state changed

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
        // Error handling auth state change
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
      // Auth subscription cleaned up
    };
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !profile && !isGuest) {
      // User found, fetching profile
      fetchProfile(user.id)
        .then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            // Profile loaded
          } else {
            // Profile not found
          }
        })
        .catch((error) => {
          // Failed to fetch profile
        });
    }
  }, [user?.id, profile, fetchProfile, isGuest]);

  // Helper function to check for pending deeplinks
  const checkForPendingDeeplink = useCallback(async (): Promise<boolean> => {
    try {
      // Check for initial URL that might be a deeplink
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl) return false;

      // Ignore development URLs
      const isDevelopmentUrl =
        initialUrl.startsWith("exp://") ||
        initialUrl.startsWith("exps://") ||
        initialUrl.includes(":8081") ||
        initialUrl.includes("localhost") ||
        initialUrl.includes("127.0.0.1") ||
        initialUrl.startsWith("file://");

      if (isDevelopmentUrl) return false;

      // Check if it's a supported deeplink (not just any URL)
      const isSupportedScheme =
        initialUrl.startsWith("plate://") ||
        initialUrl.startsWith("qwerty-plate://") ||
        initialUrl.startsWith("com.notqwerty.plate://") ||
        initialUrl.startsWith("https://plate-app.com") ||
        initialUrl.startsWith("https://www.plate-app.com");

      if (!isSupportedScheme) return false;

      // If we got here, there's likely a valid deeplink pending
      // Detected pending deeplink during auth navigation
      return true;
    } catch (error) {
      // Error checking for pending deeplinks
      return false;
    }
  }, []);

  // Handle navigation
  useEffect(() => {
    if (!initialized) return;

    const navigate = async () => {
      // Prevent multiple simultaneous navigation attempts
      if (navigationInProgress.current) {
        // Navigation already in progress, skipping
        return;
      }

      try {
        navigationInProgress.current = true;
        // Handling navigation

        // CRITICAL: Check for pending deeplinks during cold start
        // Give deeplink processing priority during app initialization
        const hasPendingDeeplink = await checkForPendingDeeplink();
        if (hasPendingDeeplink) {
          // Pending deeplink detected, deferring auth navigation
          // Allow extra time for deeplink processing during cold start
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Recheck after delay - if deeplink processing failed, we'll handle navigation
          const stillPendingDeeplink = await checkForPendingDeeplink();
          if (stillPendingDeeplink) {
            // Deeplink still pending after delay, continuing with auth navigation
          } else {
            // Deeplink processed successfully, skipping auth navigation
            return;
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
          // OAuth flow detected, adding delay to prevent race conditions
          await new Promise((resolve) => setTimeout(resolve, oauthDelay));
        } else if (Platform.OS === "android") {
          // Even non-OAuth Android navigation benefits from a small delay
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Verify router is ready before navigation
        if (!router || typeof router.replace !== "function") {
          // Router not ready, scheduling retry
          throw new Error("Router not ready");
        }

        // Simple navigation based on session or guest mode
        if (session || isGuest) {
          // Session exists or guest mode, navigating to protected area
          router.replace("/(protected)/(tabs)");
        } else {
          // No session and not guest, navigating to welcome
          router.replace("/welcome");
        }
      } catch (error) {
        // Navigation error (will auto-recover)

        // SILENT fallback navigation - never throw errors to UI
        const attemptFallbackNavigation = (attempt = 1) => {
          const maxAttempts = 5; // Increased attempts for more reliability
          const delay = Platform.OS === "android" ? attempt * 800 : 300;

          setTimeout(() => {
            try {
              // Silent fallback navigation attempt

              if (!router || typeof router.replace !== "function") {
                if (attempt < maxAttempts) {
                  // Router still not ready, retrying silently
                  attemptFallbackNavigation(attempt + 1);
                  return;
                } else {
                  // Router unavailable after all attempts - user will see loading
                  return;
                }
              }

              try {
                if (session || isGuest) {
                  router.replace("/(protected)/(tabs)");
                  // Silent fallback navigation to tabs successful
                } else {
                  router.replace("/welcome");
                  // Silent fallback navigation to welcome successful
                }
              } catch (fallbackError) {
                // Silent fallback navigation attempt failed (continuing)

                if (attempt < maxAttempts) {
                  attemptFallbackNavigation(attempt + 1);
                } else {
                  // All silent fallback attempts completed - user will see loading
                }
              }
            } catch (outerError) {
              // Outer error in fallback attempt
              if (attempt < maxAttempts) {
                attemptFallbackNavigation(attempt + 1);
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

  return (
    <AuthContext.Provider
      value={{
        initialized,
        databaseReady,
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
