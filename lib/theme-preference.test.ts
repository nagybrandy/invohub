// lib/theme-preference.test.ts
import {
  loadThemePreference,
  saveThemePreference,
} from "@/lib/theme-preference";

describe("theme-preference", () => {
  beforeEach(() => {
    (globalThis as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
  });

  it("returns null when unset", async () => {
    expect(await loadThemePreference()).toBeNull();
  });

  it("persists and loads valid preference", async () => {
    await saveThemePreference("dark");
    expect(await loadThemePreference()).toBe("dark");
  });

  it("ignores invalid stored value", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem("theme-preference", "invalid");
    expect(await loadThemePreference()).toBeNull();
  });
});
