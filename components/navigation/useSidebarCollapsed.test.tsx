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

  it("collapses by default between 701 and 1099px (the 72px rail) and expands from 1100px", () => {
    for (const width of [701, 820, 1099]) {
      (globalThis as any).localStorage.clear();
      const { ref, tree } = renderHook(width);
      expect(ref.current?.collapsed).toBe(true);
      act(() => tree.unmount());
    }

    for (const width of [1100, 1440]) {
      (globalThis as any).localStorage.clear();
      const { ref, tree } = renderHook(width);
      expect(ref.current?.collapsed).toBe(false);
      act(() => tree.unmount());
    }
  });

  it("re-derives the default when the window is resized and nothing was chosen", () => {
    const ref: { current: ReturnType<typeof useSidebarCollapsed> | null } = { current: null };
    function HookHost({ width }: { width: number }) {
      ref.current = useSidebarCollapsed(width);
      return null;
    }
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<HookHost width={1440} />);
    });
    expect(ref.current?.collapsed).toBe(false);
    act(() => tree.update(<HookHost width={820} />));
    expect(ref.current?.collapsed).toBe(true);
    act(() => tree.unmount());
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
    const { ref, tree } = renderHook(820);
    expect(ref.current?.collapsed).toBe(true);
    act(() => ref.current?.toggleCollapsed());
    expect(ref.current?.collapsed).toBe(false);
    act(() => tree.unmount());

    const { ref: remounted, tree: remountedTree } = renderHook(820);
    expect(remounted.current?.collapsed).toBe(false);
    act(() => remountedTree.unmount());
  });
});
