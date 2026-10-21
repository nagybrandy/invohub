import { isM2mDemoCardVisible } from "@/lib/m2m/demo-flag";

describe("isM2mDemoCardVisible", () => {
  it("is off by default and for anything but an explicit true", () => {
    expect(isM2mDemoCardVisible({})).toBe(false);
    expect(isM2mDemoCardVisible({ EXPO_PUBLIC_SHOW_M2M_DEMO: "1" })).toBe(false);
    expect(isM2mDemoCardVisible({ EXPO_PUBLIC_SHOW_M2M_DEMO: "false" })).toBe(false);
  });
  it("turns on with EXPO_PUBLIC_SHOW_M2M_DEMO=true", () => {
    expect(isM2mDemoCardVisible({ EXPO_PUBLIC_SHOW_M2M_DEMO: "true" })).toBe(true);
  });
});
