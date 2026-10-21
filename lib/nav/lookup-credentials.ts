// lib/nav/lookup-credentials.ts
// The platform's own NAV technical user (DigitalConto Kft.), used ONLY for the
// read-only queryTaxpayer call behind partner lookup when the signed-in
// company has no usable NAV credentials of its own. Configured once by the
// owner in the server environment — never stored in the database, never
// committed. Only the lookup path (lib/company/lookup.ts) ever asks for it, so
// it is never used to report or modify invoices.
import type { NavRealCredentials } from "@/lib/nav/resolve-credentials";

type Env = Record<string, string | undefined>;

export function resolveLookupCredentials(env: Env = process.env): NavRealCredentials | null {
  const login = env.NAV_LOOKUP_LOGIN?.trim();
  const password = env.NAV_LOOKUP_PASSWORD;
  const signKey = env.NAV_LOOKUP_SIGN_KEY;
  const exchangeKey = env.NAV_LOOKUP_CHANGE_KEY;
  const digits = env.NAV_LOOKUP_TAX_NUMBER?.replace(/\D/g, "");
  if (!login || !password || !signKey || !exchangeKey || !digits || digits.length < 8) return null;

  // Real company data only exists in the production NAV; "test" is for trying
  // the wiring against the NAV test environment. Anything else is a typo —
  // refuse rather than guess.
  const rawEnvironment = env.NAV_LOOKUP_ENVIRONMENT?.trim() || "production";
  if (rawEnvironment !== "production" && rawEnvironment !== "test") return null;

  return {
    login,
    password,
    signKey,
    exchangeKey,
    taxNumber: digits.slice(0, 8),
    environment: rawEnvironment,
    source: "shared",
  };
}

export function isPlatformLookupConfigured(env: Env = process.env): boolean {
  return resolveLookupCredentials(env) !== null;
}
