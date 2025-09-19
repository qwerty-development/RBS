import { router } from "expo-router";
import * as Linking from "expo-linking";

// Deep link URL patterns and their corresponding routes
export interface DeepLinkRoute {
  pattern: RegExp;
  path: (params: Record<string, string>) => string;
  protected?: boolean;
  description: string;
}

// Define all supported deep link routes
export const DEEP_LINK_ROUTES: DeepLinkRoute[] = [
  // Restaurant routes
  {
    pattern: /^\/restaurant\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/restaurant/${params.id}`,
    description: "Restaurant details page",
  },
  {
    pattern: /^\/restaurant\/([a-zA-Z0-9-]+)\/reviews$/,
    path: (params) => `/restaurant/${params.id}/reviews`,
    description: "Restaurant reviews page",
  },
  {
    pattern: /^\/restaurant\/([a-zA-Z0-9-]+)\/menu$/,
    path: (params) => `/restaurant/${params.id}/menu`,
    description: "Restaurant menu page",
  },

  // Booking routes
  {
    pattern: /^\/booking\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/booking/${params.id}`,
    protected: true,
    description: "Booking details page",
  },
  {
    pattern: /^\/booking\/create$/,
    path: () => "/booking/create",
    protected: true,
    description: "Create booking page",
  },
  {
    pattern: /^\/booking\/success$/,
    path: () => "/booking/success",
    protected: true,
    description: "Booking success page",
  },

  // Playlist routes
  {
    pattern: /^\/playlist\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/playlist/${params.id}`,
    protected: true,
    description: "Playlist details page",
  },
  {
    pattern: /^\/playlist\/join\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/playlist/join?code=${params.code}`,
    protected: true,
    description: "Join playlist page",
  },

  // Profile routes
  {
    pattern: /^\/profile$/,
    path: () => "/profile",
    protected: true,
    description: "User profile page",
  },
  {
    pattern: /^\/profile\/loyalty$/,
    path: () => "/profile/loyalty",
    protected: true,
    description: "Loyalty points page",
  },
  {
    pattern: /^\/profile\/notifications$/,
    path: () => "/profile/notifications",
    protected: true,
    description: "Notification settings page",
  },

  // Social routes
  {
    pattern: /^\/social\/feed$/,
    path: () => "/social/feed",
    protected: true,
    description: "Social feed page",
  },
  {
    pattern: /^\/social\/post\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/social/post/${params.id}`,
    protected: true,
    description: "Social post details page",
  },
  {
    pattern: /^\/social\/profile\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/social/profile/${params.id}`,
    protected: true,
    description: "User social profile page",
  },

  // Search and discovery
  {
    pattern: /^\/search$/,
    path: () => "/search",
    description: "Search page",
  },
  {
    pattern: /^\/cuisine\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/cuisine/${params.id}`,
    description: "Cuisine category page",
  },

  // Waitlist routes
  {
    pattern: /^\/waitlist$/,
    path: () => "/waitlist",
    protected: true,
    description: "Waitlist page",
  },
  {
    pattern: /^\/waiting-list$/,
    path: () => "/waiting-list",
    protected: true,
    description: "Waiting list management page",
  },

  // Home and main tabs
  {
    pattern: /^\/home$/,
    path: () => "/",
    description: "Home page",
  },
  {
    pattern: /^\/favorites$/,
    path: () => "/favorites",
    protected: true,
    description: "Favorites page",
  },
  {
    pattern: /^\/bookings$/,
    path: () => "/bookings",
    protected: true,
    description: "My bookings page",
  },

  // Offers and promotions
  {
    pattern: /^\/offers$/,
    path: () => "/offers",
    protected: true,
    description: "Offers and promotions page",
  },

  // Legal and support
  {
    pattern: /^\/legal\/([a-zA-Z0-9-]+)$/,
    path: (params) => `/legal/${params.documentType}`,
    description: "Legal document page",
  },
  {
    pattern: /^\/help$/,
    path: () => "/profile/help",
    description: "Help and support page",
  },

  // Auth routes (handled separately)
  {
    pattern: /^\/auth\/callback$/,
    path: () => "/auth/callback",
    description: "Auth callback page",
  },
];

// Check if URL should be ignored (development URLs, etc.)
function shouldIgnoreUrl(url: string): boolean {
  // Ignore Expo development URLs
  if (url.startsWith("exp://")) return true;
  if (url.startsWith("exps://")) return true;

  // Ignore Metro bundler URLs
  if (url.includes(":8081")) return true;
  if (url.includes("localhost")) return true;
  if (url.includes("127.0.0.1")) return true;

  // Ignore file URLs
  if (url.startsWith("file://")) return true;

  // Ignore empty or invalid URLs
  if (!url || url.length < 5) return true;

  return false;
}

// Parse deep link URL and extract parameters
export function parseDeepLinkUrl(url: string): {
  route: DeepLinkRoute | null;
  params: Record<string, string>;
  path: string;
} {
  try {
    // Check if we should ignore this URL
    if (shouldIgnoreUrl(url)) {
      return {
        route: null,
        params: {},
        path: "/",
      };
    }

    const parsedUrl = Linking.parse(url);
    const pathname = parsedUrl.path || "/";
    const queryParams = parsedUrl.queryParams || {};

    // Try to match against defined routes
    for (const route of DEEP_LINK_ROUTES) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};

        // Convert queryParams to string-only params
        if (queryParams) {
          Object.entries(queryParams).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              params[key] = value[0] || "";
            } else {
              params[key] = value || "";
            }
          });
        }

        // Extract named parameters from regex groups
        if (match[1]) params.id = match[1];
        if (match[2]) params.code = match[1]; // for join codes
        if (pathname.includes("/cuisine/")) params.cuisineId = match[1];
        if (pathname.includes("/restaurant/")) params.restaurantId = match[1];
        if (pathname.includes("/legal/")) params.documentType = match[1];

        return {
          route,
          params,
          path: route.path(params),
        };
      }
    }

    // If no specific route found, return the pathname as-is
    const fallbackParams: Record<string, string> = {};
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          fallbackParams[key] = value[0] || "";
        } else {
          fallbackParams[key] = value || "";
        }
      });
    }

    return {
      route: null,
      params: fallbackParams,
      path: pathname,
    };
  } catch (error) {
    console.warn("Failed to parse deep link URL:", url, error);
    // During potential cold start scenarios, preserve the original path for retry
    // instead of immediately falling back to "/"
    const fallbackPath =
      url.includes("restaurant/") ||
      url.includes("booking/") ||
      url.includes("playlist/")
        ? pathname || "/"
        : "/";

    return {
      route: null,
      params: {},
      path: fallbackPath,
    };
  }
}

// Generate deep link URLs
export function generateDeepLink(
  path: string,
  scheme: string = "plate",
): string {
  const baseUrl = `${scheme}://`;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

// Generate universal link (website URL)
export function generateUniversalLink(
  path: string,
  domain: string = "plate-app.com",
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `https://${domain}${cleanPath}`;
}

// Navigate using deep link path
export function navigateToDeepLink(
  url: string,
  options: {
    replace?: boolean;
    fallbackPath?: string;
    onAuthRequired?: () => void;
    isAuthenticated?: boolean;
    canNavigate?: boolean;
  } = {},
): boolean {
  try {
    // Skip navigation if we shouldn't ignore the URL or can't navigate yet
    if (shouldIgnoreUrl(url)) {
   
      return false;
    }

    // Check if we can navigate (component is mounted)
    if (options.canNavigate === false) {

      return false;
    }

    const { route, path } = parseDeepLinkUrl(url);

    // Skip if no valid route found and path is just "/" - but only if this isn't a cold start scenario
    if (!route && path === "/") {
      // Check if this could be a cold start issue by examining the original URL
      const couldBeColdStart =
        url.includes("restaurant/") ||
        url.includes("booking/") ||
        url.includes("playlist/") ||
        url.includes("waiting-list") ||
        url.includes("offers") ||
        url.includes("profile");

      if (couldBeColdStart) {
     
      } else {
    
        return false;
      }
    }

    // Check if route requires authentication
    if (route?.protected && !options.isAuthenticated) {
    
      options.onAuthRequired?.();
      return false;
    }

    // Navigate to the path
    try {
      if (options.replace) {
        router.replace(path as any);
      } else {
        router.push(path as any);
      }

    
      return true;
    } catch (navigationError) {
      console.warn("Router navigation failed:", navigationError);

      // Only try fallback if we have one and it's different from current attempt
      if (options.fallbackPath && options.fallbackPath !== path) {
        try {
          if (options.replace) {
            router.replace(options.fallbackPath as any);
          } else {
            router.push(options.fallbackPath as any);
          }
          return true;
        } catch (fallbackError) {
          console.error("Fallback navigation also failed:", fallbackError);
        }
      }

      return false;
    }
  } catch (error) {
    console.error("Deep link processing failed:", url, error);
    return false;
  }
}

// Validate if a URL is a supported deep link
export function isSupportedDeepLink(url: string): boolean {
  const { route } = parseDeepLinkUrl(url);
  return route !== null;
}

// Get all available deep link patterns for documentation
export function getAvailableDeepLinks(): DeepLinkRoute[] {
  return DEEP_LINK_ROUTES;
}

// Create sharing links
export function createShareableLink(
  path: string,
  preferUniversal: boolean = true,
): string {
  if (preferUniversal) {
    return generateUniversalLink(path);
  }
  return generateDeepLink(path);
}
