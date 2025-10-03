// components/CustomTabBar.tsx
import * as React from "react";
import {
  View,
  Pressable,
  LayoutChangeEvent,
  Animated,
  Text,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Search, Heart, Calendar, User } from "lucide-react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const BAR_HEIGHT = 64;     // fixed height for precise centering
const PILL_HEIGHT = 40;    // active indicator height
const H_PADDING = 14;      // horizontal padding inside bar

type Props = BottomTabBarProps & {
  primary: string;
  primaryForeground: string;
  mutedForeground: string;
  isDark: boolean;
  upcomingCount: number;
  onReselectHome?: () => void;
  noiseSource?: number; // optional require("@/assets/noise.png")
};

const ICONS: Record<string, React.ComponentType<any>> = {
  index: Home,
  search: Search,
  favorites: Heart,
  bookings: Calendar,
  social: User,
};

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
  primary,
  primaryForeground,
  mutedForeground,
  isDark,
  upcomingCount,
  onReselectHome,
  noiseSource,
}: Props) {
  const { bottom } = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = React.useState(0);
  const itemW =
    innerWidth > 0 ? innerWidth / Math.max(1, state.routes.length) : 0;

  // Active pill animation
  const x = React.useRef(new Animated.Value(state.index)).current;
  React.useEffect(() => {
    Animated.spring(x, {
      toValue: state.index,
      useNativeDriver: true,
      bounciness: 8,
      speed: 20,
    }).start();
  }, [state.index]);

  const handleLayout = (e: LayoutChangeEvent) => {
    // width of the gradient shell minus internal padding on both sides
    const w = e.nativeEvent.layout.width - H_PADDING * 2;
    setInnerWidth(Math.max(0, w));
  };

  // Ultra-transparent glassy layers for maximum blur simulation
  const glassTop = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.25)";
  const glassBot = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.15)";
  const innerShineTop = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.20)";
  const innerShineBot = "rgba(255,255,255,0.00)";
  const borderCol = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)";
  const pillCol = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        // lift it even lower: safe-area + minimal extra
        bottom: Math.max(16, bottom + 8),
      }}
    >
      <View
        style={{
          borderRadius: 24,
          overflow: "visible",
          // floating shadow
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.35 : 0.18,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20,
          elevation: 18,
        }}
        onLayout={handleLayout}
      >
        {/* Shell: fixed height so icons always sit inside */}
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={{
            height: BAR_HEIGHT,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          {/* Subtle overlay for better contrast */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: isDark ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
              borderRadius: 24,
            }}
          />
          {/* Content container */}
          <View style={{ flex: 1 }}>
              {/* Optional noise for texture */}
              {noiseSource && (
                <Image
                  source={noiseSource}
                  resizeMode="repeat"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    opacity: isDark ? 0.08 : 0.06,
                  }}
                />
              )}
              {/* Hairline border */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: borderCol,
                }}
              />

              {/* Active pill (vertically centered) */}
              {itemW > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: (BAR_HEIGHT - PILL_HEIGHT) / 2,
                    left: H_PADDING,
                    width: itemW,
                    height: PILL_HEIGHT,
                    transform: [
                      {
                        translateX: x.interpolate({
                          inputRange: [0, state.routes.length - 1],
                          outputRange: [0, (state.routes.length - 1) * itemW],
                        }),
                      },
                    ],
                    borderRadius: PILL_HEIGHT / 2,
                    backgroundColor: pillCol,
                  }}
                />
              )}

              {/* Row (centered content) */}
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  paddingHorizontal: H_PADDING,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {state.routes.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const label =
                    options.tabBarLabel ?? options.title ?? route.name;
                  const isFocused = state.index === index;

                  const onPress = () => {
                    const event = navigation.emit({
                      type: "tabPress",
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!event.defaultPrevented) {
                      if (isFocused && route.name === "index" && onReselectHome) {
                        onReselectHome();
                        return;
                      }
                      navigation.navigate(route.name as never);
                    }
                  };

                  const Icon =
                    ICONS[route.name] ?? (() => <View style={{ width: 24 }} />);

                  const showBadge = route.name === "bookings" && upcomingCount > 0;

                  return (
                    <Pressable
                      key={route.key}
                      onPress={onPress}
                      style={{
                        width: itemW || undefined,
                        height: PILL_HEIGHT,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 8,
                      }}
                    >
                      <View>
                        <Icon
                          size={22}
                          color={isFocused ? primary : (mutedForeground as string)}
                          strokeWidth={2}
                        />
                        {showBadge && (
                          <View
                            style={{
                              position: "absolute",
                              right: -10,
                              top: -6,
                              backgroundColor: primary,
                              borderRadius: 9,
                              minWidth: 18,
                              height: 18,
                              paddingHorizontal: 4,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: primaryForeground,
                                fontSize: 10,
                                fontWeight: "700",
                              }}
                            >
                              {upcomingCount > 9 ? "9+" : String(upcomingCount)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {isFocused && typeof label === "string" && (
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: primary,
                          }}
                        >
                          {label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
        </BlurView>
      </View>
    </View>
  );
}
