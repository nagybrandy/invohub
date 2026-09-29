// lib/nav-receipt/environment.test.ts
import { getReceiptBaseUrl, parseNavReceiptEnvironment } from "@/lib/nav-receipt/environment";

describe("getReceiptBaseUrl", () => {
  it("returns the real test host", () => {
    expect(getReceiptBaseUrl("test")).toBe("https://bv-receipt-if.enyugta.nav.gov.hu/v1");
  });

  it("throws for production — InvoHub has no verified production host", () => {
    expect(() => getReceiptBaseUrl("production")).toThrow();
  });

  it("returns an empty string for demo (never dereferenced as a URL)", () => {
    expect(getReceiptBaseUrl("demo")).toBe("");
  });
});

describe("parseNavReceiptEnvironment", () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("defaults to demo for null/undefined/unrecognized values", () => {
    expect(parseNavReceiptEnvironment(null)).toBe("demo");
    expect(parseNavReceiptEnvironment(undefined)).toBe("demo");
    expect(parseNavReceiptEnvironment("staging")).toBe("demo");
    expect(parseNavReceiptEnvironment("")).toBe("demo");
  });

  it("returns test for test", () => {
    expect(parseNavReceiptEnvironment("test")).toBe("test");
  });

  it("downgrades production to demo when NAV_PRODUCTION_ENABLED is not 'true'", () => {
    process.env = { ...ORIGINAL_ENV, NAV_PRODUCTION_ENABLED: undefined };
    expect(parseNavReceiptEnvironment("production")).toBe("demo");

    process.env = { ...ORIGINAL_ENV, NAV_PRODUCTION_ENABLED: "false" };
    expect(parseNavReceiptEnvironment("production")).toBe("demo");
  });

  it("honours production only when NAV_PRODUCTION_ENABLED === 'true'", () => {
    process.env = { ...ORIGINAL_ENV, NAV_PRODUCTION_ENABLED: "true" };
    expect(parseNavReceiptEnvironment("production")).toBe("production");
  });
});
