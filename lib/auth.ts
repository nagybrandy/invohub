// lib/auth.ts
// Better Auth server instance: Drizzle/Neon adapter, email+password, Expo plugin. Runs inside the Expo API route.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { authUserAdditionalFields } from "@/lib/auth-user-fields";
import { resolveSignupRole } from "@/lib/auth-signup-role";
import { getAuthTrustedOrigins } from "@/lib/auth-trusted-origins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  // When unset, Better Auth derives the origin from each request (localhost in dev, deployed URL in prod).
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: authUserAdditionalFields,
  },
  databaseHooks: {
    user: {
      create: {
        // The ONLY place `role` is ever set from client input. `signupRole`
        // is client-suppliable (see lib/auth-user-fields.ts), but is clamped
        // to "entrepreneur" | "accountant" here before it can touch `role` —
        // so a signup payload can never set role:"admin", even though the
        // picker on the signup screen now works again.
        before: async (user) => {
          const resolved = resolveSignupRole((user as { signupRole?: unknown }).signupRole);
          return { data: { ...user, role: resolved, signupRole: resolved } };
        },
      },
    },
  },
  trustedOrigins: getAuthTrustedOrigins(),
  plugins: [expo()],
});
