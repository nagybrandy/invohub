// lib/auth-client.ts
// Better Auth client shared by web + native. On native, sessions are stored in expo-secure-store.
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { getClientAuthBaseURL } from "@/lib/auth-url";

export const authClient = createAuthClient({
  baseURL: getClientAuthBaseURL(),
  plugins: [
    expoClient({
      scheme: "invohub",
      storagePrefix: "invohub",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
