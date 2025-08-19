import { useColorScheme as useNativewindColorScheme } from "nativewind";
import { useState, useEffect } from "react";
import { Appearance } from "react-native";

export function useColorScheme() {
  const [fallbackColorScheme, setFallbackColorScheme] = useState<
    "light" | "dark"
  >(Appearance.getColorScheme() || "dark");

  // Listen to system appearance changes for fallback
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setFallbackColorScheme(colorScheme || "dark");
    });
    return () => subscription.remove();
  }, []);

  try {
    const { colorScheme, setColorScheme, toggleColorScheme } =
      useNativewindColorScheme();
    return {
      colorScheme: colorScheme ?? fallbackColorScheme,
      isDarkColorScheme: (colorScheme ?? fallbackColorScheme) === "dark",
      setColorScheme,
      toggleColorScheme,
    };
  } catch (error) {
    // Fallback when navigation context is not available
    console.warn("NativeWind useColorScheme failed, using fallback:", error);
    return {
      colorScheme: fallbackColorScheme,
      isDarkColorScheme: fallbackColorScheme === "dark",
      setColorScheme: (scheme: "light" | "dark") => {
        setFallbackColorScheme(scheme);
        Appearance.setColorScheme(scheme);
      },
      toggleColorScheme: () => {
        const newScheme = fallbackColorScheme === "dark" ? "light" : "dark";
        setFallbackColorScheme(newScheme);
        Appearance.setColorScheme(newScheme);
      },
    };
  }
}
