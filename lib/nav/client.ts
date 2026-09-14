// lib/nav/client.ts
// NAV Online Számla client factory: selects the in-process demo simulator
// (mode "demo", the default — zero NAV accounts needed) or the real OSA 3.0
// client (mode "test"/"production") based on the company's NAV mode.
import type { NavEnvironment } from "@/lib/nav/environment";
import { createNavRealClient } from "@/lib/nav/real-client";
import { createNavSimulatorClient } from "@/lib/nav/simulator";
import type { NavClient } from "@/lib/nav/types";

export function getNavClient(mode: NavEnvironment): NavClient {
  if (mode === "demo") return createNavSimulatorClient();
  return createNavRealClient(mode);
}

export type {
  NavClient,
  NavInvoiceOperationInput,
  NavInvoiceOperationKind,
  NavManageInvoiceResult,
  NavTaxpayerQueryResult,
  NavTokenExchangeResult,
  NavTransactionStatusResult,
  NavTransactionStatusValue,
} from "@/lib/nav/types";

// --- Legacy demo stub for the incoming-invoice sync feature -----------------
// syncIncomingInvoices (lib/nav/incoming-sync.ts) pulls a fixed demo list of
// "invoices received from suppliers" — this predates (and is out of scope
// for) the OSA 3.0 manageInvoice/queryTaxpayer work above. It's still wired
// through demo-shaped data only; see openIssues in docs/nav-test-setup.md.
export type NavCredentials = {
  technicalUser: string;
  xmlSignKey: string;
  taxNumber: string;
  environment: "test" | "production";
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

export async function fetchIncomingInvoices(credentials: NavCredentials): Promise<NavIncomingInvoiceStub[]> {
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
