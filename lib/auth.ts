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
import {
  blockUserHardDelete,
  makeClosedAccountSessionGuard,
} from "@/lib/account/auth-guards";
import { isAccountClosed } from "@/lib/account/closure";

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
    // Invoice retention (Áfa tv. 179. §, Számv. tv. 169. § (2)): the user row
    // must never be hard-deleted — every FK from `user` cascades into issued
    // invoices. /delete-user stays disabled (404); if someone ever enables
    // it, beforeDelete still refuses. Account deletion = closeAccount()
    // (lib/account/closure.ts), exposed via the admin API.
    deleteUser: {
      enabled: false,
      beforeDelete: blockUserHardDelete,
    },
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
      // Backstop for any adapter-level user delete (plugins, callbacks).
      delete: {
        before: blockUserHardDelete,
      },
    },
    session: {
      create: {
        // A closed account can never get a new session.
        before: makeClosedAccountSessionGuard(isAccountClosed),
      },
    },
  },
  trustedOrigins: getAuthTrustedOrigins(),
  plugins: [expo()],
});
