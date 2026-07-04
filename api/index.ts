// api/index.ts
// Vercel serverless entry — delegates all requests to the Expo Router server bundle.
// @ts-nocheck — CommonJS entry; __dirname is provided by the Node runtime.
const path = require("node:path");
const { createRequestHandler } = require("expo-server/adapter/vercel");

module.exports = createRequestHandler({
  build: path.join(__dirname, "../dist/server"),
});
