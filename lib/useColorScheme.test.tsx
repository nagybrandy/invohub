// lib/useColorScheme.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockNativewind = {
  colorScheme: "light" as "light" | "dark",
  setColorScheme: jest.fn(),
  toggleColorScheme: jest.fn(),
};
jest.mock("nativewind", () => ({ useColorScheme: () => mockNativewind }));

// The platform's own report (prefers-color-scheme on web). Web is the
// platform under test: it is where "system" must never reach nativewind.
const mockPlatform = { os: "web", system: "dark" as "light" | "dark" | null };
jest.mock("@/lib/theme/system-scheme", () => ({
  useSystemColorScheme: () => mockPlatform.system,
  isWebPlatform: () => mockPlatform.os === "web",
}));

import { loadThemePreference, saveThemePreference } from "@/lib/theme-preference";
import { resetThemePreferenceStoreForTests } from "@/lib/theme/preference-store";

import { useColorScheme } from "@/lib/useColorScheme";

async function renderHook() {
  const ref: { current: ReturnType<typeof useColorScheme> | null } = { current: null };
  function HookHost() {
    ref.current = useColorScheme();
    return null;
  }
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    root = TestRenderer.create(<HookHost />);
    await Promise.resolve();
    await Promise.resolve();
  });
  const rerender = () => act(async () => { root.update(<HookHost />); });
  return { ref, rerender };
}

beforeEach(() => {
  (globalThis as { __clearAsyncStorage?: () => void }).__clearAsyncStorage?.();
  resetThemePreferenceStoreForTests();
  mockNativewind.setColorScheme.mockClear();
  mockNativewind.colorScheme = "light";
  mockPlatform.os = "web";
  mockPlatform.system = "dark";
});

describe("useColorScheme on web — the OS decides unless the user chose otherwise", () => {
  it("resolves 'nothing stored' from the OS and hands nativewind the concrete scheme, never 'system'", async () => {
    const { ref } = await renderHook();
    expect(ref.current!.loaded).toBe(true);
    expect(ref.current!.preference).toBe("system");
    expect(ref.current!.colorScheme).toBe("dark");
    expect(ref.current!.isDarkColorScheme).toBe(true);
    expect(mockNativewind.setColorScheme).toHaveBeenLastCalledWith("dark");
    expect(mockNativewind.setColorScheme).not.toHaveBeenCalledWith("system");
  });

  it("follows an OS change live while the preference is 'system'", async () => {
    const { ref, rerender } = await renderHook();
    mockPlatform.system = "light";
    await rerender();
    expect(ref.current!.colorScheme).toBe("light");
    expect(mockNativewind.setColorScheme).toHaveBeenLastCalledWith("light");
  });

  it("applies a stored explicit choice over a contrary OS setting", async () => {
    await saveThemePreference("light");
    const { ref } = await renderHook();
    expect(ref.current!.preference).toBe("light");
    expect(ref.current!.colorScheme).toBe("light");
    expect(mockNativewind.setColorScheme).toHaveBeenLastCalledWith("light");
  });

  it("cycleTheme walks system → light → dark → system and persists every step", async () => {
    const { ref } = await renderHook();
    await act(async () => { await ref.current!.cycleTheme(); });
    expect(ref.current!.preference).toBe("light");
    expect(await loadThemePreference()).toBe("light");
    await act(async () => { await ref.current!.cycleTheme(); });
    expect(ref.current!.preference).toBe("dark");
    expect(ref.current!.colorScheme).toBe("dark");
    await act(async () => { await ref.current!.cycleTheme(); });
    expect(ref.current!.preference).toBe("system");
    expect(await loadThemePreference()).toBe("system");
    // back on "system" under a dark OS: dark again, and still never the word "system"
    expect(ref.current!.colorScheme).toBe("dark");
    expect(mockNativewind.setColorScheme).not.toHaveBeenCalledWith("system");
  });
});

describe("useColorScheme — one preference for every caller", () => {
  it("a change made through one hook instance is seen by another (layout vs Settings)", async () => {
    const layout = await renderHook();
    const settings = await renderHook();
    await act(async () => { await settings.ref.current!.cycleTheme(); });
    expect(settings.ref.current!.preference).toBe("light");
    expect(layout.ref.current!.preference).toBe("light");
    expect(layout.ref.current!.colorScheme).toBe("light");
  });
});

describe("useColorScheme on native — nativewind owns the Appearance override", () => {
  it("passes 'system' through so nativewind clears its override, and reads the result back from it", async () => {
    mockPlatform.os = "ios";
    mockNativewind.colorScheme = "dark";
    const { ref } = await renderHook();
    expect(mockNativewind.setColorScheme).toHaveBeenLastCalledWith("system");
    expect(ref.current!.isDarkColorScheme).toBe(true);
  });
});
