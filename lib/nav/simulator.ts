// lib/nav/simulator.ts
// In-process NAV Online Számla demo simulator: implements the same NavClient
// interface as the real client, needs zero NAV accounts, and never touches
// the network. Deterministic transactionIds encode enough state (elapsed
// time + a validity check performed at submit time) that status polling and
// even serverless cold starts behave predictably without shared storage.
import { createHash } from "crypto";
import type {
  NavClient,
  NavInvoiceOperationInput,
  NavTaxpayerQueryResult,
  NavTransactionStatusResult,
} from "@/lib/nav/types";
import { extractBlock, extractTag } from "@/lib/nav/xml-utils";

// A poll within this window of submission still shows PROCESSING; a later
// poll ("the second time you check") shows DONE. This mirrors real NAV UX
// (near-instant demo feedback) without needing server-side shared state.
const PROCESSING_WINDOW_MS = 4000;

const DEMO_TAXPAYERS: Record<string, { name: string; city: string; zipCode: string; address: string }> = {
  "12345678": { name: "InvoHub Demó Kft.", city: "Budapest", zipCode: "1052", address: "Váci utca 1." },
  "98765432": { name: "Minta Bt.", city: "Szeged", zipCode: "6720", address: "Kárász utca 10." },
};

function decodeInvoiceDataXml(invoiceDataBase64: string): string {
  try {
    return Buffer.from(invoiceDataBase64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** Demo validation rule: the customer's domestic tax number (when present) must be exactly 8 digits. */
function hasMalformedCustomerTaxNumber(invoiceDataXml: string): boolean {
  const customerVatDataBlock = extractBlock(invoiceDataXml, "customerVatData");
  if (!customerVatDataBlock) return false;
  const taxpayerId = extractTag(customerVatDataBlock, "taxpayerId");
  if (!taxpayerId) return false;
  return !/^\d{8}$/.test(taxpayerId);
}

function encodeTransactionId(seed: string, createdAtMs: number, aborted: boolean): string {
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 10).toUpperCase();
  const flag = aborted ? "A" : "P";
  return `DEMO${flag}${createdAtMs.toString(36).toUpperCase()}${hash}`;
}

function decodeTransactionId(transactionId: string): { createdAtMs: number; aborted: boolean } | null {
  const match = transactionId.match(/^DEMO([AP])([0-9A-Z]+)([0-9A-F]{10})$/);
  if (!match) return null;
  const createdAtMs = parseInt(match[2], 36);
  if (Number.isNaN(createdAtMs)) return null;
  return { createdAtMs, aborted: match[1] === "A" };
}

export function createNavSimulatorClient(): NavClient {
  return {
    environment: "demo",

    async tokenExchange() {
      return { exchangeToken: "demo-exchange-token" };
    },

    async manageInvoice(_credentials, _exchangeToken, operations: NavInvoiceOperationInput[]) {
      const first = operations[0];
      if (!first) throw new Error("manageInvoice called with no operations.");
      const invoiceDataXml = decodeInvoiceDataXml(first.invoiceDataBase64);
      const aborted = hasMalformedCustomerTaxNumber(invoiceDataXml);
      const createdAtMs = Date.now();
      const transactionId = encodeTransactionId(first.invoiceDataBase64, createdAtMs, aborted);
      return { transactionId };
    },

    async queryTransactionStatus(_credentials, transactionId): Promise<NavTransactionStatusResult> {
      const decoded = decodeTransactionId(transactionId);
      if (!decoded) {
        return { transactionId, status: "ABORTED", messages: ["Ismeretlen demó tranzakcióazonosító."] };
      }
      if (decoded.aborted) {
        return {
          transactionId,
          status: "ABORTED",
          messages: [
            "SCHEMA_VIOLATION: A vevő adószáma (customerTaxNumber) nem 8 számjegyű — ellenőrizze az ügyfél adószámát.",
          ],
        };
      }
      const elapsed = Date.now() - decoded.createdAtMs;
      if (elapsed < PROCESSING_WINDOW_MS) {
        return { transactionId, status: "PROCESSING", messages: ["A számla feldolgozás alatt (demó szimulátor)."] };
      }
      return { transactionId, status: "DONE", messages: ["Sikeresen feldolgozva (demó szimulátor)."] };
    },

    async queryTaxpayer(_credentials, taxNumber): Promise<NavTaxpayerQueryResult> {
      const digits = taxNumber.replace(/\D/g, "").slice(0, 8);
      const demo = DEMO_TAXPAYERS[digits];
      if (demo) {
        return {
          valid: true,
          name: demo.name,
          city: demo.city,
          zipCode: demo.zipCode,
          address: demo.address,
          country: "HU",
        };
      }
      if (/^\d{8}$/.test(digits)) {
        return { valid: true, name: "", country: "HU" };
      }
      return { valid: false };
    },
  };
}
