// lib/nav/environment.ts
// NAV Online Számla test vs production environment helpers.

export type NavEnvironment = "test" | "production";

export const NAV_ENVIRONMENTS: NavEnvironment[] = ["test", "production"];

export const NAV_ENVIRONMENT_LABELS: Record<NavEnvironment, string> = {
  test: "Teszt környezet",
  production: "Élő környezet",
};

export const NAV_API_BASE_URL: Record<NavEnvironment, string> = {
  test: "https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3",
  production: "https://api.onlineszamla.nav.gov.hu/invoiceService/v3",
};

export function isNavEnvironment(value: unknown): value is NavEnvironment {
  return value === "test" || value === "production";
}

export function parseNavEnvironment(value: string | null | undefined): NavEnvironment {
  return value === "production" ? "production" : "test";
}
