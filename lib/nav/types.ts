// lib/nav/types.ts
// Shared interface implemented by both the demo simulator and the real NAV
// Online Számla v3.0 client, so callers (submit-outgoing, status polling,
// company lookup) don't need to branch on mode themselves.
import type { NavRealCredentials } from "@/lib/nav/resolve-credentials";

export type NavInvoiceOperationKind = "CREATE" | "MODIFY" | "STORNO";

export type NavInvoiceOperationInput = {
  index: number;
  operation: NavInvoiceOperationKind;
  /** Base64-encoded InvoiceData XML for this operation. */
  invoiceDataBase64: string;
};

export type NavTransactionStatusValue = "RECEIVED" | "PROCESSING" | "SAVED" | "DONE" | "ABORTED";

export type NavTransactionStatusResult = {
  transactionId: string;
  status: NavTransactionStatusValue;
  /** Technical + business validation messages, human-readable, most relevant first. */
  messages: string[];
};

export type NavTaxpayerQueryResult =
  | { valid: false }
  | {
      valid: true;
      name?: string;
      address?: string;
      city?: string;
      zipCode?: string;
      country?: string;
    };

export type NavManageInvoiceResult = { transactionId: string };
export type NavTokenExchangeResult = { exchangeToken: string };

export interface NavClient {
  environment: "demo" | "test" | "production";

  /** Exchanges technical-user credentials for a short-lived, decrypted exchange token. */
  tokenExchange(credentials: NavRealCredentials | null): Promise<NavTokenExchangeResult>;

  /** Submits one or more invoice operations (CREATE/MODIFY/STORNO). */
  manageInvoice(
    credentials: NavRealCredentials | null,
    exchangeToken: string,
    operations: NavInvoiceOperationInput[]
  ): Promise<NavManageInvoiceResult>;

  /** Polls NAV for the processing outcome of a previous manageInvoice call. */
  queryTransactionStatus(
    credentials: NavRealCredentials | null,
    transactionId: string
  ): Promise<NavTransactionStatusResult>;

  /** Looks up a Hungarian taxpayer by (8-digit) tax number. */
  queryTaxpayer(credentials: NavRealCredentials | null, taxNumber: string): Promise<NavTaxpayerQueryResult>;
}
