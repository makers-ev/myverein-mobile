import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';

interface SetupPinModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (pin: string) => void;
}

export default function SetupPinModal({ visible, onClose, onConfirm }: SetupPinModalProps) {
    const { t } = useLanguage();

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const isMatch = pin === confirmPin && pin.length === 4;
    // Derived directly from render-time state instead of mirrored into its
    // own state via an effect -- there is nothing here that isn't already
    // computable from `pin`/`confirmPin` on every render.
    const error = confirmPin.length > 0 && pin !== confirmPin ? t('setup-pin-modal.error-mismatch') : null;

    const handleSave = () => {
        if (isMatch) {
            onConfirm(pin);
            setPin('');
            setConfirmPin('');
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 justify-center items-center bg-black/50"
            >
                <View className="bg-white w-80 p-6 rounded-2xl shadow-xl">
                    <Text className="text-xl font-bold text-center mb-2 text-gray-800">{t('setup-pin-modal.title')}</Text>
                    <Text className="text-sm text-gray-500 text-center mb-6">{t('setup-pin-modal.message')}</Text>

                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-400 mb-1 uppercase">{t('setup-pin-modal.label-new')}</Text>
                        <TextInput
                            className="bg-gray-100 p-3 rounded-lg text-center text-2xl tracking-widest font-bold"
                            keyboardType="numeric"
                            maxLength={4}
                            secureTextEntry
                            value={pin}
                            onChangeText={setPin}
                            placeholder="****"
                        />
                    </View>

                    <View className="mb-2">
                        <Text className="text-xs font-bold text-gray-400 mb-1 uppercase">{t('setup-pin-modal.label-repeat')}</Text>
                        <TextInput
                            className={`bg-gray-100 p-3 rounded-lg text-center text-2xl tracking-widest font-bold ${
                                error ? 'border-2 border-red-500' : ''
                            }`}
                            keyboardType="numeric"
                            maxLength={4}
                            secureTextEntry
                            value={confirmPin}
                            onChangeText={setConfirmPin}
                            placeholder="****"
                        />
                    </View>

                    <View className="h-5 mb-4">
                        {error && <Text className="text-red-500 text-xs text-center">{error}</Text>}
                    </View>

                    <View className="flex-row justify-between">
                        <TouchableOpacity onPress={onClose} className="flex-1 py-3">
                            <Text className="text-center text-gray-500 font-semibold">{t('setup-pin-modal.button-cancel')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!isMatch}
                            className={`flex-1 py-3 rounded-xl ${isMatch ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                            <Text className="text-center text-white font-bold">{t('setup-pin-modal.button-save')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
