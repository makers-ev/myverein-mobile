import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface Button {
  text: string;
  onPress: () => void;
  color: string;
}

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  buttons?: Button[];
  titleColor?: string;
  messageColor?: string;
}

export default function ConfirmationModal({
  visible,
  onClose,
  title,
  message,
  buttons = [],
  titleColor = 'text-black',
  messageColor = 'text-black',
}: ConfirmationModalProps) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 justify-center items-center bg-black bg-opacity-50"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onPress={onClose}
        activeOpacity={1}
      >
        <View className="bg-white rounded-lg p-5 max-w-xs">
          <Text className={`text-lg font-bold text-center mb-4 ${titleColor}`}>
            {title}
          </Text>
          {message && (
            <Text className={`text-sm text-center mb-4 ${messageColor}`}>
              {message}
            </Text>
          )}
          {buttons.length > 0 && (
            <View className="flex-row justify-around">
              {buttons.slice(0, 2).map((button, index) => (
                <TouchableOpacity
                  key={index}
                  className={`py-2 px-4 rounded-md ${button.color}`}
                  onPress={button.onPress}
                >
                  <Text className="text-white font-bold text-center">
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
