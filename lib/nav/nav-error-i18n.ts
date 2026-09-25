// lib/nav/nav-error-i18n.ts
// Maps the machine-readable `code` the NAV and M2M routes answer with to the
// i18n key holding the Hungarian/English copy — the same split
// lib/invoices/send-error-i18n.ts uses for invoice e-mail failures.
//
// The routes keep an English `error`/`message` string for server logs and for
// the public app/api/v1/* consumers, but the UI must never render it: a
// server string can't follow the user's language, and these routes used to
// answer in Hungarian regardless of who was asking.

export const NAV_RESULT_I18N_KEY: Record<string, string> = {
  // connection check (app/api/nav/check)
  demoAvailable: "company.navTestSection.checkDemoAvailable",
  sharedTestAccountConnected: "company.navTestSection.checkSharedTestOk",
  productionConnected: "company.navTestSection.checkProductionOk",
  testConnected: "company.navTestSection.checkTestOk",
  credentialsMissing: "company.navTestSection.checkCredentialsMissing",
  checkFailed: "company.navTestSection.checkFailed",

  // submission (app/api/nav/submit, lib/nav/submission-guard)
  draftNotSubmittable: "invoices.nav.draftNotSubmittable",
  proformaNotSubmittable: "invoices.nav.proformaNotSubmittable",
  missingExchangeRate: "invoices.nav.missingExchangeRate",
  navSubmitFailed: "invoices.nav.submitFailed",

  // status (app/api/nav/status)
  noSubmission: "invoices.nav.noSubmission",
  statusQueryFailed: "invoices.nav.refreshFailed",

  // M2M + receipts
  productionNotEnabled: "company.navTestSection.productionNotEnabled",
  m2mDemoAvailable: "company.navTestSection.m2mDemoAvailable",
  m2mTestConnected: "company.navTestSection.m2mTestOk",
  receiptAlreadySubmitted: "receipts.navAlreadySubmitted",
};

/**
 * The key to render for a code, with a fallback for codes this build doesn't
 * know yet — a newer server must never leave the UI showing a raw string.
 */
export function navResultI18nKey(
  code: string | undefined | null,
  fallback = "invoices.nav.submitFailed"
): string {
  if (!code) return fallback;
  return NAV_RESULT_I18N_KEY[code] ?? fallback;
}
