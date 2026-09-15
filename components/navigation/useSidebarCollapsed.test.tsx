// components/navigation/useSidebarCollapsed.test.tsx
import * as React from "react";
import { Platform } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { useSidebarCollapsed } from "@/components/navigation/useSidebarCollapsed";

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

function renderHook(width: number) {
  const ref: { current: ReturnType<typeof useSidebarCollapsed> | null } = { current: null };

  function HookHost({ width: w }: { width: number }) {
    ref.current = useSidebarCollapsed(w);
    return null;
  }

  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<HookHost width={width} />);
  });
  return { ref, tree };
}

describe("useSidebarCollapsed", () => {
  const originalPlatform = Platform.OS;
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    Platform.OS = "web";
    (globalThis as any).localStorage = makeLocalStorage();
    (globalThis.window as any).localStorage = (globalThis as any).localStorage;
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    (globalThis as any).localStorage = originalLocalStorage;
    delete (globalThis.window as any).localStorage;
  });

  it("collapses by default between 1024 and 1279px and expands at 1280px+", () => {
    const { ref: narrow, tree: narrowTree } = renderHook(1100);
    expect(narrow.current?.collapsed).toBe(true);
    act(() => narrowTree.unmount());

    (globalThis as any).localStorage.clear();
    const { ref: wide, tree: wideTree } = renderHook(1400);
    expect(wide.current?.collapsed).toBe(false);
    act(() => wideTree.unmount());
  });

  it("toggles the collapsed state", () => {
    const { ref, tree } = renderHook(1400);
    expect(ref.current?.collapsed).toBe(false);
    act(() => ref.current?.toggleCollapsed());
    expect(ref.current?.collapsed).toBe(true);
    act(() => ref.current?.toggleCollapsed());
    expect(ref.current?.collapsed).toBe(false);
    act(() => tree.unmount());
  });

  it("persists an explicit toggle across remounts (localStorage)", () => {
    const { ref, tree } = renderHook(1400);
    act(() => ref.current?.toggleCollapsed());
    expect(ref.current?.collapsed).toBe(true);
    act(() => tree.unmount());

    const { ref: remounted, tree: remountedTree } = renderHook(1400);
    expect(remounted.current?.collapsed).toBe(true);
    act(() => remountedTree.unmount());
  });

  it("keeps the explicit choice even when the width-based default would differ", () => {
    const { ref, tree } = renderHook(1100);
    expect(ref.current?.collapsed).toBe(true);
    act(() => ref.current?.toggleCollapsed());
    expect(ref.current?.collapsed).toBe(false);
    act(() => tree.unmount());

    const { ref: remounted, tree: remountedTree } = renderHook(1100);
    expect(remounted.current?.collapsed).toBe(false);
    act(() => remountedTree.unmount());
  });
});
