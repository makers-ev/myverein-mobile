// NativeWind v4 requires its own JSX import source + a dedicated babel
// plugin (`nativewind/babel`) to turn `className` into RN styles at build
// time -- without this file, `className` props are inert (React Native
// doesn't know what to do with them, they're just ignored), which is why
// NativeWind was "installed but unused" before this file existed.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // react-native-reanimated/react-native-worklets are real dependencies
      // now (react-native-keyboard-controller's KeyboardAwareScrollView, see
      // KeyboardAwareScreen.tsx) -- babel-preset-expo auto-adds the
      // worklets babel plugin when it finds the package, no manual wiring.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
