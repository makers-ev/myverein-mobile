import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'MyVerein',
  slug: 'myverein',
  scheme: 'myverein://',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.myverein.app',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#2c4870',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.myverein.app',
    googleServicesFile: './google-services.json',
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-secure-store',
    'expo-web-browser',
    'expo-localization',
    'expo-notifications',
    [
      'expo-image-picker',
      {
        photosPermission:
          'MyVerein needs access to your photos so you can choose a profile photo. It is also used for photos in damage reports, for membership applications (profile photo, attached photos) and proof documents when founding a club.',
        cameraPermission:
          'MyVerein needs access to the camera so you can take a photo for your profile or a membership application.',
        microphonePermission: false,
      },
    ],
  ],
  locales: {
    de: './locales/de.json',
    en: './locales/en.json',
  },
  extra: {
    description: 'MyVerein ist die Vereinsverwaltung für Mitglieder, Vorstand und externe Kontakte.',
    author: 'LPJ IT-Solutions',
    authorUrl: 'https://github.com/lpj-app',
    primaryColor: '#2c4870',
    defaultLanguage: 'de',
    eas: {
      projectId: '78adc05b-f80e-4386-95dc-b4f214baf331',
    },
  },
  owner: 'thereallpj',
} satisfies ExpoConfig;

export default config;
