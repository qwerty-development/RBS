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
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as Sentry from "@sentry/react-native";

// Add this at the top of your AuthContent component
WebBrowser.maybeCompleteAuthSession();
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
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";
  created_at?: string;
  updated_at?: string;
};

type AuthState = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
  ) => Promise<void>;
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

// Sentry integration helpers
function updateSentryUserContext(user: User | null, profile: Profile | null) {
  try {
    Sentry.setUser(
      user
        ? {
            id: user.id,
            email: user.email,
            username: profile?.full_name,
            extra: {
              membershipTier: profile?.membership_tier,
              loyaltyPoints: profile?.loyalty_points,
              signUpMethod: user.app_metadata?.provider,
              createdAt: profile?.created_at,
              hasProfile: !!profile,
            },
          }
        : null,
    );

    // Set user-specific tags and context
    if (user && profile) {
      Sentry.setTag("membership_tier", profile.membership_tier || "bronze");
      Sentry.setTag("user_type", "authenticated");
      Sentry.setTag("auth_provider", user.app_metadata?.provider || "email");
      
      Sentry.setContext("user_preferences", {
        favorite_cuisines: profile.favorite_cuisines,
        dietary_restrictions: profile.dietary_restrictions,
        preferred_party_size: profile.preferred_party_size,
        notifications: profile.notification_preferences,
      });
    } else {
      Sentry.setTag("user_type", "anonymous");
      Sentry.setTag("auth_provider", "none");
    }
  } catch (error) {
    console.warn("Failed to update Sentry user context:", error);
  }
}

function addAuthBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: "info" | "warning" | "error" = "info",
) {
  Sentry.addBreadcrumb({
    message,
    category: "auth",
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

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
    scheme: "qwerty-booklet", // From your app.json
    preferLocalhost: false,
    isTripleSlashed: true,
  });

  console.log("🎯 OAuth Redirect URI:", redirectUri);

  // Fetch user profile with enhanced error handling and Sentry integration
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      try {
        console.log("🔄 Fetching profile for user:", userId);
        addAuthBreadcrumb("Fetching user profile", { userId });

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
            addAuthBreadcrumb("Profile not found", { userId }, "warning");
            return null;
          }

          // Log non-critical profile errors to Sentry
          Sentry.captureException(error, {
            tags: { 
              operation: "fetch_profile",
              error_code: error.code,
            },
            extra: { userId },
            level: "warning",
          });

          throw error;
        }

        console.log("✅ Profile fetched successfully");
        addAuthBreadcrumb("Profile fetched successfully", { 
          membershipTier: data.membership_tier,
          loyaltyPoints: data.loyalty_points,
        });
        
        return data;
      } catch (error) {
        console.error("❌ Unexpected error fetching profile:", error);
        Sentry.captureException(error, {
          tags: { operation: "fetch_profile" },
          extra: { userId },
          level: "error",
        });
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
        addAuthBreadcrumb("Processing OAuth user", { 
          userId: session.user.id,
          provider: session.user.app_metadata?.provider,
        });

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
            phone_number: null,
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
          addAuthBreadcrumb("Creating new profile for OAuth user", {
            provider: session.user.app_metadata?.provider,
            fullName: userName,
          });

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
            Sentry.captureException(createError, {
              tags: { 
                operation: "create_oauth_profile",
                provider: session.user.app_metadata?.provider,
              },
              extra: { userId: session.user.id },
              level: "error",
            });
            return null;
          }

          addAuthBreadcrumb("OAuth profile created successfully", {
            membershipTier: createdProfile.membership_tier,
          });

          return createdProfile as Profile;
        } else if (fetchError) {
          console.error("❌ Error fetching user profile:", fetchError);
          Sentry.captureException(fetchError, {
            tags: { 
              operation: "fetch_oauth_profile",
              provider: session.user.app_metadata?.provider,
            },
            extra: { userId: session.user.id },
            level: "error",
          });
          return null;
        }

        // Profile exists, return it
        addAuthBreadcrumb("Existing OAuth profile found", {
          membershipTier: existingProfile.membership_tier,
        });
        return existingProfile as Profile;
      } catch (error) {
        console.error("❌ Error processing OAuth user:", error);
        Sentry.captureException(error, {
          tags: { 
            operation: "process_oauth_user",
            provider: session.user.app_metadata?.provider,
          },
          extra: { userId: session.user.id },
          level: "error",
        });
        return null;
      }
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      phoneNumber?: string,
    ) => {
      try {
        console.log("🔄 Starting sign-up process for:", email);
        addAuthBreadcrumb("Starting email sign-up", { 
          email,
          hasPhoneNumber: !!phoneNumber,
        });

        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email,
            password,
            options: {
              emailRedirectTo: Linking.createURL("/auth-confirm"),
              data: {
                full_name: fullName,
                phone_number: phoneNumber,
              },
            },
          },
        );

        if (authError) {
          console.error("❌ Auth sign-up error:", authError);
          Sentry.captureException(authError, {
            tags: { 
              operation: "email_signup",
              error_code: authError.message,
            },
            extra: { email },
            level: "error",
          });
          throw authError;
        }

        console.log("✅ Auth sign-up successful");
        addAuthBreadcrumb("Auth sign-up successful", {
          needsConfirmation: !authData.session,
        });

        // Create profile if user was created
        if (authData.user && !authData.session) {
          console.log("ℹ️ User created but needs email confirmation");
          addAuthBreadcrumb("Email confirmation required");
          
          Alert.alert(
            "Check Your Email",
            "We've sent you a confirmation link. Please check your email and click the link to activate your account.",
            [{ text: "OK" }],
          );
        } else if (authData.user && authData.session) {
          console.log("🔄 Creating user profile...");
          addAuthBreadcrumb("Creating user profile after signup");

          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: authData.user.id,
              full_name: fullName,
              phone_number: phoneNumber,
              loyalty_points: 0,
              membership_tier: "bronze",
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
            Sentry.captureException(profileError, {
              tags: { operation: "create_profile_after_signup" },
              extra: { userId: authData.user.id },
              level: "warning",
            });
          } else {
            console.log("✅ Profile created successfully");
            addAuthBreadcrumb("Profile created successfully");
          }
        }
      } catch (error) {
        console.error("❌ Sign-up error:", error);
        Sentry.captureException(error, {
          tags: { operation: "signup" },
          extra: { email },
          level: "error",
        });
        throw error;
      }
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log("🔄 Starting sign-in process for:", email);
      addAuthBreadcrumb("Starting email sign-in", { email });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("❌ Sign-in error:", error);
        Sentry.captureException(error, {
          tags: { 
            operation: "email_signin",
            error_code: error.message,
          },
          extra: { email },
          level: "error",
        });
        throw error;
      }

      console.log("✅ Sign-in successful");
      addAuthBreadcrumb("Email sign-in successful", {
        userId: data.user?.id,
      });
    } catch (error) {
      console.error("❌ Sign-in error:", error);
      Sentry.captureException(error, {
        tags: { operation: "signin" },
        level: "error",
      });
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log("🔄 Starting sign-out process...");
      addAuthBreadcrumb("Starting sign-out");

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("❌ Sign-out error:", error);
        Sentry.captureException(error, {
          tags: { operation: "signout" },
          level: "error",
        });
        throw error;
      }

      console.log("✅ Sign-out successful");
      addAuthBreadcrumb("Sign-out successful");
      
      // Clear Sentry user context
      updateSentryUserContext(null, null);
      
    } catch (error) {
      console.error("❌ Sign-out error:", error);
      Sentry.captureException(error, {
        tags: { operation: "signout" },
        level: "error",
      });
      throw error;
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) {
        const error = new Error("No user logged in");
        Sentry.captureException(error, {
          tags: { operation: "update_profile" },
          level: "warning",
        });
        throw error;
      }

      try {
        console.log("🔄 Updating profile...");
        addAuthBreadcrumb("Updating profile", { 
          fields: Object.keys(updates),
          userId: user.id,
        });

        const { data, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          console.error("❌ Profile update error:", error);
          Sentry.captureException(error, {
            tags: { operation: "update_profile" },
            extra: { 
              userId: user.id,
              updates: Object.keys(updates),
            },
            level: "error",
          });
          throw error;
        }

        setProfile(data);
        console.log("✅ Profile updated successfully");
        addAuthBreadcrumb("Profile updated successfully", {
          membershipTier: data.membership_tier,
        });
        
        // Update Sentry context with new profile data
        updateSentryUserContext(user, data);
        
      } catch (error) {
        console.error("❌ Error updating profile:", error);
        Sentry.captureException(error, {
          tags: { operation: "update_profile" },
          level: "error",
        });
        throw error;
      }
    },
    [user],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    try {
      console.log("🔄 Refreshing profile...");
      addAuthBreadcrumb("Refreshing profile", { userId: user.id });
      
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        console.log("✅ Profile refreshed successfully");
        addAuthBreadcrumb("Profile refreshed successfully");
        
        // Update Sentry context
        updateSentryUserContext(user, profileData);
      }
    } catch (error) {
      console.error("❌ Error refreshing profile:", error);
      Sentry.captureException(error, {
        tags: { operation: "refresh_profile" },
        extra: { userId: user.id },
        level: "warning",
      });
    }
  }, [user, fetchProfile]);

  // Apple Sign In implementation with Sentry integration
  const appleSignIn = useCallback(async () => {
    try {
      addAuthBreadcrumb("Starting Apple sign-in");
      
      // Check if Apple Authentication is available on this device
      if (Platform.OS !== "ios") {
        const error = new Error(
          "Apple authentication is only available on iOS devices",
        );
        addAuthBreadcrumb("Apple auth not available on platform", {
          platform: Platform.OS,
        }, "warning");
        return { error };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        const error = new Error(
          "Apple authentication is not available on this device",
        );
        addAuthBreadcrumb("Apple auth not available on device", {}, "warning");
        return { error };
      }

      addAuthBreadcrumb("Requesting Apple authentication");

      // Request authentication with Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      addAuthBreadcrumb("Apple credential received", {
        hasIdentityToken: !!credential.identityToken,
        hasEmail: !!credential.email,
      });

      // Sign in via Supabase Auth
      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });

        if (error) {
          console.error("❌ Apple auth error:", error);
          Sentry.captureException(error, {
            tags: { 
              operation: "apple_signin",
              provider: "apple",
            },
            level: "error",
          });
          return { error };
        }

        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          console.log("✅ User signed in with Apple:", data.user);
          addAuthBreadcrumb("Apple sign-in successful", {
            userId: data.user.id,
          });

          // Process OAuth user profile
          const userProfile = await processOAuthUser(data.session);
          if (userProfile) {
            setProfile(userProfile);
            updateSentryUserContext(data.session.user, userProfile);
            
            // Check if profile needs additional info (like phone number)
            const needsUpdate = !userProfile.phone_number;
            addAuthBreadcrumb("Apple profile processed", {
              needsProfileUpdate: needsUpdate,
            });
            return { needsProfileUpdate: needsUpdate };
          }
        }
      } else {
        const error = new Error("No identity token received from Apple");
        addAuthBreadcrumb("Apple auth failed - no identity token", {}, "error");
        return { error };
      }

      return {};
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        console.log("User canceled Apple sign-in");
        addAuthBreadcrumb("Apple sign-in canceled by user");
        return {}; // Not an error, just a cancellation
      }

      console.error("❌ Apple authentication error:", error);
      Sentry.captureException(error, {
        tags: { 
          operation: "apple_signin",
          error_code: error.code,
        },
        level: "error",
      });
      return { error: error as Error };
    }
  }, [processOAuthUser]);

  const googleSignIn = useCallback(async () => {
    try {
      console.log("🚀 Starting Google sign in");
      addAuthBreadcrumb("Starting Google sign-in");

      // Create the redirect URI - use expo-auth-session format
      const redirectUrl = makeRedirectUri({
        scheme: "qwerty-booklet",
        preferLocalhost: false,
        isTripleSlashed: true,
        native: "qwerty-booklet://google",
      });

      console.log("🎯 Using redirect URL:", redirectUrl);
      addAuthBreadcrumb("Google OAuth redirect URL created", { redirectUrl });

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
        Sentry.captureException(error || new Error("No OAuth URL received"), {
          tags: { 
            operation: "google_oauth_init",
            provider: "google",
          },
          level: "error",
        });
        return { error: error || new Error("No OAuth URL received") };
      }

      console.log("🌐 Opening Google auth session");
      addAuthBreadcrumb("Opening Google auth session");

      // Step 2: Set up a URL listener BEFORE opening the browser
      let urlSubscription: any;
      const urlPromise = new Promise<string>((resolve, reject) => {
        // Listen for the redirect
        urlSubscription = Linking.addEventListener("url", (event) => {
          console.log("🔗 Received URL:", event.url);
          addAuthBreadcrumb("OAuth callback URL received", { 
            hasGoogleParam: event.url.includes("google"),
            hasAccessToken: event.url.includes("#access_token"),
            hasCode: event.url.includes("code="),
          });
          
          if (
            event.url.includes("google") ||
            event.url.includes("#access_token") ||
            event.url.includes("code=")
          ) {
            resolve(event.url);
          }
        });

        // Set a timeout
        setTimeout(() => {
          addAuthBreadcrumb("Google OAuth timeout", {}, "error");
          reject(new Error("OAuth timeout"));
        }, 120000); // 2 minutes
      });

      // Step 3: Open the browser
      const browserPromise = WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        {
          showInRecents: false,
          createTask: false,
          preferEphemeralSession: false, // Changed to false to allow account selection
        },
      );

      // Step 4: Wait for either the browser to close or URL to be received
      try {
        const result = await Promise.race([
          browserPromise,
          urlPromise.then((url) => ({ type: "success" as const, url })),
        ]);

        console.log("📱 Auth result:", result);
        addAuthBreadcrumb("Google OAuth result received", {
          type: result.type,
          hasUrl: !!(result as any).url,
        });

        // Clean up the URL listener
        if (urlSubscription) {
          urlSubscription.remove();
        }

        if (result.type === "success" && (result as any).url) {
          console.log("✅ OAuth callback received");
          addAuthBreadcrumb("OAuth callback processing started");

          // Step 5: Parse the callback URL
          const url = new URL((result as any).url);

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
            const error = new Error(error_description);
            Sentry.captureException(error, {
              tags: { 
                operation: "google_oauth_callback",
                provider: "google",
              },
              level: "error",
            });
            return { error };
          }

          // Step 6: Handle code exchange
          if (code && !access_token) {
            console.log("🔄 Exchanging code for session");
            addAuthBreadcrumb("Exchanging OAuth code for session");

            const { data: sessionData, error: sessionError } =
              await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
              console.error("❌ Code exchange error:", sessionError);
              Sentry.captureException(sessionError, {
                tags: { 
                  operation: "google_code_exchange",
                  provider: "google",
                },
                level: "error",
              });
              return { error: sessionError };
            }

            if (sessionData?.session) {
              console.log("🎉 Session established via code exchange");
              addAuthBreadcrumb("Google session established via code exchange");
              // Session will be handled by onAuthStateChange
              return {};
            }
          }

          // Step 7: Handle direct token
          if (access_token) {
            console.log("✅ Access token found, setting session");
            addAuthBreadcrumb("Setting session with access token");

            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token,
                refresh_token: refresh_token || "",
              });

            if (sessionError) {
              console.error("❌ Session creation failed:", sessionError);
              Sentry.captureException(sessionError, {
                tags: { 
                  operation: "google_set_session",
                  provider: "google",
                },
                level: "error",
              });
              return { error: sessionError };
            }

            if (sessionData?.session) {
              console.log("🎉 Session established via tokens");
              addAuthBreadcrumb("Google session established via tokens");
              // Session will be handled by onAuthStateChange
              return {};
            }
          }

          // Step 8: Final fallback check
          console.log("🔄 Checking for session via getSession");
          addAuthBreadcrumb("Checking for session as fallback");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait a bit

          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession) {
            console.log("✅ Session found via getSession");
            addAuthBreadcrumb("Google session found via getSession");
            return {};
          }

          console.error("❌ No session established after OAuth");
          const error = new Error("Failed to establish session");
          Sentry.captureException(error, {
            tags: { 
              operation: "google_session_establishment",
              provider: "google",
            },
            level: "error",
          });
          return { error };
        } else if (result.type === "cancel") {
          console.log("👤 User canceled Google sign-in");
          addAuthBreadcrumb("Google sign-in canceled by user");
          return {};
        } else {
          console.error("❌ OAuth flow failed");
          const error = new Error("OAuth flow failed");
          addAuthBreadcrumb("Google OAuth flow failed", {}, "error");
          Sentry.captureException(error, {
            tags: { 
              operation: "google_oauth_flow",
              provider: "google",
            },
            level: "error",
          });
          return { error };
        }
      } catch (timeoutError) {
        // Clean up listener if timeout
        if (urlSubscription) {
          urlSubscription.remove();
        }
        console.error("⏱️ OAuth timeout:", timeoutError);
        addAuthBreadcrumb("Google OAuth timeout occurred", {}, "error");

        // Check if session was created anyway
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          console.log("✅ Session found despite timeout");
          addAuthBreadcrumb("Google session found despite timeout");
          return {};
        }

        Sentry.captureException(timeoutError, {
          tags: { 
            operation: "google_oauth_timeout",
            provider: "google",
          },
          level: "warning",
        });
        return { error: new Error("OAuth timeout") };
      }
    } catch (error) {
      console.error("💥 Google sign in error:", error);
      Sentry.captureException(error, {
        tags: { 
          operation: "google_signin",
          provider: "google",
        },
        level: "error",
      });
      return { error: error as Error };
    }
  }, []);

  // Make sure you have this in your AuthContent component
  useEffect(() => {
    // Listen for incoming URLs when app resumes
    const handleUrl = (url: string) => {
      console.log("🔗 App opened with URL:", url);
      addAuthBreadcrumb("App opened with URL", { url });

      // Check if it's an OAuth callback
      if (url.includes("#access_token") || url.includes("code=")) {
        console.log("🔄 Processing OAuth callback");
        addAuthBreadcrumb("Processing OAuth callback from URL");

        // Supabase should handle this automatically
        // Just check for session after a short delay
        setTimeout(async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            console.log("✅ Session established from URL");
            addAuthBreadcrumb("Session established from incoming URL");
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

    const initializeAuth = async () => {
      try {
        console.log("🔄 Initializing auth state...");
        addAuthBreadcrumb("Initializing auth state");

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("❌ Error getting session:", error);
          Sentry.captureException(error, {
            tags: { operation: "auth_init_get_session" },
            level: "error",
          });
        } else if (session) {
          console.log("✅ Session found during initialization");
          addAuthBreadcrumb("Session found during initialization", {
            userId: session.user.id,
            provider: session.user.app_metadata?.provider,
          });
          setSession(session);
          setUser(session.user);
        } else {
          console.log("ℹ️ No session found during initialization");
          addAuthBreadcrumb("No session found during initialization");
        }
      } catch (error) {
        console.error("❌ Error initializing auth:", error);
        Sentry.captureException(error, {
          tags: { operation: "auth_initialization" },
          level: "error",
        });
      } finally {
        setInitialized(true);
        console.log("✅ Auth initialization complete");
        addAuthBreadcrumb("Auth initialization complete");
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state changed:", event, !!session);
      addAuthBreadcrumb(`Auth state changed: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id,
        provider: session?.user?.app_metadata?.provider,
      });

      try {
        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Update Sentry context immediately with user info
          updateSentryUserContext(session.user, profile);
          
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          
          // Clear Sentry context
          updateSentryUserContext(null, null);
        }
      } catch (error) {
        console.error("❌ Error handling auth state change:", error);
        Sentry.captureException(error, {
          tags: { 
            operation: "auth_state_change",
            event,
          },
          level: "error",
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !profile) {
      console.log("🔄 User found, fetching profile...");
      addAuthBreadcrumb("User found, fetching profile", { userId: user.id });
      
      fetchProfile(user.id)
        .then((profileData) => {
          if (profileData) {
            setProfile(profileData);
            console.log("✅ Profile loaded");
            addAuthBreadcrumb("Profile loaded successfully", {
              membershipTier: profileData.membership_tier,
              loyaltyPoints: profileData.loyalty_points,
            });
            
            // Update Sentry context with complete user + profile data
            updateSentryUserContext(user, profileData);
          } else {
            console.log("⚠️ Profile not found");
            addAuthBreadcrumb("Profile not found", {}, "warning");
            
            // Still update Sentry with user data only
            updateSentryUserContext(user, null);
          }
        })
        .catch((error) => {
          console.error("❌ Failed to fetch profile:", error);
          Sentry.captureException(error, {
            tags: { operation: "fetch_profile_after_auth" },
            extra: { userId: user.id },
            level: "warning",
          });
          
          // Still update Sentry with user data only
          updateSentryUserContext(user, null);
        });
    }
  }, [user?.id, profile, fetchProfile]);

  // Handle navigation
  useEffect(() => {
    if (!initialized) return;

    const navigate = async () => {
      try {
        console.log("🔄 Handling navigation...", { hasSession: !!session });
        addAuthBreadcrumb("Handling navigation", { 
          hasSession: !!session,
          hasProfile: !!profile,
        });

        // Hide splash screen only once
        if (!splashHidden.current) {
          await SplashScreen.hideAsync();
          splashHidden.current = true;
          console.log("✅ Splash screen hidden");
          addAuthBreadcrumb("Splash screen hidden");
        }

        // Simple navigation based on session
        if (session) {
          console.log("✅ Session exists, navigating to protected area");
          addAuthBreadcrumb("Navigating to protected area");
          router.replace("/(protected)/(tabs)");
        } else {
          console.log("ℹ️ No session, navigating to welcome");
          addAuthBreadcrumb("Navigating to welcome screen");
          router.replace("/welcome");
        }
      } catch (error) {
        console.error("❌ Navigation error:", error);
        Sentry.captureException(error, {
          tags: { operation: "navigation" },
          level: "error",
        });
        
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
  }, [initialized, session, router, profile]);

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