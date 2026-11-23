import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, type TextInputProps } from 'react-native';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { useLanguage } from '@/contexts/translation/LanguageContext';
import { useThemeColors } from '@/theme/colors';

// lucide-react-native icons need a cast under this project's React types (see SignupScreen).
const IconEye = Eye as any;
const IconEyeOff = EyeOff as any;
const IconLock = Lock as any;

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  /** Show a lock icon before the input. */
  showLockIcon?: boolean;
  /** Extra classes for the outer row. */
  containerClassName?: string;
};

/** Password field with a show/hide eye toggle. */
export default function PasswordInput({
  showLockIcon = false,
  containerClassName = '',
  className,
  ...inputProps
}: PasswordInputProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [visible, setVisible] = useState(false);

  return (
    <View
      className={`flex-row items-center bg-card dark:bg-card-dark px-3 min-h-[48px] rounded-control border border-border-control dark:border-border-control-dark ${containerClassName}`}
      style={{ gap: 8 }}
    >
      {showLockIcon ? <IconLock size={18} color={themeColors.mutedForeground} /> : null}
      <TextInput
        className={className ?? 'flex-1 text-[17px] text-foreground dark:text-foreground-dark'}
        placeholderTextColor={themeColors.mutedForeground}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t(visible ? 'password.hide' : 'password.show')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {visible ? (
          <IconEyeOff size={18} color={themeColors.mutedForeground} />
        ) : (
          <IconEye size={18} color={themeColors.mutedForeground} />
        )}
      </TouchableOpacity>
    </View>
  );
}
