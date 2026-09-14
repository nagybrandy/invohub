// lib/api/rate-limit.test.ts
import { checkRateLimit, clientIpFromHeaders, resetRateLimitsForTests } from "@/lib/api/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests under the limit", () => {
    const first = checkRateLimit("k1", 3, 60_000);
    const second = checkRateLimit("k1", 3, 60_000);
    const third = checkRateLimit("k1", 3, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);
  });

  it("blocks once the limit is exceeded within the window", () => {
    checkRateLimit("k2", 2, 60_000);
    checkRateLimit("k2", 2, 60_000);
    const blocked = checkRateLimit("k2", 2, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate buckets per key", () => {
    checkRateLimit("k3-a", 1, 60_000);
    const other = checkRateLimit("k3-b", 1, 60_000);

    expect(other.allowed).toBe(true);
  });

  it("resets once the window elapses", () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000_000);
    checkRateLimit("k4", 1, 1_000);
    const blocked = checkRateLimit("k4", 1, 1_000);
    expect(blocked.allowed).toBe(false);

    nowSpy.mockReturnValue(1_002_000);
    const afterWindow = checkRateLimit("k4", 1, 1_000);
    expect(afterWindow.allowed).toBe(true);

    nowSpy.mockRestore();
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.4");
  });

  it("falls back to a shared 'unknown' key when neither header is present", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
