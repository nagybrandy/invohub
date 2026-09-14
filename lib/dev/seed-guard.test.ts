// lib/dev/seed-guard.test.ts
import { isDevSeedAllowed } from "@/lib/dev/seed-guard";

describe("isDevSeedAllowed", () => {
  it("denies when ALLOW_DEV_SEED is unset", () => {
    expect(isDevSeedAllowed({})).toBe(false);
  });

  it("denies when ALLOW_DEV_SEED is not exactly 'true'", () => {
    expect(isDevSeedAllowed({ ALLOW_DEV_SEED: "1" })).toBe(false);
    expect(isDevSeedAllowed({ ALLOW_DEV_SEED: "yes" })).toBe(false);
  });

  it("allows when ALLOW_DEV_SEED is 'true' and not production", () => {
    expect(isDevSeedAllowed({ ALLOW_DEV_SEED: "true" })).toBe(true);
    expect(
      isDevSeedAllowed({ ALLOW_DEV_SEED: "true", NODE_ENV: "development" })
    ).toBe(true);
    expect(
      isDevSeedAllowed({ ALLOW_DEV_SEED: "true", VERCEL_ENV: "preview" })
    ).toBe(true);
  });

  it("denies in production even when ALLOW_DEV_SEED is 'true'", () => {
    expect(
      isDevSeedAllowed({ ALLOW_DEV_SEED: "true", NODE_ENV: "production" })
    ).toBe(false);
    expect(
      isDevSeedAllowed({ ALLOW_DEV_SEED: "true", VERCEL_ENV: "production" })
    ).toBe(false);
  });
});
