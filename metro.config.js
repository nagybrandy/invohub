// metro.config.js
// Metro bundler config wired for NativeWind so Tailwind classes work on web + native.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});
