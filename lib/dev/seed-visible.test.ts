// lib/dev/seed-visible.test.ts
import { isDevSeedButtonVisible } from "@/lib/dev/seed-visible";

describe("isDevSeedButtonVisible — the client-side twin of the server seed guard", () => {
  it("hides the demo-data button (and any copy pointing at it) unless the deploy opts in", () => {
    expect(isDevSeedButtonVisible({})).toBe(false);
    expect(isDevSeedButtonVisible({ EXPO_PUBLIC_ALLOW_DEV_SEED: "1" })).toBe(false);
    expect(isDevSeedButtonVisible({ EXPO_PUBLIC_ALLOW_DEV_SEED: "yes" })).toBe(false);
  });

  it("shows it only for the exact string 'true'", () => {
    expect(isDevSeedButtonVisible({ EXPO_PUBLIC_ALLOW_DEV_SEED: "true" })).toBe(true);
  });
});
