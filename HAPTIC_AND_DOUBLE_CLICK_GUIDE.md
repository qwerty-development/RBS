# Haptic Feedback and Double-Click Prevention Guide

This guide explains how to implement haptic feedback and prevent double-clicks throughout the app.

## Overview

We've implemented a comprehensive system for haptic feedback and double-click prevention that includes:

1. **Custom Hooks** - Reusable hooks for different types of interactions
2. **Higher-Order Components** - Wrapper components for easy integration
3. **Consistent Patterns** - Standardized approach across the app

## Hooks Available

### `useHapticPress(options)`
The main hook that provides haptic feedback and double-click prevention.

```typescript
import { useHapticPress } from '@/hooks/useHapticPress';

const { handlePress } = useHapticPress({
  hapticStyle: Haptics.ImpactFeedbackStyle.Light,
  debounceMs: 300,
  enableHaptic: true,
  enableDebounce: true,
});

// Usage
const handleButtonPress = () => {
  handlePress(() => {
    // Your action here
    console.log('Button pressed!');
  });
};
```

### Specialized Hooks

#### `useRestaurantPress()`
For restaurant card clicks and navigation.

```typescript
const { handlePress } = useRestaurantPress();

const handleRestaurantClick = () => {
  handlePress(() => {
    router.push(`/restaurant/${restaurantId}`);
  });
};
```

#### `useBookingPress()`
For booking buttons and important actions.

```typescript
const { handlePress } = useBookingPress();

const handleBookTable = () => {
  handlePress(() => {
    // Booking logic
  });
};
```

#### `useQuickActionPress()`
For quick actions like favorites, playlist, etc.

```typescript
const { handlePress } = useQuickActionPress();

const handleFavorite = () => {
  handlePress(() => {
    toggleFavorite();
  });
};
```

#### `useModalPress()`
For modal interactions and overlays.

```typescript
const { handlePress } = useModalPress();

const handleModalClose = () => {
  handlePress(() => {
    setModalVisible(false);
  });
};
```

## Higher-Order Components

### `PreventDoublePress`
A wrapper component that prevents double-clicks on any pressable element.

```typescript
import { PreventDoublePress } from '@/components/ui/PreventDoublePress';

<PreventDoublePress
  onPress={handlePress}
  debounceMs={500}
  enableDebounce={true}
>
  {({ onPress }) => (
    <Pressable onPress={onPress}>
      <Text>Click me</Text>
    </Pressable>
  )}
</PreventDoublePress>
```

### `PreventDoublePressButton`
A simple wrapper for buttons.

```typescript
import { PreventDoublePressButton } from '@/components/ui/PreventDoublePress';

<PreventDoublePressButton
  onPress={handlePress}
  debounceMs={300}
>
  <Text>Button Text</Text>
</PreventDoublePressButton>
```

## Implementation Patterns

### 1. Restaurant Cards
```typescript
// In RestaurantCard.tsx
const { handlePress: handleRestaurantPress } = useRestaurantPress();
const { handlePress: handleQuickActionPress } = useQuickActionPress();

const handlePress = () => {
  handleRestaurantPress(() => {
    if (onPress) {
      onPress(restaurantData.id);
    } else {
      router.push({
        pathname: "/restaurant/[id]",
        params: { id: restaurantData.id },
      });
    }
  });
};

const handleFavorite = () => {
  handleQuickActionPress(() => {
    onFavoritePress();
  });
};
```

### 2. Booking Buttons
```typescript
// In booking components
const { handlePress: handleBookingPress } = useBookingPress();

const handleBookTable = () => {
  handleBookingPress(() => {
    // Booking logic
    router.push('/booking/availability');
  });
};
```

### 3. Modal Interactions
```typescript
// In modal components
const { handlePress: handleModalPress } = useModalPress();

const handleClose = () => {
  handleModalPress(() => {
    setModalVisible(false);
  });
};
```

## Configuration Options

### Haptic Styles
- `Haptics.ImpactFeedbackStyle.Light` - Light feedback (quick actions)
- `Haptics.ImpactFeedbackStyle.Medium` - Medium feedback (navigation)
- `Haptics.ImpactFeedbackStyle.Heavy` - Heavy feedback (important actions)

### Debounce Times
- **Quick Actions**: 200ms (favorites, playlist)
- **Navigation**: 500ms (restaurant cards, menu items)
- **Booking Actions**: 1000ms (book table, confirm booking)
- **Modal Actions**: 100ms (close, navigate)

## Best Practices

### 1. Use Appropriate Hooks
- Use `useRestaurantPress` for restaurant navigation
- Use `useBookingPress` for booking-related actions
- Use `useQuickActionPress` for quick interactions
- Use `useModalPress` for modal/overlay interactions

### 2. Consistent Debounce Times
- Keep debounce times consistent across similar actions
- Longer debounce for important actions (booking)
- Shorter debounce for quick actions (favorites)

### 3. Error Handling
- All hooks include error handling
- Errors are logged to console
- Actions continue to work even if haptic feedback fails

### 4. Performance
- Hooks use `useCallback` for optimal performance
- Debounce prevents excessive API calls
- Processing flags prevent race conditions

## Migration Guide

### Before (Old Pattern)
```typescript
const handlePress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  // Action logic
  router.push('/some-page');
};
```

### After (New Pattern)
```typescript
const { handlePress } = useRestaurantPress();

const handlePress = () => {
  handlePress(() => {
    // Action logic
    router.push('/some-page');
  });
};
```

## Testing

### Manual Testing
1. Test haptic feedback on physical device
2. Test double-click prevention by rapidly tapping buttons
3. Verify different haptic intensities feel appropriate
4. Check that actions still work if haptics fail

### Automated Testing
```typescript
// Example test
import { renderHook, act } from '@testing-library/react-hooks';
import { useHapticPress } from '@/hooks/useHapticPress';

test('prevents double clicks', async () => {
  const mockCallback = jest.fn();
  const { result } = renderHook(() => useHapticPress({ debounceMs: 100 }));
  
  // First press
  act(() => {
    result.current.handlePress(mockCallback);
  });
  
  // Immediate second press (should be ignored)
  act(() => {
    result.current.handlePress(mockCallback);
  });
  
  expect(mockCallback).toHaveBeenCalledTimes(1);
});
```

## Troubleshooting

### Common Issues

1. **Haptic feedback not working**
   - Ensure you're testing on a physical device
   - Check that `expo-haptics` is properly installed
   - Verify device supports haptic feedback

2. **Double-clicks still happening**
   - Check debounce time is appropriate
   - Ensure `enableDebounce` is true
   - Verify the hook is being used correctly

3. **Performance issues**
   - Check for excessive re-renders
   - Ensure `useCallback` is used properly
   - Verify debounce times aren't too long

### Debug Mode
Enable debug logging by setting:
```typescript
const { handlePress } = useHapticPress({
  // ... other options
  debug: true, // Add this for debug logging
});
```

## Future Enhancements

1. **Custom Haptic Patterns**
   - Add support for custom haptic sequences
   - Implement success/error haptic patterns

2. **Accessibility**
   - Add haptic feedback preferences
   - Support for reduced motion settings

3. **Analytics**
   - Track haptic feedback usage
   - Monitor double-click prevention effectiveness

4. **Advanced Debouncing**
   - Smart debouncing based on action type
   - Context-aware debounce times
