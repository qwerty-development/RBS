import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { colors } from "@/constants/colors";

export function cn(...inputs: ClassValue[]) {
  const filteredInputs = inputs.filter((input) => input != null);
  return twMerge(clsx(filteredInputs));
}

/**
 * Get themed colors - Light mode only
 * This helps migrate from hard-coded colors to theme-aware colors
 */
export function getThemedColors(): typeof colors.light {
  return colors.light;
}

/**
 * Get a themed color value for inline styles - Light mode only
 * Usage: getThemedColor('primary')
 */
export function getThemedColor(
  colorName: keyof typeof colors.light,
): string {
  return colors.light[colorName] || colors.light.foreground;
}

/**
 * Get icon color - Light mode only
 * Replaces hard-coded "#fff" and "#000" patterns
 */
export function getIconColor(): string {
  return colors.light.foreground;
}

/**
 * Get activity indicator color - Light mode only
 */
export function getActivityIndicatorColor(): string {
  return colors.light.foreground;
}

/**
 * Get refresh control tint color - Light mode only
 */
export function getRefreshControlColor(): string {
  return colors.light.foreground;
}
