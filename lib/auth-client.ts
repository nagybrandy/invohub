// lib/auth-client.ts
// Better Auth client shared by web + native. On native, sessions are stored in expo-secure-store.
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_AUTH_BASE_URL ?? "http://localhost:8081",
  plugins: [
    expoClient({
      scheme: "invohub",
      storagePrefix: "invohub",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
