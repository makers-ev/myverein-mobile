import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';

interface VerifyPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPin: string | null;
  /** Whether entry is currently locked out due to too many failed attempts. */
  isLocked: boolean;
  /** Seconds remaining until the lockout clears (only meaningful while `isLocked`). */
  lockoutSecondsRemaining: number;
  /** Number of consecutive failed attempts allowed before the next lockout. */
  attemptsRemaining: number;
  /** Called once for every completed 4-digit entry that does not match. */
  onFailedAttempt: () => void;
  /** Called once the entered PIN matches. */
  onSuccessfulAttempt: () => void;
}

export default function VerifyPinModal({
  visible,
  onClose,
  onSuccess,
  currentPin,
  isLocked,
  lockoutSecondsRemaining,
  attemptsRemaining,
  onFailedAttempt,
  onSuccessfulAttempt,
}: VerifyPinModalProps) {
  const { t } = useLanguage();

  const [inputPin, setInputPin] = useState('');
  // Tracks the previous `visible` so a close->reopen can reset the input
  // during render (React's documented alternative to an effect for
  // "adjust state when a prop changes") instead of via useEffect -- attempt
  // counting itself lives in the parent so it survives this.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) setInputPin('');
  }

  const handleChangeText = (value: string) => {
    setInputPin(value);
    if (!visible || isLocked || value.length !== 4) return;

    if (currentPin && value === currentPin) {
      onSuccessfulAttempt();
      setInputPin('');
      onSuccess();
    } else {
      onFailedAttempt();
      setInputPin('');
    }
  };

  const lockoutMessage = t('lockout.too-many-attempts').replace(
    '{seconds}',
    String(lockoutSecondsRemaining)
  );
  const attemptsMessage = t('lockout.attempts-remaining').replace(
    '{count}',
    String(attemptsRemaining)
  );

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center items-center bg-black/50"
      >
        <View className="bg-white w-80 p-6 rounded-2xl shadow-xl">
          <Text className="text-xl font-bold text-center mb-2 text-gray-800">
            {t('remove-pin-modal.title')}
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-6">
            {t('remove-pin-modal.message')}
          </Text>

          <View className="mb-2">
            <TextInput
              className={`bg-gray-100 p-3 rounded-lg text-center text-2xl tracking-widest font-bold ${
                isLocked ? 'opacity-50' : ''
              }`}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              editable={!isLocked}
              value={inputPin}
              onChangeText={handleChangeText}
              placeholder="****"
              autoFocus={true}
            />
          </View>

          <View className="h-10 mb-2 justify-center">
            {isLocked ? (
              <Text className="text-red-600 text-xs text-center font-semibold">
                {lockoutMessage}
              </Text>
            ) : (
              <Text className="text-gray-400 text-xs text-center">{attemptsMessage}</Text>
            )}
          </View>

          <View className="flex-row justify-between">
            <TouchableOpacity onPress={onClose} className="flex-1 py-3">
              <Text className="text-center text-gray-500 font-semibold">
                {t('settings.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
