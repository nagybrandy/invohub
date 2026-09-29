// lib/nav-receipt/types.ts
// Shapes for the NAV eRECEIPT (nyugta-adatszolgáltatás) client, matching the
// published XSD (xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.1.xsd) —
// see docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md §1.1 for sourcing.
import type { NavVatCategory } from "./vat-category";

export type { NavReceiptEnvironment } from "./environment";

export type NavReceiptCredentials = {
  technicalUser: string;
  technicalPassword: string;
  signingKey: string;
  taxNumber: string;
};

export type NavReceiptAuthToken = {
  token: string;
  expiresAt: Date;
};

// The published NAV vat-category name list (spec §5.9 sample). Defined in
// lib/nav-receipt/vat-category.ts (NAV_VAT_CATEGORIES) — see plan §9 "Out of
// scope" and OQ-1 in plan §8 for the unverified-name caveat.
export type { NavVatCategory } from "./vat-category";

export type ReceiptVatCategoryItem = {
  vat: NavVatCategory;
  /** Gross sum of non-modifying (sale) receipt lines in this category. May be 0, never negative. */
  saleDocument: number;
  /** Gross sum of modifying (storno/helyesbítő) receipt lines in this category. May be negative. */
  modifyingDocument: number;
};

/**
 * One `CreateReceiptRequest` business document — one NAV report per
 * currency per day (spec §2.1.4: `currency` is per-report).
 */
export type DailyReceiptReport = {
  taxPayerId: string;
  issuingSoftwareName: string;
  /** yyyy-MM-dd, must not be in the future. */
  applicableDate: string;
  /** First receipt number of the reported range. */
  serialNumber: string;
  currency: string;
  /** null (HUF) is rendered as `xsi:nil="true"`; otherwise a number, max 4 decimals. */
  exchangeRate: number | null;
  vatCategoryItems: ReceiptVatCategoryItem[];
  /** Sum of all categories' gross (saleDocument + modifyingDocument), max 2 decimals. */
  total: number;
  numberOfSaleDocument: number;
  numberOfModifyingDocument: number;
};

export type NavReceiptSubmissionResult = {
  ok: boolean;
  /** NAV-issued id, shape `[0-9]{8}_[0-9]{8}_[0-9]+` (e.g. `12345678_20260712_3`). */
  reportId?: string;
  error?: string;
};
