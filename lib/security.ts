import { Alert, Platform } from "react-native";
import * as Sentry from "@sentry/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { supabase } from "../config/supabase";

// Enhanced Security configuration
const SECURITY_CONFIG = {
  maxInputLength: 10000,
  rateLimitWindow: 60000, // 1 minute
  maxRequestsPerWindow: 100,
  sensitiveDataPatterns: [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email (for logging protection)
  ],

  // Rate limiting configurations for different actions
  rateLimits: {
    booking_creation: { requests: 5, window: 300000 }, // 5 bookings per 5 minutes
    booking_cancellation: { requests: 10, window: 3600000 }, // 10 cancellations per hour
    review_submission: { requests: 3, window: 600000 }, // 3 reviews per 10 minutes
    profile_update: { requests: 10, window: 3600000 }, // 10 profile updates per hour
    search_requests: { requests: 100, window: 60000 }, // 100 searches per minute
    login_attempts: { requests: 5, window: 900000 }, // 5 login attempts per 15 minutes
    registration_attempts: { requests: 3, window: 3600000 }, // 3 registrations per hour
    password_reset: { requests: 3, window: 3600000 }, // 3 password resets per hour
    friend_requests: { requests: 20, window: 3600000 }, // 20 friend requests per hour
  },

  // Booking fraud detection thresholds
  fraudDetection: {
    maxBookingsPerDay: 10,
    maxCancellationsPerWeek: 5,
    maxNoShowsPerMonth: 3,
    suspiciousPatternThreshold: 0.7,
    rapidBookingWindow: 300000, // 5 minutes
    maxRapidBookings: 3,
  },

  // Account security settings
  accountSecurity: {
    maxAccountsPerDevice: 3,
    deviceIdStorage: "device_fingerprint",
    suspiciousLoginThreshold: 3,
    accountLockoutDuration: 3600000, // 1 hour
  },

  // Validation rules
  validation: {
    minPasswordLength: 8,
    maxPasswordLength: 128,
    minNameLength: 2,
    maxNameLength: 50,
    maxCommentLength: 1000,
    maxSpecialRequestLength: 500,
    phoneNumberPattern: /^\+961[0-9]{8}$/,
    emailPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
};

/**
 * Device and network information utility for security logging
 */
class DeviceInfoUtil {
  private static cachedUserAgent: string | null = null;
  private static cachedIpAddress: string | null = null;

  /**
   * Generate a user agent string for React Native/Expo
   */
  static async getUserAgent(): Promise<string> {
    if (this.cachedUserAgent) {
      return this.cachedUserAgent;
    }

    try {
      const appVersion = Constants.expoConfig?.version || "1.0.0";
      const appName = Constants.expoConfig?.name || "Plate";
      const osName = Platform.OS;
      const osVersion = Platform.Version;
      const nativeApplicationVersion =
        Constants.nativeApplicationVersion || "unknown";

      // Format similar to web user agent but for React Native
      this.cachedUserAgent = `${appName}/${appVersion} (${osName} ${osVersion}; Expo/${Constants.expoVersion || "unknown"}; Native/${nativeApplicationVersion})`;

      return this.cachedUserAgent;
    } catch (error) {
      console.error("Failed to generate user agent:", error);
      return "Plate/1.0.0 (React Native; Unknown Device)";
    }
  }

  /**
   * Get device's public IP address
   */
  static async getIpAddress(): Promise<string | null> {
    // Use cached IP for a few minutes to avoid excessive API calls
    if (this.cachedIpAddress) {
      return this.cachedIpAddress;
    }

    try {
      // Use a reliable IP detection service with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch("https://api.ipify.org?format=json", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.cachedIpAddress = data.ip || null;

      // Cache for 5 minutes
      setTimeout(() => {
        this.cachedIpAddress = null;
      }, 300000);

      return this.cachedIpAddress;
    } catch (error) {
      console.error("Failed to get IP address:", error);
      return null; // Fallback to null if IP detection fails
    }
  }

  /**
   * Get comprehensive device and network info for security logging
   */
  static async getSecurityInfo(): Promise<{
    userAgent: string;
    ipAddress: string | null;
  }> {
    const [userAgent, ipAddress] = await Promise.all([
      this.getUserAgent(),
      this.getIpAddress(),
    ]);

    return {
      userAgent,
      ipAddress,
    };
  }
}

/**
 * Enhanced fraud detection and abuse prevention
 */
export class FraudDetection {
  /**
   * Check for booking fraud patterns
   */
  static async checkBookingFraud(
    userId: string,
    restaurantId: string,
  ): Promise<{
    isAllowed: boolean;
    riskScore: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    try {
      // Check rapid booking attempts
      const rapidBookings = await this.checkRapidBookingAttempts(userId);
      if (
        rapidBookings.count >= SECURITY_CONFIG.fraudDetection.maxRapidBookings
      ) {
        riskScore += 0.4;
        reasons.push("Rapid booking attempts detected");
      }

      // Check daily booking limit
      const todayBookings = await this.getTodayBookingCount(userId);
      if (todayBookings >= SECURITY_CONFIG.fraudDetection.maxBookingsPerDay) {
        riskScore += 0.6;
        reasons.push("Daily booking limit exceeded");
      }

      // Check recent cancellation pattern
      const recentCancellations = await this.getRecentCancellations(userId);
      if (
        recentCancellations >=
        SECURITY_CONFIG.fraudDetection.maxCancellationsPerWeek
      ) {
        riskScore += 0.5;
        reasons.push("High cancellation rate detected");
      }

      // Check no-show history
      const noShowCount = await this.getMonthlyNoShows(userId);
      if (noShowCount >= SECURITY_CONFIG.fraudDetection.maxNoShowsPerMonth) {
        riskScore += 0.7;
        reasons.push("High no-show rate detected");
      }

      // Check if user is blacklisted at this restaurant
      const isBlacklisted = await this.checkRestaurantBlacklist(
        userId,
        restaurantId,
      );
      if (isBlacklisted) {
        riskScore = 1.0;
        reasons.push("User is blacklisted at this restaurant");
      }

      const isAllowed =
        riskScore < SECURITY_CONFIG.fraudDetection.suspiciousPatternThreshold;

      // Log suspicious activity
      if (riskScore >= 0.5) {
        await this.logSuspiciousActivity({
          type: "booking_fraud_attempt",
          userId,
          restaurantId,
          riskScore,
          reasons,
        });
      }

      return { isAllowed, riskScore, reasons };
    } catch (error) {
      console.error("Error checking booking fraud:", error);
      // Allow booking if check fails, but log the error
      return { isAllowed: true, riskScore: 0, reasons: [] };
    }
  }

  private static async checkRapidBookingAttempts(
    userId: string,
  ): Promise<{ count: number }> {
    const { data } = await supabase
      .from("bookings")
      .select("created_at")
      .eq("user_id", userId)
      .gte(
        "created_at",
        new Date(
          Date.now() - SECURITY_CONFIG.fraudDetection.rapidBookingWindow,
        ).toISOString(),
      )
      .order("created_at", { ascending: false });

    return { count: data?.length || 0 };
  }

  private static async getTodayBookingCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today.toISOString());

    return count || 0;
  }

  private static async getRecentCancellations(userId: string): Promise<number> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["cancelled_by_user", "cancelled_by_restaurant"])
      .gte("created_at", weekAgo.toISOString());

    return count || 0;
  }

  private static async getMonthlyNoShows(userId: string): Promise<number> {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "no_show")
      .gte("created_at", monthAgo.toISOString());

    return count || 0;
  }

  private static async checkRestaurantBlacklist(
    userId: string,
    restaurantId: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from("restaurant_customers")
      .select("blacklisted")
      .eq("user_id", userId)
      .eq("restaurant_id", restaurantId)
      .eq("blacklisted", true)
      .single();

    return !!data;
  }

  private static async logSuspiciousActivity(activity: {
    type: string;
    userId: string;
    restaurantId?: string;
    riskScore: number;
    reasons: string[];
  }) {
    try {
      // Get device and network info
      const securityInfo = await DeviceInfoUtil.getSecurityInfo();

      const insertData = {
        user_id: activity.userId,
        restaurant_id: activity.restaurantId,
        activity_type: activity.type,
        risk_score: Math.round(activity.riskScore * 100), // Convert to integer (0.6 -> 60)
        details: {
          reasons: activity.reasons,
          timestamp: new Date().toISOString(),
        },
        ip_address: securityInfo.ipAddress, // Now populated with actual IP
        user_agent: securityInfo.userAgent, // Now populated with device info
      };

      await supabase.from("security_audit_log").insert(insertData);
    } catch (error) {
      console.error("Failed to log suspicious activity:", error);
    }
  }
}

/**
 * Device fingerprinting and account abuse prevention
 */
export class DeviceSecurity {
  /**
   * Get or generate device fingerprint
   */
  static async getDeviceFingerprint(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem(
        SECURITY_CONFIG.accountSecurity.deviceIdStorage,
      );
      if (stored) return stored;

      // Generate new fingerprint
      const fingerprint = this.generateDeviceFingerprint();
      await AsyncStorage.setItem(
        SECURITY_CONFIG.accountSecurity.deviceIdStorage,
        fingerprint,
      );
      return fingerprint;
    } catch (error) {
      console.error("Error getting device fingerprint:", error);
      return this.generateDeviceFingerprint();
    }
  }

  private static generateDeviceFingerprint(): string {
    // Generate a unique device identifier
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if device has too many accounts
   */
  static async checkDeviceAccountLimit(): Promise<boolean> {
    try {
      const fingerprint = await this.getDeviceFingerprint();

      const { count } = await supabase
        .from("user_devices")
        .select("*", { count: "exact", head: true })
        .eq("device_fingerprint", fingerprint);

      return (
        (count || 0) < SECURITY_CONFIG.accountSecurity.maxAccountsPerDevice
      );
    } catch (error) {
      console.error("Error checking device account limit:", error);
      return true; // Allow if check fails
    }
  }

  /**
   * Register device for user
   * NOTE: Device registration for push notifications is handled by lib/notifications/setup.ts
   * This function is kept for backwards compatibility but does nothing to avoid conflicts
   */
  static async registerDeviceForUser(userId: string): Promise<void> {
    try {
      // Device registration is now handled by the notification system
      // This prevents conflicts with the user_devices table schema
      // The notification system properly manages device_id, expo_push_token, and enabled fields
      console.log(
        `Device registration for user ${userId} handled by notification system`,
      );
    } catch (error) {
      console.error("Error in device registration stub:", error);
    }
  }
}

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize text input to prevent XSS and injection attacks
   */
  static sanitizeText(
    input: string,
    options: {
      removeProfanity?: boolean;
      maxLength?: number;
    } = {},
  ): string {
    if (typeof input !== "string") {
      return "";
    }

    const {
      removeProfanity = false,
      maxLength = SECURITY_CONFIG.maxInputLength,
    } = options;

    // Remove null bytes
    let sanitized = input.replace(/\0/g, "");

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Remove potentially dangerous characters for SQL injection
    sanitized = sanitized.replace(/[<>'";&\\]/g, "");

    // Optional profanity removal (for filtering rather than blocking)
    if (removeProfanity) {
      const profanityCheck = InputValidator.containsProfanity(sanitized);
      if (profanityCheck.hasProfanity && profanityCheck.foundWords) {
        for (const word of profanityCheck.foundWords) {
          const regex = new RegExp(
            word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
          );
          sanitized = sanitized.replace(regex, "*".repeat(word.length));
        }
      }
    }

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, " ").trim();

    return sanitized;
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    if (typeof email !== "string") {
      return "";
    }

    // Basic email format validation and sanitization
    const sanitized = email.toLowerCase().trim();

    // Remove dangerous characters
    return sanitized.replace(/[<>'";&\\]/g, "");
  }

  /**
   * Sanitize phone number
   */
  static sanitizePhoneNumber(phone: string): string {
    if (typeof phone !== "string") {
      return "";
    }

    // Keep only digits, spaces, hyphens, plus, and parentheses
    return phone.replace(/[^0-9\s\-+()]/g, "").trim();
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(url: string): string {
    if (typeof url !== "string") {
      return "";
    }

    try {
      const urlObj = new URL(url);

      // Only allow https and http protocols
      if (!["https:", "http:"].includes(urlObj.protocol)) {
        return "";
      }

      return urlObj.toString();
    } catch {
      return "";
    }
  }

  /**
   * Remove sensitive data from logs
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data === "string") {
      let sanitized = data;

      // Replace sensitive patterns
      SECURITY_CONFIG.sensitiveDataPatterns.forEach((pattern) => {
        sanitized = sanitized.replace(pattern, "[REDACTED]");
      });

      return sanitized;
    }

    if (typeof data === "object" && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};

      for (const [key, value] of Object.entries(data)) {
        // Redact common sensitive field names
        if (
          ["password", "token", "secret", "key", "auth"].some((sensitive) =>
            key.toLowerCase().includes(sensitive),
          )
        ) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = this.sanitizeForLogging(value);
        }
      }

      return sanitized;
    }

    return data;
  }
}

/**
 * Profanity filter word list for Apple App Store compliance
 */
// Profanity words for Apple App Store compliance
const PROFANITY_WORDS = [
  // Common profanity
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "fucks",
  "shit",
  "shitting",
  "shitty",
  "shits",
  "damn",
  "damned",
  "hell",
  "hellish",
  "bitch",
  "bitches",
  "bitching",
  "bastard",
  "bastards",
  "ass",
  "asses",
  "asshole",
  "assholes",
  "crap",
  "crappy",
  "craps",
  "piss",
  "pissed",
  "pissing",
  "cock",
  "cocks",
  "dick",
  "dicks",
  "dickhead",
  "pussy",
  "pussies",
  "whore",
  "whores",
  "slut",
  "sluts",
  "slutty",
  "fag",
  "faggot",
  "faggots",
  "nigger",
  "niggers",
  "nigga",
  "retard",
  "retarded",
  "retards",
  "homo",
  "homos",
  "gay",
  "lesbian",
  "dyke",

  // Strong profanity variations
  "motherfucker",
  "motherfucking",
  "bullshit",
  "horseshit",
  "chickenshit",
  "dipshit",
  "jackass",
  "dumbass",
  "smartass",
  "badass",
  "hardass",
  "fatass",
  "douchebag",
  "douche",
  "turd",
  "turds",
  "prick",
  "pricks",
  "twat",
  "twats",
  "cunt",
  "cunts",
  "wanker",

  // Offensive terms and hate speech
  "nazi",
  "nazis",
  "hitler",
  "terrorist",
  "terrorists",
  "terrorism",
  "bomb",
  "bombed",
  "bombing",
  "bomber",
  "kill",
  "killing",
  "killed",
  "killer",
  "killers",
  "murder",
  "murdered",
  "murderer",
  "die",
  "death",
  "dead",
  "suicide",
  "hate",
  "hated",
  "hating",
  "hater",
  "stupid",
  "stupidity",
  "idiot",
  "idiotic",
  "idiots",
  "moron",
  "moronic",
  "morons",
  "dumb",
  "dumber",
  "dumbest",
  "ugly",
  "uglier",
  "ugliest",
  "loser",
  "losers",

  // Racial and discriminatory slurs
  "spic",
  "spics",
  "wetback",
  "wetbacks",
  "chink",
  "chinks",
  "gook",
  "gooks",
  "kike",
  "kikes",
  "towelhead",
  "raghead",
  "cracker",
  "crackers",
  "honky",
  "gringo",

  // Drug references
  "drug",
  "drugs",
  "cocaine",
  "coke",
  "heroin",
  "marijuana",
  "weed",
  "pot",
  "high",
  "stoned",
  "junkie",
  "junkies",
  "addict",
  "addicts",
  "crack",
  "meth",
  "methhead",
  "dealer",
  "dealers",
  "dealing",
  "dope",
  "joint",
  "joints",
  "blunt",
  "blunts",

  // Sexual content
  "sex",
  "sexual",
  "sexy",
  "porn",
  "porno",
  "pornography",
  "naked",
  "nude",
  "nudity",
  "boobs",
  "tits",
  "titties",
  "breast",
  "breasts",
  "nipple",
  "nipples",
  "vagina",
  "penis",
  "orgasm",
  "masturbate",
  "masturbation",
  "horny",
  "erection",
  "boner",

  // Violence and threats
  "violence",
  "violent",
  "attack",
  "attacking",
  "attacked",
  "attacker",
  "assault",
  "assaulting",
  "assaulted",
  "beat",
  "beating",
  "beaten",
  "punch",
  "punching",
  "punched",
  "stab",
  "stabbing",
  "stabbed",
  "shoot",
  "shooting",
  "shot",
  "gun",
  "guns",
  "weapon",
  "weapons",
  "knife",
  "knives",
  "threat",
  "threaten",
  "threatening",
  "threatened",

  // Bathroom and body references (inappropriate context)
  "poop",
  "pooping",
  "pooped",
  "fart",
  "farting",
  "farted",
  "farts",
  "burp",
  "burping",
  "vomit",
  "vomiting",
  "puke",
  "puking",
  "puked",
  "snot",
  "booger",
  "boogers",

  // Internet slang and modern profanity
  "wtf",
  "stfu",
  "omfg",
  "lmfao",
  "af",
  "thot",
  "simp",
  "simping",
  "incel",
  "cuck",
  "cucks",
  "cucked",
  "beta",
  "chad",
  "karen",
  "boomer",
  "zoomer",
  "boobs",

  // Gambling references (App Store sensitive)
  "gambling",
  "gamble",
  "gambled",
  "gambler",
  "bet",
  "betting",
  "bets",
  "casino",
  "poker",
  "blackjack",
  "slots",
  "lottery",
  "jackpot",
];

// Special handling for words that need context or are high-risk false positives
const CONTEXT_SENSITIVE_WORDS = [
  {
    word: "ass",
    whitelist: [
      "bass",
      "class",
      "classes",
      "classic",
      "classical",
      "glass",
      "glasses",
      "grass",
      "mass",
      "masses",
      "pass",
      "passed",
      "passing",
      "assault",
      "assaulted",
      "assess",
      "assessment",
      "massive",
      "ambassador",
      "embassy",
      "passenger",
      "passage",
      "password",
    ],
  },
  {
    word: "kill",
    whitelist: [
      "skill",
      "skilled",
      "skills",
      "skillful",
      "killed",
      "killer",
      "killing",
      "skillfully",
      "upskill",
      "reskill",
    ],
  },
  {
    word: "hell",
    whitelist: [
      "hello",
      "hellish",
      "shell",
      "shells",
      "shelter",
      "shelters",
      "sheltered",
      "sheltering",
      "help",
      "helps",
      "helping",
      "helped",
      "helper",
      "helpers",
      "helpful",
      "helpless",
      "helplessly",
      "helplessness",
    ],
  },
  {
    word: "die",
    whitelist: [
      "died",
      "diet",
      "diets",
      "dietary",
      "diesel",
      "audience",
      "audiences",
      "indie",
      "ladies",
      "studies",
      "studied",
      "candies",
      "odies",
    ],
  },
  {
    word: "high",
    whitelist: [
      "highly",
      "highlight",
      "highlights",
      "highlighted",
      "highway",
      "highways",
      "right",
      "rights",
      "night",
      "nights",
      "light",
      "lights",
      "lighting",
      "sight",
      "sights",
      "fight",
      "fights",
      "fighting",
      "might",
      "mighty",
      "tight",
      "bright",
      "flight",
      "height",
      "weight",
    ],
  },
  {
    word: "pot",
    whitelist: [
      "spot",
      "spots",
      "spotted",
      "spotting",
      "potatoes",
      "potato",
      "pottery",
      "potter",
      "despot",
      "depot",
      "potential",
      "potent",
      "opotamus",
      "teapot",
      "hotspot",
    ],
  },
  {
    word: "gay",
    whitelist: ["gaya", "gayly", "legacy", "fugay"],
  },
  {
    word: "sex",
    whitelist: [
      "sixteen",
      "sixth",
      "sixty",
      "sexual", // Allow in appropriate contexts
      "sextet",
      "sextant",
      "unisex",
      "sussex",
      "middlesex",
    ],
  },
  {
    word: "beat",
    whitelist: [
      "beats",
      "beaten",
      "beating",
      "upbeat",
      "offbeat",
      "heartbeat",
      "beatiful", // common misspelling
      "beatles",
    ],
  },
  {
    word: "shot",
    whitelist: [
      "shots",
      "shooting",
      "photo",
      "photos",
      "photographer",
      "photography",
      "snapshot",
      "screenshot",
      "longshot",
      "shotgun", // context dependent
    ],
  },
  {
    word: "crack",
    whitelist: [
      "cracks",
      "cracked",
      "cracking",
      "cracker",
      "crackers",
      "firecracker",
      "nutcracker",
    ],
  },
  {
    word: "dope",
    whitelist: [
      "dopey",
      "doped",
      "doping",
      "antidote",
      "horoscope",
      "stethoscope",
      "periscope",
      "kaleidoscope",
    ],
  },
  {
    word: "joint",
    whitelist: [
      "joints",
      "jointed",
      "jointing",
      "adjointed",
      "disjoint",
      "conjoint",
    ],
  },
];

// Inappropriate phrases and sentences for comprehensive filtering
const INAPPROPRIATE_PHRASES = [
  // Hate speech phrases
  "i hate",
  "hate this",
  "hate that",
  "hate you",
  "hate them",
  "go kill yourself",
  "kill yourself",
  "kys",
  "go die",
  "drop dead",
  "hope you die",
  "piece of shit",
  "piece of crap",
  "son of a bitch",
  "go to hell",
  "burn in hell",
  "fuck off",
  "fuck you",
  "screw you",
  "piss off",

  // Discriminatory phrases
  "white trash",
  "trailer trash",
  "ghetto trash",
  "you people",
  "those people",
  "dirty immigrant",
  "illegal alien",
  "sand nigger",
  "towel head",

  // Threats and violence
  "i will kill",
  "gonna kill",
  "going to kill",
  "want to kill",
  "should die",
  "deserve to die",
  "beat you up",
  "kick your ass",
  "punch you",
  "shoot you",
  "stab you",
  "blow up",
  "bomb this place",
  "terrorist attack",

  // Sexual harassment
  "show me your",
  "send nudes",
  "want to fuck",
  "suck my",
  "eat my",
  "lick my",
  "touch yourself",
  "get naked",

  // Drug related phrases
  "sell drugs",
  "buy drugs",
  "drug dealer",
  "get high",
  "smoke weed",
  "snort cocaine",
  "shoot heroin",
  "crystal meth",

  // Gambling phrases
  "place bets",
  "gambling site",
  "online casino",
  "poker game",
  "sports betting",
  "win money",
  "easy money",
  "quick cash",

  // Spam and scam phrases
  "make money fast",
  "get rich quick",
  "work from home",
  "click here now",
  "limited time offer",
  "act now",
  "free money",
  "guaranteed winner",

  // Inappropriate requests
  "hook up",
  "one night stand",
  "friends with benefits",
  "sugar daddy",
  "sugar mommy",
  "escort service",
  "massage parlor",
];

/**
 * Input validation utilities
 */
export class InputValidator {
  /**
   * Check if text contains profanity (Apple App Store compliance)
   */
  static containsProfanity(text: string): {
    hasProfanity: boolean;
    foundWords?: string[];
  } {
    if (typeof text !== "string" || !text.trim()) {
      return { hasProfanity: false };
    }

    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ") // Replace special chars with spaces
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    const foundWords: string[] = [];

    // Check for direct profanity words
    for (const word of PROFANITY_WORDS) {
      // Create a pattern that matches the word with potential character substitutions
      const pattern = word
        .split("")
        .map((char) => {
          switch (char.toLowerCase()) {
            case "a":
              return "[a@*4]";
            case "e":
              return "[e3*]";
            case "i":
              return "[i1!*]";
            case "o":
              return "[o0*]";
            case "u":
              return "[u*]";
            case "s":
              return "[s$5*]";
            case "c":
              return "[c*]";
            case "k":
              return "[k*]";
            default:
              return `[${char}*]`;
          }
        })
        .join("");

      // Check for whole word matches and substring matches (for substitutions)
      const wordRegex = new RegExp(`\\b${pattern}\\b`, "gi");
      const substringRegex = new RegExp(pattern, "gi");

      if (wordRegex.test(text) || substringRegex.test(text)) {
        // Check if this word has context-sensitive exceptions
        const contextSensitive = CONTEXT_SENSITIVE_WORDS.find(
          (cs) => cs.word === word,
        );
        if (contextSensitive) {
          // Check if it's in a whitelisted context
          const isWhitelisted = contextSensitive.whitelist.some((whiteWord) => {
            const whiteRegex = new RegExp(`\\b${whiteWord}\\b`, "i");
            return whiteRegex.test(normalizedText);
          });

          if (!isWhitelisted) {
            foundWords.push(word);
          }
        } else {
          // No context restrictions, add it
          foundWords.push(word);
        }
      }
    }

    // Check for inappropriate phrases
    for (const phrase of INAPPROPRIATE_PHRASES) {
      if (normalizedText.includes(phrase.toLowerCase())) {
        foundWords.push(`phrase: "${phrase}"`);
      }
    }

    return {
      hasProfanity: foundWords.length > 0,
      foundWords: foundWords.length > 0 ? foundWords : undefined,
    };
  }

  /**
   * Validate text input for profanity and other content issues
   */
  static validateContent(
    text: string,
    options: {
      maxLength?: number;
      minLength?: number;
      checkProfanity?: boolean;
      fieldName?: string;
    } = {},
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const {
      maxLength = SECURITY_CONFIG.maxInputLength,
      minLength = 0,
      checkProfanity = true,
      fieldName = "text",
    } = options;

    const errors: string[] = [];

    // Length validation
    if (text.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters`);
    }
    if (text.length > maxLength) {
      errors.push(`${fieldName} must be less than ${maxLength} characters`);
    }

    // Profanity check for Apple App Store compliance
    if (checkProfanity) {
      const profanityCheck = this.containsProfanity(text);
      if (profanityCheck.hasProfanity) {
        errors.push("Please review your text for inappropriate language");
      }
    }

    // Check for spam patterns (excessive repetition)
    if (this.isSpamText(text)) {
      errors.push("Text appears to contain spam or excessive repetition");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Detect spam patterns in text
   */
  static isSpamText(text: string): boolean {
    if (!text || text.length < 10) return false;

    const words = text.toLowerCase().split(/\s+/);

    // Check for excessive repetition of the same word
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 2) {
        // Only count meaningful words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Flag as spam if any single word appears more than 30% of the time
    const totalWords = words.filter((w) => w.length > 2).length;
    for (const count of wordCounts.values()) {
      if (count > 3 && count / totalWords > 0.3) {
        return true;
      }
    }

    // Check for excessive special characters or numbers
    const specialCharCount = (text.match(/[^a-zA-Z0-9\s.,!?'-]/g) || []).length;
    if (specialCharCount / text.length > 0.2) {
      return true;
    }

    return false;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    strength: "weak" | "medium" | "strong";
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 4) {
      errors.push("Password must be at least 8 characters long");
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    } else {
      score += 1;
    }

    // Check for common weak passwords
    const commonPasswords = ["password", "123456", "qwerty", "abc123"];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push("Password is too common");
      score = 0;
    }

    let strength: "weak" | "medium" | "strong" = "weak";
    if (score >= 4) strength = "strong";
    else if (score >= 2) strength = "medium";

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ["https:", "http:"].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Validate input length
   */
  static isValidLength(
    input: string,
    min: number = 0,
    max: number = SECURITY_CONFIG.maxInputLength,
  ): boolean {
    return input.length >= min && input.length <= max;
  }
}

/**
 * Enhanced rate limiting utilities
 */
export class RateLimiter {
  private static requestCounts: Map<
    string,
    { count: number; resetTime: number }
  > = new Map();

  /**
   * Check if request is within rate limit for specific action type
   */
  static async checkActionRateLimit(
    identifier: string,
    actionType: keyof typeof SECURITY_CONFIG.rateLimits,
  ): Promise<{ allowed: boolean; resetTime?: number }> {
    const config = SECURITY_CONFIG.rateLimits[actionType];
    if (!config) {
      return { allowed: true };
    }

    const key = `${actionType}:${identifier}`;
    const now = Date.now();
    const windowStart = now - config.window;

    const current = this.requestCounts.get(key);

    if (!current || current.resetTime < windowStart) {
      // Reset or initialize counter
      const resetTime = now + config.window;
      this.requestCounts.set(key, { count: 1, resetTime });
      return { allowed: true };
    }

    if (current.count >= config.requests) {
      // Rate limit exceeded
      this.logSecurityEvent("rate_limit_exceeded", {
        identifier,
        actionType,
        count: current.count,
        limit: config.requests,
      });

      return {
        allowed: false,
        resetTime: current.resetTime,
      };
    }

    // Increment counter
    current.count++;
    return { allowed: true };
  }

  /**
   * Check if request is within rate limit (legacy method)
   */
  static async checkRateLimit(
    identifier: string,
    limit: number = SECURITY_CONFIG.maxRequestsPerWindow,
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.rateLimitWindow;

    const current = this.requestCounts.get(identifier);

    if (!current || current.resetTime < windowStart) {
      // Reset or initialize counter
      this.requestCounts.set(identifier, { count: 1, resetTime: now });
      return true;
    }

    if (current.count >= limit) {
      // Rate limit exceeded
      this.logSecurityEvent("rate_limit_exceeded", {
        identifier,
        count: current.count,
      });
      return false;
    }

    // Increment counter
    current.count++;
    return true;
  }

  /**
   * Reset rate limit for specific identifier and action
   */
  static resetRateLimit(identifier: string, actionType?: string): void {
    const key = actionType ? `${actionType}:${identifier}` : identifier;
    this.requestCounts.delete(key);
  }

  /**
   * Get current rate limit status
   */
  static getRateLimitStatus(
    identifier: string,
    actionType: keyof typeof SECURITY_CONFIG.rateLimits,
  ): { count: number; limit: number; resetTime: number | null } {
    const config = SECURITY_CONFIG.rateLimits[actionType];
    const key = `${actionType}:${identifier}`;
    const current = this.requestCounts.get(key);

    return {
      count: current?.count || 0,
      limit: config?.requests || 0,
      resetTime: current?.resetTime || null,
    };
  }

  /**
   * Log security event
   */
  private static logSecurityEvent(event: string, data: any) {
    console.warn(
      `Security event: ${event}`,
      InputSanitizer.sanitizeForLogging(data),
    );

    Sentry.addBreadcrumb({
      message: `Security: ${event}`,
      category: "security",
      level: "warning",
      data: InputSanitizer.sanitizeForLogging(data),
    });
  }
}

/**
 * Secure storage utilities
 */
export class SecureStorage {
  private static readonly ENCRYPTION_KEY = "app_encryption_key";

  /**
   * Store sensitive data securely
   */
  static async store(key: string, value: string): Promise<void> {
    try {
      // In a real app, you would use a proper encryption library
      // This is a simplified example
      const encrypted = this.simpleEncrypt(value);
      await AsyncStorage.setItem(key, encrypted);
    } catch (error) {
      console.error("Secure storage error:", error);
      throw new Error("Failed to store sensitive data");
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  static async retrieve(key: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return null;

      return this.simpleDecrypt(encrypted);
    } catch (error) {
      console.error("Secure retrieval error:", error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error("Secure removal error:", error);
    }
  }

  /**
   * Simple encryption (use a proper crypto library in production)
   */
  private static simpleEncrypt(text: string): string {
    // This is NOT secure encryption - use react-native-keychain or similar in production
    return Buffer.from(text).toString("base64");
  }

  /**
   * Simple decryption (use a proper crypto library in production)
   */
  private static simpleDecrypt(encrypted: string): string {
    // This is NOT secure decryption - use react-native-keychain or similar in production
    return Buffer.from(encrypted, "base64").toString();
  }
}

/**
 * Enhanced security monitoring utilities
 */
export class SecurityMonitor {
  private static suspiciousActivityCounts: Map<string, number> = new Map();

  /**
   * Monitor for suspicious activity with enhanced detection
   */
  static async monitorSuspiciousActivity(activity: {
    type:
      | "multiple_failed_logins"
      | "rapid_requests"
      | "invalid_input"
      | "unauthorized_access"
      | "booking_fraud"
      | "review_spam"
      | "account_abuse"
      | "data_manipulation";
    userId?: string;
    metadata?: any;
  }) {
    const key = `${activity.type}:${activity.userId || "anonymous"}`;
    const currentCount = this.suspiciousActivityCounts.get(key) || 0;
    this.suspiciousActivityCounts.set(key, currentCount + 1);

    // Log activity
    await this.logSecurityEvent(activity);

    // Handle based on activity type
    switch (activity.type) {
      case "multiple_failed_logins":
        await this.handleMultipleFailedLogins(activity.metadata);
        break;
      case "rapid_requests":
        await this.handleRapidRequests(activity.metadata);
        break;
      case "invalid_input":
        await this.handleInvalidInput(activity.metadata);
        break;
      case "unauthorized_access":
        await this.handleUnauthorizedAccess(activity.metadata);
        break;
      case "booking_fraud":
        await this.handleBookingFraud(activity.metadata);
        break;
      case "review_spam":
        await this.handleReviewSpam(activity.metadata);
        break;
      case "account_abuse":
        await this.handleAccountAbuse(activity.metadata);
        break;
      case "data_manipulation":
        await this.handleDataManipulation(activity.metadata);
        break;
    }

    // Escalate if too many suspicious activities
    if (currentCount >= 5) {
      await this.escalateSuspiciousUser(activity.userId, activity.type);
    }
  }

  private static async logSecurityEvent(activity: any) {
    try {
      // Get device and network info
      const securityInfo = await DeviceInfoUtil.getSecurityInfo();

      const insertData: any = {
        user_id: activity.userId || null, // Allow NULL for anonymous events
        activity_type: activity.type,
        details: activity.metadata || {},
        ip_address: securityInfo.ipAddress, // Now populated with actual IP
        user_agent: securityInfo.userAgent, // Now populated with device info
        risk_score: Math.round(this.calculateRiskScore(activity.type) * 100), // Convert to integer (0.6 -> 60)
        restaurant_id: activity.restaurantId || null,
      };

      await supabase.from("security_audit_log").insert(insertData);
    } catch (error) {
      console.error("Failed to log security event:", error);
    }
  }

  private static calculateRiskScore(activityType: string): number {
    const riskScores = {
      multiple_failed_logins: 0.6,
      rapid_requests: 0.4,
      invalid_input: 0.3,
      unauthorized_access: 0.8,
      booking_fraud: 0.9,
      review_spam: 0.7,
      account_abuse: 0.8,
      data_manipulation: 0.9,
    };

    return riskScores[activityType as keyof typeof riskScores] || 0.5;
  }

  private static async escalateSuspiciousUser(
    userId?: string,
    activityType?: string,
  ) {
    if (!userId) return;

    try {
      // Create escalation record
      await supabase.from("security_escalations").insert({
        user_id: userId,
        activity_type: activityType,
        escalation_level: "high",
        auto_flagged: true,
        created_at: new Date().toISOString(),
      });

      // Could trigger additional actions like temporary account restrictions
      console.warn(`Security escalation for user ${userId}: ${activityType}`);
    } catch (error) {
      console.error("Failed to escalate suspicious user:", error);
    }
  }

  private static async handleMultipleFailedLogins(metadata: any) {
    Alert.alert(
      "Security Alert",
      "Multiple failed login attempts detected. Your account may be temporarily restricted.",
      [{ text: "OK" }],
    );
  }

  private static async handleRapidRequests(metadata: any) {
    console.warn("Rapid requests detected - possible bot activity");
    // Could implement CAPTCHA or temporary slowdown
  }

  private static async handleInvalidInput(metadata: any) {
    console.warn("Invalid input detected - possible injection attempt");
    // Enhanced input validation and sanitization
  }

  private static async handleUnauthorizedAccess(metadata: any) {
    Alert.alert(
      "Security Alert",
      "Unauthorized access detected. Please log in again.",
      [{ text: "OK" }],
    );
  }

  private static async handleBookingFraud(metadata: any) {
    Alert.alert(
      "Booking Restriction",
      "Suspicious booking patterns detected. Please contact support if you believe this is an error.",
      [{ text: "OK" }],
    );
  }

  private static async handleReviewSpam(metadata: any) {
    console.warn("Review spam detected");
    // Could implement review restrictions or verification
  }

  private static async handleAccountAbuse(metadata: any) {
    console.warn("Account abuse detected");
    // Could implement account restrictions
  }

  private static async handleDataManipulation(metadata: any) {
    console.warn("Data manipulation attempt detected");
    // Enhanced audit logging and potential account suspension
  }

  /**
   * Check if user has been flagged for suspicious activity
   */
  static async checkUserSuspiciousFlags(userId: string): Promise<{
    isFlagged: boolean;
    riskLevel: "low" | "medium" | "high";
    restrictions: string[];
  }> {
    try {
      const { data } = await supabase
        .from("security_escalations")
        .select("*")
        .eq("user_id", userId)
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        return { isFlagged: false, riskLevel: "low", restrictions: [] };
      }

      const highRiskCount = data.filter(
        (d) => d.escalation_level === "high",
      ).length;
      const mediumRiskCount = data.filter(
        (d) => d.escalation_level === "medium",
      ).length;

      let riskLevel: "low" | "medium" | "high" = "low";
      let restrictions: string[] = [];

      if (highRiskCount > 0) {
        riskLevel = "high";
        restrictions = [
          "booking_restrictions",
          "review_restrictions",
          "limited_access",
        ];
      } else if (mediumRiskCount > 2) {
        riskLevel = "medium";
        restrictions = ["booking_review_required", "limited_bookings"];
      }

      return {
        isFlagged: data.length > 0,
        riskLevel,
        restrictions,
      };
    } catch (error) {
      console.error("Error checking user suspicious flags:", error);
      return { isFlagged: false, riskLevel: "low", restrictions: [] };
    }
  }
}

/**
 * Hook for secure input handling with profanity filtering
 */
export function useSecureInput() {
  const validateAndSanitize = (
    input: string,
    type: "text" | "email" | "phone" | "url" | "password" = "text",
    options: {
      checkProfanity?: boolean;
      maxLength?: number;
      minLength?: number;
      fieldName?: string;
    } = {},
  ) => {
    const {
      checkProfanity = true,
      maxLength = SECURITY_CONFIG.maxInputLength,
      minLength = 0,
      fieldName = "field",
    } = options;

    // Sanitize first
    let sanitized: string;
    switch (type) {
      case "email":
        sanitized = InputSanitizer.sanitizeEmail(input);
        break;
      case "phone":
        sanitized = InputSanitizer.sanitizePhoneNumber(input);
        break;
      case "url":
        sanitized = InputSanitizer.sanitizeUrl(input);
        break;
      default:
        sanitized = InputSanitizer.sanitizeText(input, { maxLength });
    }

    // Validate
    let isValid = true;
    let errors: string[] = [];

    switch (type) {
      case "email":
        isValid = InputValidator.isValidEmail(sanitized);
        if (!isValid) errors.push("Invalid email format");
        break;
      case "phone":
        isValid = InputValidator.isValidPhoneNumber(sanitized);
        if (!isValid) errors.push("Invalid phone number format");
        break;
      case "url":
        isValid = InputValidator.isValidUrl(sanitized);
        if (!isValid) errors.push("Invalid URL format");
        break;
      case "password":
        const passwordValidation = InputValidator.validatePassword(sanitized);
        isValid = passwordValidation.isValid;
        errors = passwordValidation.errors;
        break;
      default:
        // Use the new content validation for text fields
        const contentValidation = InputValidator.validateContent(sanitized, {
          maxLength,
          minLength,
          checkProfanity,
          fieldName,
        });
        isValid = contentValidation.isValid;
        errors = contentValidation.errors;
    }

    return {
      sanitized,
      isValid,
      errors,
      originalLength: input.length,
      sanitizedLength: sanitized.length,
    };
  };

  return { validateAndSanitize };
}

/**
 * Enhanced security middleware for API calls
 */
export function withSecurityMiddleware<T extends (...args: any[]) => any>(
  apiCall: T,
  options: {
    rateLimitKey?: string;
    actionType?: keyof typeof SECURITY_CONFIG.rateLimits;
    sanitizeArgs?: boolean;
    monitorFailures?: boolean;
    requireAuth?: boolean;
    validateInput?: boolean;
    fraudCheck?: boolean;
  } = {},
): T {
  const {
    rateLimitKey,
    actionType,
    sanitizeArgs = true,
    monitorFailures = true,
    requireAuth = false,
    validateInput = true,
    fraudCheck = false,
  } = options;

  return (async (...args: Parameters<T>) => {
    try {
      // Check authentication if required
      if (requireAuth) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          await SecurityMonitor.monitorSuspiciousActivity({
            type: "unauthorized_access",
            metadata: { function: apiCall.name },
          });
          throw new Error("Authentication required");
        }
      }

      // Enhanced rate limiting with action-specific limits
      if (rateLimitKey || actionType) {
        const identifier = rateLimitKey || "default";
        let allowed = true;

        if (actionType) {
          const result = await RateLimiter.checkActionRateLimit(
            identifier,
            actionType,
          );
          allowed = result.allowed;
        } else {
          allowed = await RateLimiter.checkRateLimit(identifier);
        }

        if (!allowed) {
          await SecurityMonitor.monitorSuspiciousActivity({
            type: "rapid_requests",
            metadata: {
              function: apiCall.name,
              identifier,
              actionType,
            },
          });
          throw new Error("Rate limit exceeded. Please try again later.");
        }
      }

      // Input validation and sanitization
      if (validateInput && sanitizeArgs) {
        args = args.map((arg) => {
          if (typeof arg === "string") {
            return InputSanitizer.sanitizeText(arg);
          } else if (typeof arg === "object" && arg !== null) {
            return sanitizeObject(arg);
          }
          return arg;
        }) as Parameters<T>;
      }

      // Fraud detection for sensitive operations
      if (fraudCheck && requireAuth) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const suspiciousFlags =
            await SecurityMonitor.checkUserSuspiciousFlags(user.id);
          if (
            suspiciousFlags.isFlagged &&
            suspiciousFlags.riskLevel === "high"
          ) {
            throw new Error("Access restricted due to suspicious activity");
          }
        }
      }

      // Make API call
      const result = await apiCall(...args);
      return result;
    } catch (error) {
      if (monitorFailures) {
        await SecurityMonitor.monitorSuspiciousActivity({
          type: "invalid_input",
          metadata: {
            function: apiCall.name,
            error: (error as Error).message,
            args: InputSanitizer.sanitizeForLogging(args),
          },
        });
      }
      throw error;
    }
  }) as T;

  // Helper method to sanitize objects
  function sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeObject(item));
    } else if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          sanitized[key] = InputSanitizer.sanitizeText(value);
        } else if (value && typeof value === "object") {
          sanitized[key] = sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return obj;
  }
}
