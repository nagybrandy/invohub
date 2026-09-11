// lib/i18n/language.ts
// App language preference: HU/EN with AsyncStorage persistence.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const LANGUAGE_STORAGE_KEY = "invohub.language";

export const APP_LANGUAGES = [
  { code: "hu", label: "Magyar", shortLabel: "HU" },
  { code: "en", label: "English", shortLabel: "EN" },
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number]["code"];

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "hu" || value === "en";
}

/** Lazy require avoids a circular import with `lib/i18n/index.ts` at module load. */
function getI18n() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- circular-dep guard
  return require("@/lib/i18n").default as {
    language: string;
    changeLanguage: (lng: string) => Promise<unknown>;
  };
}

export async function loadStoredLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(stored)) {
      return stored;
    }
  } catch {
    // Fall through to default when storage is unavailable.
  }
  return "hu";
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  const i18n = getI18n();
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
}

export async function hydrateAppLanguage(): Promise<AppLanguage> {
  const language = await loadStoredLanguage();
  const i18n = getI18n();
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }
  return language;
}
