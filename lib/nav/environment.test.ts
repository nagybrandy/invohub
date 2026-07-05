// lib/nav/environment.test.ts
import {
  NAV_API_BASE_URL,
  isNavEnvironment,
  parseNavEnvironment,
} from "@/lib/nav/environment";

describe("nav environment", () => {
  it("parses unknown values as test", () => {
    expect(parseNavEnvironment(undefined)).toBe("test");
    expect(parseNavEnvironment("sandbox")).toBe("test");
  });

  it("parses production", () => {
    expect(parseNavEnvironment("production")).toBe("production");
  });

  it("validates environment union", () => {
    expect(isNavEnvironment("test")).toBe(true);
    expect(isNavEnvironment("production")).toBe(true);
    expect(isNavEnvironment("live")).toBe(false);
  });

  it("maps base URLs per environment", () => {
    expect(NAV_API_BASE_URL.test).toContain("api-test.onlineszamla.nav.gov.hu");
    expect(NAV_API_BASE_URL.production).toContain("api.onlineszamla.nav.gov.hu");
  });
});
