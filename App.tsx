import './input.css';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { colorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LanguageProvider } from './src/contexts/translation/LanguageContext';
import { PaletteProvider } from './src/theme/PaletteProvider';
import { AuthProvider } from './src/auth/AuthProvider';
import { ErrorBoundary } from './src/error/ErrorBoundary';
import AppNavigator from './src/navigation/AppNavigator';
import { getStoredTheme } from './src/theme/themePreferenceStorage';

export default function App() {
  useEffect(() => {
    // nativewind's colorScheme override doesn't persist itself.
    getStoredTheme().then((stored) => {
      if (stored) colorScheme.set(stored);
    });
  }, []);

  return (
    <ErrorBoundary>
      {/* Required by react-native-gesture-handler (PaletteCustomEditor.tsx's
          color picker) -- must wrap everything, not just the screen that uses it. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Navbar.tsx's useSafeAreaInsets() throws without this. */}
        <SafeAreaProvider>
          {/* Required by KeyboardAwareScreen.tsx's KeyboardAwareScrollView. */}
          <KeyboardProvider>
            <PaletteProvider>
              <LanguageProvider>
                <AuthProvider>
                  {/* Bar background can't be set here in Expo Go (edge-to-edge
                      limitation, github.com/expo/expo/issues/36814) -- it comes
                      from AppNavigator.tsx's contentStyle + NavigationContainer
                      theme instead. */}
                  <StatusBar style="auto" />
                  <NavigationBar style="auto" />
                  <AppNavigator />
                </AuthProvider>
              </LanguageProvider>
            </PaletteProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
