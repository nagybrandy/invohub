// metro.config.js
// Metro bundler config wired for NativeWind so Tailwind classes work on web + native.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

config.resolver = {
  ...config.resolver,
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    /\/__tests__\/.*/,
    /\.(test|spec)\.(ts|tsx)$/,
  ],
};

config.server = {
  ...config.server,
  unstable_serverExternalModules: [
    ...(config.server?.unstable_serverExternalModules ?? []),
  ],
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  inlineRem: 16,
});
