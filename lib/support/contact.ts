// lib/support/contact.ts
// Pure helpers behind the dashboard's "Ügyfélszolgálat" (customer service)
// overflow item. There is no monitored support mailbox hardcoded anywhere
// in this repo — same discipline as never hardcoding a tax figure nobody
// has verified. The owner configures EXPO_PUBLIC_SUPPORT_EMAIL once it's a
// real, monitored inbox; until then, callers must hide the support UI
// entirely rather than invent or guess an address.
import Constants from "expo-constants";

/** Env var holding the monitored support mailbox. Unset → no support UI. */
export const SUPPORT_EMAIL_ENV = "EXPO_PUBLIC_SUPPORT_EMAIL";

/**
 * Trimmed address, or null when unset/blank/not a plausible address. Never
 * falls back to a default — the caller must hide the support control when
 * this returns null.
 *
 * The default value below reads `process.env.EXPO_PUBLIC_SUPPORT_EMAIL` as a
 * literal, static member expression (`process.env.<LITERAL_KEY>`) rather
 * than a variable-aliased bracket lookup (`process.env[SUPPORT_EMAIL_ENV]`
 * or `someVar[SUPPORT_EMAIL_ENV]`). babel-preset-expo's inline-env-vars
 * plugin (node_modules/babel-preset-expo/build/plugins/inline-env-vars.js)
 * only recognizes and inlines that exact literal pattern — a bracket lookup
 * through a local variable is invisible to it, so this value would always
 * be `undefined` in an actual Metro/EAS-bundled app (web or native) even
 * though it works fine under plain Node (e.g. in Jest). Do not reintroduce
 * the bracket-through-a-variable form here.
 */
export function getSupportEmail(
  env: Partial<NodeJS.ProcessEnv> = { EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL }
): string | null {
  const raw = env[SUPPORT_EMAIL_ENV];
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (/\s/.test(trimmed)) return null;

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return null;
  if (atIndex !== trimmed.lastIndexOf("@")) return null;
  if (atIndex === trimmed.length - 1) return null;

  return trimmed;
}

export type SupportDiagnostics = {
  locale: string;
  platform: string;
  appVersion: string;
};

/**
 * A short technical block for the prefilled mail body — never personal
 * data. The parameter type above is the enforcement: it has no field that
 * could carry an email, a name or a tax number, so this function cannot
 * leak one no matter how it's called.
 */
export function buildSupportDiagnostics({ locale, platform, appVersion }: SupportDiagnostics): string {
  return `Locale: ${locale}\nPlatform: ${platform}\nApp: ${appVersion}`;
}

/**
 * Builds a mailto: URL. Uses encodeURIComponent (not URLSearchParams) on
 * subject/body — URLSearchParams encodes spaces as "+", which several mail
 * clients render literally inside a mailto subject/body instead of
 * decoding it back to a space.
 */
export function buildSupportMailtoUrl({
  email,
  subject,
  body,
}: {
  email: string;
  subject: string;
  body: string;
}): string {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`].join("&");
  return `mailto:${email}?${params}`;
}

/** Constants.expoConfig?.version ?? "unknown" — the only impure export. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}
