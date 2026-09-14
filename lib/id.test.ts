// lib/id.test.ts
import { createId, createSecureToken } from "@/lib/id";

describe("createId", () => {
  it("generates hyphenated ids", () => {
    jest.spyOn(Date, "now").mockReturnValueOnce(1_700_000_000_000);
    jest.spyOn(Math, "random").mockReturnValueOnce(0.111111111).mockReturnValueOnce(0.222222222);
    const id1 = createId();
    const id2 = createId();
    expect(id1).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
    jest.restoreAllMocks();
  });
});

describe("createSecureToken", () => {
  it("generates long, unpredictable, URL-safe tokens", () => {
    const token1 = createSecureToken();
    const token2 = createSecureToken();

    expect(token1).not.toBe(token2);
    // 32 raw bytes as base64url is 43 chars (no padding).
    expect(token1.length).toBeGreaterThanOrEqual(40);
    expect(token1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("does not depend on Math.random (unlike createId)", () => {
    const randomSpy = jest.spyOn(Math, "random");
    createSecureToken();
    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });
});
