// lib/theme/preference-store.ts
// One process-wide theme preference shared by every useColorScheme() caller.
// The root layout, Settings and the icon-colour hook each mount the hook; if
// each kept its own copy, the Settings tile would change its own state while
// the layout (which owns the provider) kept rendering the old scheme.
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/lib/theme-preference";

type Listener = () => void;

// null = not loaded from storage yet.
let current: ThemePreference | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getThemePreference(): ThemePreference | null {
  return current;
}

export function subscribeThemePreference(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ensureThemePreferenceLoaded(): Promise<void> {
  if (!loading) {
    loading = loadThemePreference().then((stored) => {
      current = stored ?? "system";
      emit();
    });
  }
  return loading;
}

export async function updateThemePreference(pref: ThemePreference): Promise<void> {
  await saveThemePreference(pref);
  current = pref;
  emit();
}

export function resetThemePreferenceStoreForTests(): void {
  current = null;
  loading = null;
  listeners.clear();
}
