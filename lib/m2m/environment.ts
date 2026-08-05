// lib/m2m/environment.ts
// NAV M2M REST base URLs (Common uses v1.1, business APIs use v1.0).

export type M2mEnvironment = "test" | "production";

export const M2M_ENVIRONMENTS: M2mEnvironment[] = ["test", "production"];

export const M2M_COMMON_BASE_URL: Record<M2mEnvironment, string> = {
  test: "https://m2m-dev.nav.gov.hu/rest-api/1.1",
  production: "https://m2m.nav.gov.hu/rest-api/1.1",
};

export const M2M_BUSINESS_BASE_URL: Record<M2mEnvironment, string> = {
  test: "https://m2m-dev.nav.gov.hu/rest-api/1.0",
  production: "https://m2m.nav.gov.hu/rest-api/1.0",
};

export function parseM2mEnvironment(value: string | undefined): M2mEnvironment {
  return value === "production" ? "production" : "test";
}
