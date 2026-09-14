// lib/auth-client.ts
// Better Auth client shared by web + native. On native, sessions are stored in expo-secure-store.
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { getClientAuthBaseURL } from "@/lib/auth-url";
import { authUserAdditionalFields } from "@/lib/auth-user-fields";

export const authClient = createAuthClient({
  baseURL: getClientAuthBaseURL(),
  plugins: [
    // Types signUp.email()/updateUser() against the server's user
    // additionalFields (e.g. `signupRole`). Built from the plain
    // lib/auth-user-fields.ts object, NOT `typeof auth` — importing the
    // server auth instance here would pull the Drizzle/Neon adapter (and
    // `@/db`) into the client bundle.
    inferAdditionalFields({ user: authUserAdditionalFields }),
    expoClient({
      scheme: "invohub",
      storagePrefix: "invohub",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
