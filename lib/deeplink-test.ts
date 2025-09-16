/**
 * Deep Link Testing Utilities
 *
 * This file contains utilities for testing deep links during development.
 * Use these functions to simulate incoming deep links and test navigation.
 */

import * as Linking from "expo-linking";
import {
  parseDeepLinkUrl,
  navigateToDeepLink,
  DEEP_LINK_ROUTES,
} from "./deeplink";

// Debug function to check if a URL should be ignored
export function debugUrlFiltering(url: string): void {
  console.log(`\n🔍 URL Filtering Debug: ${url}`);
  console.log("=".repeat(50));

  // Check conditions
  const isExp = url.startsWith("exp://");
  const isExps = url.startsWith("exps://");
  const has8081 = url.includes(":8081");
  const hasLocalhost = url.includes("localhost");
  const hasLoopback = url.includes("127.0.0.1");
  const isFile = url.startsWith("file://");
  const isEmpty = !url || url.length < 5;

  console.log("Conditions:");
  console.log(`  - Starts with 'exp://': ${isExp}`);
  console.log(`  - Starts with 'exps://': ${isExps}`);
  console.log(`  - Contains ':8081': ${has8081}`);
  console.log(`  - Contains 'localhost': ${hasLocalhost}`);
  console.log(`  - Contains '127.0.0.1': ${hasLoopback}`);
  console.log(`  - Starts with 'file://': ${isFile}`);
  console.log(`  - Is empty/too short: ${isEmpty}`);

  const shouldIgnore =
    isExp ||
    isExps ||
    has8081 ||
    hasLocalhost ||
    hasLoopback ||
    isFile ||
    isEmpty;
  console.log(
    `\n🎯 Result: ${shouldIgnore ? "❌ SHOULD IGNORE" : "✅ SHOULD PROCESS"}`,
  );
}

// Test deep link URLs for each route category
export const TEST_DEEP_LINKS = {
  // Public routes (no auth required)
  public: [
    "plate://restaurant/test-restaurant-123",
    "plate://restaurant/test-restaurant-123/menu",
    "plate://restaurant/test-restaurant-123/reviews",
    "plate://search",
    "plate://cuisine/italian",
    "plate://home",
    "plate://legal/privacy",
    "plate://help",
    "https://plate-app.com/restaurant/test-restaurant-456",
    "https://plate-app.com/search",
  ],

  // Protected routes (auth required)
  protected: [
    "plate://profile",
    "plate://profile/loyalty",
    "plate://profile/notifications",
    "plate://booking/test-booking-789",
    "plate://booking/create",
    "plate://booking/success",
    "plate://playlist/test-playlist-101",
    "plate://playlist/join/ABC123",
    "plate://social/feed",
    "plate://social/post/test-post-202",
    "plate://social/profile/test-user-303",
    "plate://favorites",
    "plate://bookings",
    "plate://offers",
    "plate://waitlist",
    "https://plate-app.com/profile/loyalty",
    "https://plate-app.com/booking/test-booking-404",
  ],

  // Invalid/unsupported routes
  invalid: [
    "plate://invalid-route",
    "plate://restaurant", // Missing ID
    "https://plate-app.com/nonexistent",
    "plate://",
    "invalid-scheme://restaurant/123",
  ],
};

/**
 * Test if a deep link URL is properly parsed
 */
export function testDeepLinkParsing(url: string): void {
  console.log(`\n🧪 Testing Deep Link: ${url}`);
  console.log("=".repeat(50));

  try {
    const result = parseDeepLinkUrl(url);
    console.log("✅ Parsing Result:");
    console.log("  Route Found:", result.route ? "Yes" : "No");
    console.log("  Target Path:", result.path);
    console.log("  Parameters:", JSON.stringify(result.params, null, 2));
    console.log("  Protected:", result.route?.protected ? "Yes" : "No");
    console.log("  Description:", result.route?.description || "N/A");
  } catch (error) {
    console.log("❌ Parsing Error:", error);
  }
}

/**
 * Test navigation for a deep link URL
 */
export async function testDeepLinkNavigation(
  url: string,
  options: { isAuthenticated?: boolean } = {},
): Promise<void> {
  console.log(`\n🚀 Testing Navigation: ${url}`);
  console.log("=".repeat(50));
  console.log(
    "Auth Status:",
    options.isAuthenticated ? "Authenticated" : "Unauthenticated",
  );

  const success = navigateToDeepLink(url, {
    isAuthenticated: options.isAuthenticated || false,
    fallbackPath: "/",
    onAuthRequired: () => {
      console.log("🔐 Auth Required - Would redirect to sign-in");
    },
  });

  console.log("Navigation Result:", success ? "✅ Success" : "❌ Failed");
}

/**
 * Run comprehensive deep link tests
 */
export function runDeepLinkTests(): void {
  console.log("🧪 DEEP LINK COMPREHENSIVE TESTS");
  console.log("=".repeat(50));

  // Test parsing for all categories
  console.log("\n📋 TESTING URL PARSING");
  console.log("-".repeat(30));

  Object.entries(TEST_DEEP_LINKS).forEach(([category, urls]) => {
    console.log(`\n${category.toUpperCase()} ROUTES:`);
    urls.forEach(testDeepLinkParsing);
  });

  // Test route coverage
  console.log("\n📊 ROUTE COVERAGE ANALYSIS");
  console.log("-".repeat(30));
  const totalRoutes = DEEP_LINK_ROUTES.length;
  const testedRoutes = new Set();

  Object.values(TEST_DEEP_LINKS)
    .flat()
    .forEach((url) => {
      const { route } = parseDeepLinkUrl(url);
      if (route) {
        testedRoutes.add(route.pattern.source);
      }
    });

  console.log(`Total Defined Routes: ${totalRoutes}`);
  console.log(`Tested Routes: ${testedRoutes.size}`);
  console.log(
    `Coverage: ${Math.round((testedRoutes.size / totalRoutes) * 100)}%`,
  );

  // Find untested routes
  const untestedRoutes = DEEP_LINK_ROUTES.filter(
    (route) => !testedRoutes.has(route.pattern.source),
  );

  if (untestedRoutes.length > 0) {
    console.log("\n⚠️  UNTESTED ROUTES:");
    untestedRoutes.forEach((route) => {
      console.log(`  - ${route.description}: ${route.pattern.source}`);
    });
  }
}

/**
 * Simulate receiving a deep link (for testing during development)
 */
export function simulateDeepLink(url: string): void {
  console.log(`🔗 Simulating Deep Link: ${url}`);

  // This simulates what happens when a deep link is received
  // In a real app, this would be handled automatically by the DeepLinkProvider
  if (typeof Linking.openURL === "function") {
    Linking.openURL(url).catch((error) => {
      console.error("Failed to simulate deep link:", error);
    });
  } else {
    console.log("Linking.openURL not available in current environment");
  }
}

/**
 * Generate test URLs for a specific route pattern
 */
export function generateTestUrlsForPattern(
  pattern: RegExp,
  description: string,
): string[] {
  console.log(`\n🎯 Generating test URLs for: ${description}`);
  console.log(`Pattern: ${pattern.source}`);

  // This is a simplified generator - in practice, you'd customize based on the pattern
  const testUrls: string[] = [];

  if (pattern.source.includes("([a-zA-Z0-9-]+)")) {
    // Generate test URLs with different ID formats
    const testIds = ["123", "test-id", "abc-123-def", "restaurant-456"];

    testIds.forEach((id) => {
      const samplePath = pattern.source
        .replace("^", "")
        .replace("$", "")
        .replace("([a-zA-Z0-9-]+)", id);

      testUrls.push(`plate://${samplePath}`);
      testUrls.push(`https://plate-app.com${samplePath}`);
    });
  }

  testUrls.forEach((url) => console.log(`  - ${url}`));
  return testUrls;
}

/**
 * Validate deep link configuration
 */
export function validateDeepLinkConfig(): void {
  console.log("🔍 VALIDATING DEEP LINK CONFIGURATION");
  console.log("=".repeat(50));

  // Check for duplicate patterns
  const patterns = DEEP_LINK_ROUTES.map((route) => route.pattern.source);
  const duplicates = patterns.filter(
    (pattern, index) => patterns.indexOf(pattern) !== index,
  );

  if (duplicates.length > 0) {
    console.log("❌ Duplicate patterns found:");
    duplicates.forEach((pattern) => console.log(`  - ${pattern}`));
  } else {
    console.log("✅ No duplicate patterns found");
  }

  // Check for conflicting patterns
  console.log("\n🔧 Pattern Conflict Analysis:");
  DEEP_LINK_ROUTES.forEach((route1, i) => {
    DEEP_LINK_ROUTES.forEach((route2, j) => {
      if (i !== j) {
        // Simple overlap check - in practice, you'd want more sophisticated analysis
        const path1 = route1.pattern.source;
        const path2 = route2.pattern.source;

        if (
          path1.includes(path2.substring(0, 10)) ||
          path2.includes(path1.substring(0, 10))
        ) {
          console.log(
            `⚠️  Potential conflict: ${route1.description} vs ${route2.description}`,
          );
        }
      }
    });
  });

  console.log("✅ Configuration validation complete");
}

// Export everything for easy testing
export default {
  TEST_DEEP_LINKS,
  testDeepLinkParsing,
  testDeepLinkNavigation,
  runDeepLinkTests,
  simulateDeepLink,
  generateTestUrlsForPattern,
  validateDeepLinkConfig,
};
