import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Linking } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  titleColor?: string;
  messageColor?: string;
  requiredConfirmationText?: string;
  /** Masks the input -- for a real credential (e.g. a password), not a typed confirmation phrase. */
  secureTextEntry?: boolean;
  bottomInfoText?: string;
  bottomInfoLinkHypertext?: string;
  bottomInfoLinkTarget?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (value: string) => void;
}

const openURL = (url: string) => {
  Linking.openURL(url).catch(err => console.error('Error opening URL:', err));
};

export default function ConfirmationInputModal({
  visible,
  onClose,
  title,
  message,
  titleColor = 'text-black',
  messageColor = 'text-black',
  requiredConfirmationText,
  secureTextEntry = false,
  bottomInfoText,
  bottomInfoLinkHypertext,
  bottomInfoLinkTarget,
  confirmText = 'Fortfahren',
  cancelText = 'Abbrechen',
  onConfirm,
}: ConfirmationModalProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');

  // No phrase set -> this is a credential field, just require non-empty.
  const isValid = requiredConfirmationText ? input === requiredConfirmationText : input.length > 0;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm?.(input);
    setInput('');
    onClose();
  };

  const handleClose = () => {
    setInput('');
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <TouchableOpacity
        className="flex-1 justify-center items-center bg-black bg-opacity-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onPress={handleClose}
        activeOpacity={1}
      >
        <View className="bg-white rounded-lg p-5 max-w-xs" onStartShouldSetResponder={() => true}>
          <Text className={`text-lg font-bold text-center mb-4 ${titleColor}`}>{title}</Text>
          {message && <Text className={`text-sm text-center mb-4 ${messageColor}`}>{message}</Text>}

          <TextInput
            value={input}
            onChangeText={setInput}
            className="text-center border-2 border-gray-300 rounded-lg p-2 mb-4"
            placeholder={t('confirmation-input-modal.input-placeholder')}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={secureTextEntry}
          />

          {bottomInfoText && !bottomInfoLinkHypertext && (
            <Text className="text-xs text-center mb-4 text-gray-500">
              {bottomInfoText}
            </Text>
          )}

          {bottomInfoText && bottomInfoLinkHypertext && (
            <TouchableOpacity onPress={() => openURL(bottomInfoLinkTarget || '')}>
              <Text className="text-xs text-center mb-4 text-gray-500">
                {bottomInfoText}
                <Text className="text-blue-600 underline">{` ${bottomInfoLinkHypertext}`}</Text>
              </Text>
            </TouchableOpacity>
          )}

          <View className="flex-row justify-around">
            <TouchableOpacity
              className={`py-2 px-4 rounded-md ${isValid ? 'bg-red-600' : 'bg-red-200'}`}
              onPress={handleConfirm}
              disabled={!isValid}
            >
              <Text className="text-white font-bold text-center">{confirmText}</Text>
            </TouchableOpacity>

            <TouchableOpacity className="py-2 px-4 rounded-md bg-green-600" onPress={handleClose}>
              <Text className="text-white font-bold text-center">{cancelText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
