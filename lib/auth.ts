// lib/auth.ts
// Better Auth server instance: Drizzle/Neon adapter, email+password, Expo plugin. Runs inside the Expo API route.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { expo } from "@better-auth/expo";
import { db } from "@/db";
import { schema } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.EXPO_PUBLIC_AUTH_BASE_URL,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },
  trustedOrigins: ["invohub://", "exp://"],
  plugins: [expo()],
});
