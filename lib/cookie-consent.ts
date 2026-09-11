// lib/cookie-consent.ts
// Validates and persists privacy-first cookie choices across native and web.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const COOKIE_CONSENT_STORAGE_KEY = "invohub.cookie-consent.v1";

export type CookieConsent = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function createCookieConsent(
  analytics = false,
  marketing = false,
): CookieConsent {
  return {
    essential: true,
    analytics,
    marketing,
    updatedAt: new Date().toISOString(),
  };
}

export function parseCookieConsent(value: string | null): CookieConsent | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("analytics" in parsed) ||
      !("marketing" in parsed) ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.marketing !== "boolean"
    ) {
      return null;
    }

    return {
      essential: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt:
        "updatedAt" in parsed && typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadCookieConsent(): Promise<CookieConsent | null> {
  return parseCookieConsent(
    await AsyncStorage.getItem(COOKIE_CONSENT_STORAGE_KEY),
  );
}

export async function saveCookieConsent(
  consent: CookieConsent,
): Promise<void> {
  await AsyncStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(consent),
  );
}
