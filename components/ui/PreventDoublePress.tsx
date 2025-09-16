// components/ui/PreventDoublePress.tsx
import React, { useRef, useCallback } from "react";
import { Pressable, PressableProps } from "react-native";

interface PreventDoublePressProps extends PressableProps {
  /**
   * Debounce delay in milliseconds to prevent double-clicks
   * @default 300
   */
  debounceMs?: number;
  /**
   * Whether to enable double-click prevention
   * @default true
   */
  enableDebounce?: boolean;
  /**
   * Children function that receives the press handler
   */
  children: (props: { onPress: () => void }) => React.ReactNode;
}

/**
 * Higher-order component that prevents double-clicks on any pressable element
 * Can be used to wrap any component that needs double-click prevention
 */
export function PreventDoublePress({
  debounceMs = 300,
  enableDebounce = true,
  children,
  onPress,
  ...pressableProps
}: PreventDoublePressProps) {
  const lastPressTime = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);

  const handlePress = useCallback(() => {
    if (!onPress) return;

    const now = Date.now();

    // Double-click prevention
    if (enableDebounce) {
      if (isProcessing.current) {
        return;
      }

      if (now - lastPressTime.current < debounceMs) {
        return;
      }

      lastPressTime.current = now;
      isProcessing.current = true;
    }

    try {
      onPress();
    } catch (error) {
      console.error("Error in PreventDoublePress handler:", error);
    } finally {
      if (enableDebounce) {
        // Reset processing flag after a short delay
        setTimeout(() => {
          isProcessing.current = false;
        }, debounceMs);
      }
    }
  }, [onPress, debounceMs, enableDebounce]);

  return (
    <Pressable {...pressableProps} onPress={handlePress}>
      {children({ onPress: handlePress })}
    </Pressable>
  );
}

/**
 * Simple wrapper for buttons that need double-click prevention
 */
export function PreventDoublePressButton({
  children,
  onPress,
  debounceMs = 300,
  enableDebounce = true,
  ...props
}: Omit<PreventDoublePressProps, "children"> & {
  children: React.ReactNode;
}) {
  return (
    <PreventDoublePress
      onPress={onPress}
      debounceMs={debounceMs}
      enableDebounce={enableDebounce}
      {...props}
    >
      {() => children}
    </PreventDoublePress>
  );
}
