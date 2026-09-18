const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Wires Metro to run `input.css` through Tailwind and hands the resulting
// styles to the babel-time `className` -> style transform (see
// babel.config.js). This -- plus the babel plugin -- is the missing half of
// the NativeWind setup; without it `className` props were silently inert.
module.exports = withNativeWind(config, { input: './input.css' });
