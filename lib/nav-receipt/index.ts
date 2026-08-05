// lib/nav-receipt/index.ts
export type {
  DailyReceiptReport,
  NavReceiptAuthToken,
  NavReceiptCredentials,
  NavReceiptEnvironment,
  NavReceiptSubmissionResult,
  SoftwareRegistrationResult,
  VatRateAggregation,
} from "./types";

export { authenticate, clearAuthCache } from "./auth";
export {
  isNavReceiptConfigured,
  loadNavReceiptCredentials,
  loadNavReceiptCredentialsFromCompany,
} from "./credentials";
export { getReceiptBaseUrl, resolveReceiptEnvironment } from "./environment";
export { queryReceiptReport, registerReceiptSoftware, submitDailyReceiptReport } from "./report";
export {
  buildAuthenticateXml,
  buildReceiptDataReportXml,
  buildSoftwareRegistrationXml,
} from "./xml-builder";
