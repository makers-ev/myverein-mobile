import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  className?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  /** Lets a screen scroll programmatically (e.g. back to the top after a result banner appears). */
  scrollRef?: React.Ref<KeyboardAwareScrollViewRef>;
}

export default function KeyboardAwareScreen({
  children,
  className,
  contentContainerStyle,
  showsVerticalScrollIndicator,
  scrollRef,
}: KeyboardAwareScreenProps) {
  return (
    <SafeAreaView className={`flex-1 ${className ?? ''}`}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      >
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
