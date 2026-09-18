import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface InfoModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  titleColor?: string;
  messageColor?: string;
  showCloseIcon?: boolean;
}

export default function InfoModal({
  visible,
  onClose,
  title,
  message,
  titleColor = 'text-black',
  messageColor = 'text-black',
  showCloseIcon = true,
}: InfoModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onPress={onClose}
        activeOpacity={1}
      >
        <View className="bg-white rounded-lg p-5 max-w-xs w-80 relative">
          {showCloseIcon && (
            <TouchableOpacity
              onPress={onClose}
              className="absolute top-2 right-2 p-1"
              accessibilityLabel="Close"
            >
              <Text className="text-gray-500 text-lg">✕</Text>
            </TouchableOpacity>
          )}

          <Text className={`text-lg font-bold text-center mb-4 ${titleColor}`}>{title}</Text>

          {message && (
            <Text className={`text-sm text-center ${messageColor}`}>{message}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
