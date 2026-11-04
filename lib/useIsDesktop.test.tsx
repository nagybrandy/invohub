// lib/useIsDesktop.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockDims = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 900, scale: 1, fontScale: 1 }),
}));

import { DESKTOP_BREAKPOINT, useBreakpoint, useIsDesktop } from "@/lib/useIsDesktop";

function read<T>(hook: () => T): T {
  const ref: { current: T | null } = { current: null };
  function Host() {
    ref.current = hook();
    return null;
  }
  act(() => {
    TestRenderer.create(<Host />);
  });
  return ref.current as T;
}

describe("useIsDesktop / useBreakpoint", () => {
  it("threshold is 701: the sidebar shell starts one pixel above the phone max", () => {
    expect(DESKTOP_BREAKPOINT).toBe(701);
    mockDims.width = 700;
    expect(read(useIsDesktop)).toBe(false);
    mockDims.width = 701;
    expect(read(useIsDesktop)).toBe(true);
  });

  it("classifies phone / tablet / wide", () => {
    mockDims.width = 375;
    expect(read(useBreakpoint)).toBe("phone");
    mockDims.width = 820;
    expect(read(useBreakpoint)).toBe("tablet");
    mockDims.width = 1100;
    expect(read(useBreakpoint)).toBe("wide");
  });
});
