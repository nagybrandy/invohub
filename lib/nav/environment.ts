// lib/nav/environment.ts
// NAV Online Számla reporting mode: demo (default, in-process simulator, zero
// NAV accounts needed) vs test (real NAV OSA 3.0 test env) vs production
// (hard-disabled unless NAV_PRODUCTION_ENABLED=true on the server).

export type NavEnvironment = "demo" | "test" | "production";

export const NAV_ENVIRONMENTS: NavEnvironment[] = ["demo", "test", "production"];

export const NAV_ENVIRONMENT_LABELS: Record<NavEnvironment, string> = {
  demo: "Demó (nem kell NAV-fiók)",
  test: "NAV teszt",
  production: "Éles",
};

// Real NAV Online Számla v3.0 endpoints. Demo mode never calls the network.
export const NAV_API_BASE_URL: Record<NavEnvironment, string> = {
  demo: "",
  test: "https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3",
  production: "https://api.onlineszamla.nav.gov.hu/invoiceService/v3",
};

/** Server-side kill switch. Production NAV reporting stays disabled unless explicitly turned on. */
export function isNavProductionEnabled(): boolean {
  return process.env.NAV_PRODUCTION_ENABLED === "true";
}

export function isNavEnvironment(value: unknown): value is NavEnvironment {
  return value === "demo" || value === "test" || value === "production";
}

/**
 * Parses a stored/requested NAV mode. Defaults to "demo" for anything
 * unrecognized, and silently falls back to "demo" for "production" when the
 * server hasn't explicitly enabled it (NAV_PRODUCTION_ENABLED=true) — this is
 * a hard safety gate, not just a UI hint.
 */
export function parseNavEnvironment(value: string | null | undefined): NavEnvironment {
  if (value === "production") {
    return isNavProductionEnabled() ? "production" : "demo";
  }
  if (value === "test") return "test";
  return "demo";
}
