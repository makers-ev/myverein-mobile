import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, TouchableOpacity, View } from 'react-native';

import { detectSystemLanguage } from '@/contexts/translation/systemLanguage';

// The boundary sits above LanguageProvider, so it carries its own two texts (device language, English otherwise).
const TEXTS = {
  de: { title: 'Etwas ist schiefgelaufen', body: 'Die App hat einen unerwarteten Fehler gemeldet. Versuche es bitte erneut.', retry: 'Erneut versuchen' },
  en: { title: 'Something went wrong', body: 'The app ran into an unexpected problem. Please try again.', retry: 'Try again' },
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Root error boundary. The old Keycloak template had no top-level boundary
 * at all -- any render-time throw (including one bubbling up from an auth
 * call) crashed the whole app with a blank/red screen and no recovery path.
 * This catches that class of error and offers a manual reset instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In a production app this is where a crash reporter (e.g. Sentry)
    // would be wired in. Kept as a plain console.error to avoid pulling in
    // an unconfigured reporting dependency.
    console.error('[ErrorBoundary] Unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const texts = detectSystemLanguage() === 'de' ? TEXTS.de : TEXTS.en;

    if (error) {
      return (
        <SafeAreaView className="flex-1 bg-muted dark:bg-muted-dark">
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-xl font-bold mb-2 text-foreground dark:text-foreground-dark">{texts.title}</Text>
            <Text className="text-sm text-center mb-6 text-muted-foreground dark:text-muted-foreground-dark">
              {texts.body}
            </Text>
            <TouchableOpacity
              className="bg-primary dark:bg-primary-dark py-3 px-6 rounded-lg"
              onPress={this.handleReset}
              accessibilityRole="button"
            >
              <Text className="text-primary-foreground dark:text-primary-foreground-dark font-semibold text-base">{texts.retry}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}
