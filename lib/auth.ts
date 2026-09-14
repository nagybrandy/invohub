// lib/auth.ts
// Better Auth server instance: Drizzle/Neon adapter, email+password, Expo plugin. Runs inside the Expo API route.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { authUserAdditionalFields } from "@/lib/auth-user-fields";
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
  trustedOrigins: getAuthTrustedOrigins(),
  plugins: [expo()],
});
