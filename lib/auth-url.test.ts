// lib/auth-url.test.ts
import { getAuthBaseUrl, getClientAuthBaseURL } from "@/lib/auth-url";

describe("auth-url", () => {
  const originalEnv = process.env.EXPO_PUBLIC_AUTH_BASE_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_AUTH_BASE_URL = originalEnv;
  });

  it("falls back to localhost when window is unavailable", () => {
    delete process.env.EXPO_PUBLIC_AUTH_BASE_URL;
    expect(getClientAuthBaseURL()).toMatch(/localhost:8081/);
  });

  it("getAuthBaseUrl delegates to client base URL", () => {
    process.env.EXPO_PUBLIC_AUTH_BASE_URL = "http://example.test";
    expect(getAuthBaseUrl()).toBe("http://example.test");
  });
});
