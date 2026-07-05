// lib/nav/client.ts
// NAV Online Számla API client — sandbox stub with test/production endpoints.
import {
  NAV_API_BASE_URL,
  type NavEnvironment,
} from "@/lib/nav/environment";

export type NavCredentials = {
  technicalUser: string;
  xmlSignKey: string;
  taxNumber: string;
  environment: NavEnvironment;
};

export type NavIncomingInvoiceStub = {
  navInvoiceId: string;
  supplierName: string;
  supplierTaxNumber: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
};

export function getNavApiBaseUrl(environment: NavEnvironment): string {
  return NAV_API_BASE_URL[environment];
}

export async function fetchIncomingInvoices(
  credentials: NavCredentials
): Promise<NavIncomingInvoiceStub[]> {
  void getNavApiBaseUrl(credentials.environment);

  const prefix = credentials.environment === "production" ? "NAV" : "NAV-TEST";

  return [
    {
      navInvoiceId: `${prefix}-2026-001`,
      supplierName: "Office Supplies Kft.",
      supplierTaxNumber: "11111111-1-11",
      invoiceNumber: "SUP-2026-042",
      issueDate: "2026-06-15",
      dueDate: "2026-07-15",
      totalAmount: 45000,
      currency: "HUF",
    },
    {
      navInvoiceId: `${prefix}-2026-002`,
      supplierName: "Cloud Hosting Zrt.",
      supplierTaxNumber: "22222222-2-22",
      invoiceNumber: "CLD-8891",
      issueDate: "2026-06-20",
      dueDate: "2026-07-20",
      totalAmount: 12990,
      currency: "HUF",
    },
  ];
}

export async function submitInvoiceToNav(
  credentials: NavCredentials,
  invoiceXml: string
): Promise<{ transactionId: string; status: string; environment: NavEnvironment }> {
  void getNavApiBaseUrl(credentials.environment);
  void invoiceXml;

  const envTag = credentials.environment === "production" ? "LIVE" : "TEST";

  return {
    transactionId: `NAV-${envTag}-TXN-${Date.now()}`,
    status: "accepted",
    environment: credentials.environment,
  };
}
