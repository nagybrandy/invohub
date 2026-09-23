// lib/nav-receipt/credentials.ts
import { decryptNavSecretOrPassthrough } from "@/lib/nav/credentials";
import type { NavReceiptCredentials } from "./types";

export function isNavReceiptConfigured(): boolean {
  return !!(
    process.env.NAV_RECEIPT_TECH_USER &&
    process.env.NAV_RECEIPT_TECH_PASS &&
    process.env.NAV_RECEIPT_SIGN_KEY &&
    process.env.NAV_RECEIPT_TAX_NUMBER
  );
}

export function loadNavReceiptCredentials(): NavReceiptCredentials {
  const technicalUser = process.env.NAV_RECEIPT_TECH_USER?.trim();
  const technicalPassword = process.env.NAV_RECEIPT_TECH_PASS?.trim();
  const signingKey = process.env.NAV_RECEIPT_SIGN_KEY?.trim();
  const taxNumber = process.env.NAV_RECEIPT_TAX_NUMBER?.trim();

  if (!technicalUser || !technicalPassword || !signingKey || !taxNumber) {
    throw new Error(
      "NAV receipt credentials not configured. Set NAV_RECEIPT_TECH_USER, NAV_RECEIPT_TECH_PASS, NAV_RECEIPT_SIGN_KEY, NAV_RECEIPT_TAX_NUMBER."
    );
  }

  return { technicalUser, technicalPassword, signingKey, taxNumber };
}

export function loadNavReceiptCredentialsFromCompany(company: {
  navTechnicalUser: string | null;
  navTechnicalPassword: string | null;
  navXmlSignKey: string | null;
  taxNumber: string | null;
}): NavReceiptCredentials | null {
  if (
    !company.navTechnicalUser ||
    !company.navTechnicalPassword ||
    !company.navXmlSignKey ||
    !company.taxNumber
  ) {
    return null;
  }
  return {
    technicalUser: company.navTechnicalUser,
    // Stored sealed (lib/nav/credentials.ts) — opened only here, for the request.
    technicalPassword: decryptNavSecretOrPassthrough(company.navTechnicalPassword)!,
    signingKey: decryptNavSecretOrPassthrough(company.navXmlSignKey)!,
    taxNumber: company.taxNumber,
  };
}
