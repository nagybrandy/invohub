// lib/ui/use-measured-width.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { LayoutChangeEvent } from "react-native";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

function layout(width: number): LayoutChangeEvent {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height: 100 } } } as LayoutChangeEvent;
}

function renderHook() {
  const ref: { current: ReturnType<typeof useMeasuredWidth> | null } = { current: null };
  function Host() {
    ref.current = useMeasuredWidth();
    return null;
  }
  act(() => {
    TestRenderer.create(<Host />);
  });
  return { ref };
}

describe("useMeasuredWidth", () => {
  it("is 0 and unmeasured until the first layout", () => {
    const { ref } = renderHook();
    expect(ref.current!.width).toBe(0);
    expect(ref.current!.measured).toBe(false);
  });

  it("reports the width from a layout event", () => {
    const { ref } = renderHook();
    act(() => ref.current!.onLayout(layout(812.4)));
    expect(ref.current!.width).toBe(812);
    expect(ref.current!.measured).toBe(true);
  });

  it("keeps the same width for an identical layout and follows later ones", () => {
    const { ref } = renderHook();
    act(() => ref.current!.onLayout(layout(900)));
    act(() => ref.current!.onLayout(layout(900.2)));
    expect(ref.current!.width).toBe(900);
    act(() => ref.current!.onLayout(layout(640)));
    expect(ref.current!.width).toBe(640);
  });
});
