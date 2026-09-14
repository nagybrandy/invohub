// lib/nav/environment.test.ts
import {
  NAV_API_BASE_URL,
  isNavEnvironment,
  isNavProductionEnabled,
  parseNavEnvironment,
} from "@/lib/nav/environment";

describe("nav environment", () => {
  const originalFlag = process.env.NAV_PRODUCTION_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.NAV_PRODUCTION_ENABLED;
    else process.env.NAV_PRODUCTION_ENABLED = originalFlag;
  });

  it("defaults to demo for unknown or missing values", () => {
    expect(parseNavEnvironment(undefined)).toBe("demo");
    expect(parseNavEnvironment(null)).toBe("demo");
    expect(parseNavEnvironment("sandbox")).toBe("demo");
  });

  it("parses test", () => {
    expect(parseNavEnvironment("test")).toBe("test");
  });

  it("hard-disables production unless NAV_PRODUCTION_ENABLED=true", () => {
    delete process.env.NAV_PRODUCTION_ENABLED;
    expect(parseNavEnvironment("production")).toBe("demo");
    expect(isNavProductionEnabled()).toBe(false);

    process.env.NAV_PRODUCTION_ENABLED = "true";
    expect(parseNavEnvironment("production")).toBe("production");
    expect(isNavProductionEnabled()).toBe(true);
  });

  it("validates the environment union", () => {
    expect(isNavEnvironment("demo")).toBe(true);
    expect(isNavEnvironment("test")).toBe(true);
    expect(isNavEnvironment("production")).toBe(true);
    expect(isNavEnvironment("live")).toBe(false);
  });

  it("maps base URLs per environment", () => {
    expect(NAV_API_BASE_URL.demo).toBe("");
    expect(NAV_API_BASE_URL.test).toContain("api-test.onlineszamla.nav.gov.hu");
    expect(NAV_API_BASE_URL.production).toContain("api.onlineszamla.nav.gov.hu");
  });
});
