// lib/nav-receipt/environment.ts
// NAV eNyugta (nyugta-adatszolgáltatás) reporting mode. Mirrors
// lib/nav/environment.ts: demo (default, in-process simulation, zero NAV
// accounts needed) vs test (real NAV eRECEIPT test host) vs production
// (hard-disabled unless NAV_PRODUCTION_ENABLED=true — the same server-side
// kill switch used for NAV Online Számla, not a separate receipt-only flag).
// Unlike test, there is no verified production host at all — see AC2 and
// getReceiptBaseUrl() below.
//
// Test host verified 2026-09-18 against the published XSD/spec — see
// docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md §1.1/§1.2.
import { isNavProductionEnabled } from "@/lib/nav/environment";

export type NavReceiptEnvironment = "demo" | "test" | "production";

export const NAV_RECEIPT_ENVIRONMENTS: NavReceiptEnvironment[] = ["demo", "test", "production"];

export const NAV_RECEIPT_ENVIRONMENT_LABELS: Record<NavReceiptEnvironment, string> = {
  demo: "Demó (nem kell NAV-fiók)",
  test: "NAV teszt",
  production: "Éles",
};

// Demo mode never calls the network — "" is never dereferenced as a URL.
// There is deliberately no production entry: InvoHub has no verified
// production eRECEIPT host, and getReceiptBaseUrl() below refuses to guess
// one (plan §1.2/AC2 — this repo must never call a NAV production endpoint).
const RECEIPT_BASE_URLS: Record<Exclude<NavReceiptEnvironment, "production">, string> = {
  demo: "",
  test: "https://bv-receipt-if.enyugta.nav.gov.hu/v1",
};

export function getReceiptBaseUrl(env: NavReceiptEnvironment): string {
  if (env === "production") {
    throw new Error(
      "NAV eNyugta production host is not verified — InvoHub has no live production credential and must never call one (see CLAUDE.md 'NAV modes')."
    );
  }
  return RECEIPT_BASE_URLS[env];
}

export function isNavReceiptEnvironment(value: unknown): value is NavReceiptEnvironment {
  return value === "demo" || value === "test" || value === "production";
}

/**
 * Parses a stored/requested NAV eNyugta mode. Defaults to "demo" for
 * anything unrecognized, and silently falls back to "demo" for "production"
 * when the server hasn't explicitly enabled it (NAV_PRODUCTION_ENABLED=true)
 * — a hard safety gate, not just a UI hint. This repo has no live production
 * NAV eNyugta credential; production must never be invoked from code or
 * tests (see CLAUDE.md "NAV modes").
 */
export function parseNavReceiptEnvironment(value: string | null | undefined): NavReceiptEnvironment {
  if (value === "production") {
    return isNavProductionEnabled() ? "production" : "demo";
  }
  if (value === "test") return "test";
  return "demo";
}
