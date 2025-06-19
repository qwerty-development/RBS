import React, { useState, useRef } from "react";
import { View, Pressable, Modal, PanResponder, Dimensions, Animated, PanResponderGestureState } from "react-native";
import { Text } from "@/components/ui/text";
import ChatTestScreen from "@/app/(protected)/chat-test";
import { ChatMessage } from "@/ai/AI_Agent";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function GlobalChatTab() {
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const insets = useSafeAreaInsets();
  
  // Panel dimensions - only vertical since it's only on sides
  const panelWidth = 24;
  const panelHeight = 80;
  
  // Tab bar height estimate (standard tab bar is around 80-90px)
  const tabBarHeight = 80;
  
  // Safe area boundaries - constrained between safe area top and tab bar
  const safeAreaBounds = {
    left: insets.left,
    right: screenWidth - insets.right,
    top: insets.top + 20, // Add some padding from top
    bottom: screenHeight - insets.bottom - tabBarHeight - 20, // Account for tab bar + padding
  };
  
  // Panel position state - start on right side, vertically centered
  const [currentPosition, setCurrentPosition] = useState({ 
    x: safeAreaBounds.right - panelWidth, 
    y: safeAreaBounds.top + (safeAreaBounds.bottom - safeAreaBounds.top) * 0.4 
  });
  const [isOnLeftSide, setIsOnLeftSide] = useState(false);
  
  const pan = useRef(new Animated.ValueXY(currentPosition)).current;
  
  // Snap to left or right edge after dragging
  const snapToEdge = (gestureState: PanResponderGestureState) => {
    const newX = currentPosition.x + gestureState.dx;
    let newY = currentPosition.y + gestureState.dy;
    
    // Constrain Y position within safe bounds
    newY = Math.max(safeAreaBounds.top, Math.min(safeAreaBounds.bottom - panelHeight, newY));
    
    // Determine which side to snap to based on screen center
    const screenCenter = screenWidth / 2;
    let finalX: number;
    let newIsOnLeftSide: boolean;
    
    if (newX < screenCenter) {
      // Snap to left edge
      finalX = safeAreaBounds.left;
      newIsOnLeftSide = true;
    } else {
      // Snap to right edge  
      finalX = safeAreaBounds.right - panelWidth;
      newIsOnLeftSide = false;
    }
    
    const finalPosition = { x: finalX, y: newY };
    setCurrentPosition(finalPosition);
    setIsOnLeftSide(newIsOnLeftSide);
    
    Animated.spring(pan, {
      toValue: finalPosition,
      useNativeDriver: false,
      tension: 150,
      friction: 8,
    }).start();
  };
  
  // Pan responder for drag functionality
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
    },
    onPanResponderGrant: () => {
      pan.setOffset(currentPosition);
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x, dy: pan.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (evt, gestureState) => {
      pan.flattenOffset();
      snapToEdge(gestureState);
    },
  });
  
  // Get panel styling - always vertical since only on sides
  const getPanelStyle = () => {
    if (isOnLeftSide) {
      return "bg-gray-400 shadow-lg elevation-4 items-center justify-center rounded-r-xl";
    } else {
      return "bg-gray-400 shadow-lg elevation-4 items-center justify-center rounded-l-xl";
    }
  };

  return (
    <>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: pan.x,
            top: pan.y,
            zIndex: 50,
            width: panelWidth,
            height: panelHeight,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={() => setShowChatModal(true)}
          className={getPanelStyle()}
          style={{ width: panelWidth, height: panelHeight }}
        >
          <View className="items-center justify-center flex-1">
            <Text className="text-black  text-base font-bold tracking-wider transform ">
              🤖
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChatModal(false)}
      >
        <ChatTestScreen
          onClose={() => setShowChatModal(false)}
          messages={messages}
          setMessages={setMessages}
        />
      </Modal>
    </>
  );
}