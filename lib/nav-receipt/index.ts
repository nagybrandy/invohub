// lib/nav-receipt/index.ts
export type {
  DailyReceiptReport,
  NavReceiptAuthToken,
  NavReceiptCredentials,
  NavReceiptEnvironment,
  NavReceiptSubmissionResult,
  ReceiptVatCategoryItem,
} from "./types";

export { authenticate, clearAuthCache } from "./auth";
export {
  isNavReceiptConfigured,
  loadNavReceiptCredentials,
  loadNavReceiptCredentialsFromCompany,
} from "./credentials";
export {
  getReceiptBaseUrl,
  isNavReceiptEnvironment,
  NAV_RECEIPT_ENVIRONMENT_LABELS,
  NAV_RECEIPT_ENVIRONMENTS,
  parseNavReceiptEnvironment,
} from "./environment";
export { parseNavReceiptResponse } from "./response";
export type { NavReceiptResponse } from "./response";
export { submitReceiptDataReport } from "./report";
export { buildReceiptRequestSignature, newAuthRequestId, newServiceRequestId } from "./signature";
export { toTaxpayerId } from "./taxpayer";
export { NAV_VAT_CATEGORIES, toNavVatCategory } from "./vat-category";
export type { NavVatCategory } from "./vat-category";
export { buildAuthTokenXml, buildCreateReceiptXml } from "./xml-builder";
