import { useColorScheme as useNativewindColorScheme } from "nativewind";
import { useState, useEffect, useMemo } from "react";
import { Appearance } from "react-native";

export function useColorScheme() {
  const [fallbackColorScheme, setFallbackColorScheme] = useState<
    "light" | "dark"
  >(Appearance.getColorScheme() || "dark");

  const [nativeWindError, setNativeWindError] = useState(false);

  // Always call the hook unconditionally - hooks must be called in the same order every time
  const nativeWindColorScheme = useNativewindColorScheme();

  // Handle errors in useEffect instead of try-catch during render
  useEffect(() => {
    if (!nativeWindColorScheme && !nativeWindError) {
      console.warn("NativeWind useColorScheme returned null, using fallback");
      setNativeWindError(true);
    }
  }, [nativeWindColorScheme, nativeWindError]);

  // Listen to system appearance changes for fallback
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setFallbackColorScheme(colorScheme || "dark");
    });
    return () => subscription.remove();
  }, []);

  return useMemo(() => {
    if (nativeWindColorScheme && !nativeWindError) {
      const { colorScheme, setColorScheme, toggleColorScheme } =
        nativeWindColorScheme;
      return {
        colorScheme: colorScheme ?? fallbackColorScheme,
        isDarkColorScheme: (colorScheme ?? fallbackColorScheme) === "dark",
        setColorScheme,
        toggleColorScheme,
      };
    }

    // Fallback when NativeWind is not available
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
  }, [nativeWindColorScheme, nativeWindError, fallbackColorScheme]);
}
