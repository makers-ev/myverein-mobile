import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

interface KeyboardAwareScreenProps {
  children: React.ReactNode;
  className?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
}

export default function KeyboardAwareScreen({
  children,
  className,
  contentContainerStyle,
  showsVerticalScrollIndicator,
}: KeyboardAwareScreenProps) {
  return (
    <SafeAreaView className={`flex-1 ${className ?? ''}`}>
      <KeyboardAwareScrollView
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
