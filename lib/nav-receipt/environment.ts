// lib/nav-receipt/environment.ts
import type { NavReceiptEnvironment } from "./types";

const RECEIPT_BASE_URLS: Record<NavReceiptEnvironment, string> = {
  test: "https://api-test.onlineszamla.nav.gov.hu/receipt-if/v1",
  production: "https://api.onlineszamla.nav.gov.hu/receipt-if/v1",
};

export function getReceiptBaseUrl(env: NavReceiptEnvironment): string {
  return RECEIPT_BASE_URLS[env];
}

export function resolveReceiptEnvironment(): NavReceiptEnvironment {
  const envVar = process.env.NAV_RECEIPT_ENV;
  if (envVar === "production") return "production";
  return "test";
}
