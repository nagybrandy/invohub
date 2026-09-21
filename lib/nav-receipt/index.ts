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
export {
  IN_FLIGHT_THRESHOLD_MS,
  MAX_SUBMISSIONS_PER_RUN,
  RECEIPT_REPORT_BACKFILL_DAYS,
  runDailyReceiptReports,
} from "./daily-report-run";
export type {
  DailyReceiptReportResultEntry,
  DailyReceiptReportResultStatus,
  DailyReceiptReportRunResult,
} from "./daily-report-run";
export { getReceiptBaseUrl, resolveReceiptEnvironment } from "./environment";
export { queryReceiptReport, registerReceiptSoftware, submitDailyReceiptReport } from "./report";
export {
  buildAuthenticateXml,
  buildReceiptDataReportXml,
  buildSoftwareRegistrationXml,
} from "./xml-builder";
