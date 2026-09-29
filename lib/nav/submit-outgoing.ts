// lib/nav/submit-outgoing.ts
// Shared NAV outgoing invoice submission: builds OSA 3.0 InvoiceData XML,
// submits it through the mode-appropriate client (demo simulator, or the
// real test/production client — production stays behind the
// NAV_PRODUCTION_ENABLED kill switch in lib/nav/environment.ts), and records
// the submission + transactionId.
//
// submitOutgoingInvoiceToNav is GUARDED and IDEMPOTENT:
//  - drafts, díjbekérők and non-HUF invoices without a rate are refused
//    (stable codes, see lib/nav/submission-guard.ts) before anything is
//    written or sent;
//  - if the invoice already has an in-progress or DONE submission, that one
//    is returned and NAV is not called again;
//  - a `pending` claim row is written before the network call and
//    re-checked afterwards, so two concurrent requests can't both submit;
//  - a failure is recorded on the row (status "error" + errorMessage) and
//    returned, never thrown, so the UI can offer "Újrapróbálás".
import { getClientById } from "@/lib/clients/service";
import { getCompanyByUserId, type Company } from "@/lib/companies/service";
import { findInvoicesReferencing, getInvoiceById } from "@/lib/invoices/service";
import { hasInvoiceNumber, type Invoice } from "@/lib/invoices/types";
import { getNavClient } from "@/lib/nav/client";
import { deriveNavCustomer, resolveNavBuyer } from "@/lib/nav/customer";
import type { NavEnvironment } from "@/lib/nav/environment";
import { buildNavInvoiceXml, type NavInvoiceExtra, type NavInvoiceReference } from "@/lib/nav/invoice-xml";
import { resolveNavCredentials } from "@/lib/nav/resolve-credentials";
import { hasSuccessfulNavSubmission } from "@/lib/nav/submission-history";
import { checkNavSubmittable, pickBlockingSubmission, type NavSubmittableCheck } from "@/lib/nav/submission-guard";
import {
  claimNavSubmission,
  getNavSubmissionRecord,
  listNavSubmissionRecords,
  markNavSubmissionFailed,
  markNavSubmissionSent,
  releaseNavSubmissionClaim,
  type NavSubmissionRecord,
} from "@/lib/nav/submission-store";
import type { NavInvoiceOperationKind } from "@/lib/nav/types";

/**
 * documentType "storno" -> NAV STORNO, "modify" -> NAV MODIFY, everything
 * else (invoice/advance) -> CREATE. Proforma never gets here (guard).
 */
export function resolveNavOperation(documentType: Invoice["documentType"]): NavInvoiceOperationKind {
  if (documentType === "storno") return "STORNO";
  if (documentType === "modify") return "MODIFY";
  return "CREATE";
}

type ModificationContext = {
  invoiceReference: NavInvoiceReference;
  lineNumberReferenceBase: number;
};

async function hasBlockingSubmission(invoiceId: string): Promise<boolean> {
  return pickBlockingSubmission(await listNavSubmissionRecords(invoiceId)) !== null;
}

/**
 * Resolves the <invoiceReference> block + line-number base for a storno/
 * helyesbítő document. The modification chain is what NAV already knows:
 * the original plus every OTHER finalized storno/helyesbítő of the same
 * original that has an in-progress or done NAV submission. So
 *  - modificationIndex = that count + 1 (unique and consecutive per
 *    original; the persisted Invoice.modificationIndex counts abandoned
 *    drafts too and is NOT used), and
 *  - new lines continue after all lines already in the chain.
 * Returns null for a plain CREATE.
 */
async function resolveModificationContext(userId: string, invoice: Invoice): Promise<ModificationContext | null> {
  const referencedId =
    invoice.documentType === "storno"
      ? invoice.originalInvoiceId
      : invoice.documentType === "modify"
        ? invoice.modifiesInvoiceId
        : undefined;
  if (!referencedId) {
    if (invoice.documentType === "storno" || invoice.documentType === "modify") {
      throw new Error(
        `NAV ${invoice.documentType} submission for invoice ${invoice.id} is missing its reference to the original invoice.`
      );
    }
    return null;
  }

  const original = await getInvoiceById(userId, referencedId);
  if (!original || !original.invoiceNumber) {
    throw new Error(
      `NAV ${invoice.documentType} submission for invoice ${invoice.id}: referenced original invoice ${referencedId} was not found or has no invoice number.`
    );
  }

  const [stornos, modifications] = await Promise.all([
    findInvoicesReferencing(userId, "originalInvoiceId", original.id),
    findInvoicesReferencing(userId, "modifiesInvoiceId", original.id),
  ]);
  const siblings = [...stornos, ...modifications].filter(
    (doc) =>
      doc.id !== invoice.id &&
      (doc.documentType === "storno" || doc.documentType === "modify") &&
      doc.status !== "draft" &&
      hasInvoiceNumber(doc)
  );
  const reported: Invoice[] = [];
  for (const doc of siblings) {
    if (await hasBlockingSubmission(doc.id)) reported.push(doc);
  }

  const wasExchanged = await hasSuccessfulNavSubmission(original.id);
  return {
    invoiceReference: {
      originalInvoiceNumber: original.invoiceNumber,
      modifyWithoutMaster: !wasExchanged,
      modificationIndex: reported.length + 1,
    },
    lineNumberReferenceBase:
      original.lineItems.length + reported.reduce((sum, doc) => sum + doc.lineItems.length, 0),
  };
}

/** Builds the InvoiceData XML (buyer from the linked partner) — no network, no DB writes. */
export async function buildNavInvoiceXmlForSubmission(
  userId: string,
  invoice: Invoice,
  company: Company | null
): Promise<string> {
  const [modification, client] = await Promise.all([
    resolveModificationContext(userId, invoice),
    invoice.clientId ? getClientById(userId, invoice.clientId) : Promise.resolve(null),
  ]);
  const extra: NavInvoiceExtra = {
    customer: deriveNavCustomer(resolveNavBuyer(invoice, client)),
    ...(modification ?? {}),
  };
  return buildNavInvoiceXml({ ...invoice, ...extra }, company);
}

export type NavSubmitOutcome =
  | { kind: "rejected"; code: Extract<NavSubmittableCheck, { ok: false }>["code"]; httpStatus: 409 | 422 }
  | { kind: "existing"; submission: NavSubmissionRecord }
  | { kind: "submitted"; submission: NavSubmissionRecord; invoiceXml: string }
  | { kind: "failed"; submission: NavSubmissionRecord | null; error: string };

export async function submitOutgoingInvoiceToNav(userId: string, invoice: Invoice): Promise<NavSubmitOutcome> {
  const check = checkNavSubmittable(invoice);
  if (!check.ok) return { kind: "rejected", code: check.code, httpStatus: check.httpStatus };

  const existing = pickBlockingSubmission(await listNavSubmissionRecords(invoice.id));
  if (existing) return { kind: "existing", submission: existing };

  const company = await getCompanyByUserId(userId);
  const mode: NavEnvironment = company?.navEnvironment ?? "demo";

  const claimId = await claimNavSubmission(invoice.id, mode);
  const winner = pickBlockingSubmission(await listNavSubmissionRecords(invoice.id));
  if (winner && winner.id !== claimId) {
    await releaseNavSubmissionClaim(claimId);
    return { kind: "existing", submission: winner };
  }

  let invoiceXml: string;
  let transactionId: string;
  try {
    invoiceXml = await buildNavInvoiceXmlForSubmission(userId, invoice, company);
    const invoiceDataBase64 = Buffer.from(invoiceXml, "utf8").toString("base64");
    const client = getNavClient(mode);
    const credentials = mode === "demo" ? null : resolveNavCredentials(company);
    const { exchangeToken } = await client.tokenExchange(credentials);
    ({ transactionId } = await client.manageInvoice(credentials, exchangeToken, [
      { index: 1, operation: resolveNavOperation(invoice.documentType), invoiceDataBase64 },
    ]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "NAV beküldés sikertelen.";
    await markNavSubmissionFailed(claimId, message);
    return { kind: "failed", submission: await getNavSubmissionRecord(invoice.id, claimId), error: message };
  }

  // NAV has accepted the request from here on: never record this as a
  // failure (that would invite a duplicate retry). If the DB write itself
  // fails, the row stays `pending` and keeps blocking until it goes stale.
  await markNavSubmissionSent(claimId, transactionId);
  const now = new Date();
  const submission: NavSubmissionRecord = (await getNavSubmissionRecord(invoice.id, claimId)) ?? {
    id: claimId,
    invoiceId: invoice.id,
    status: "sent",
    mode,
    transactionId,
    errorMessage: null,
    messages: null,
    checkedAt: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return { kind: "submitted", submission, invoiceXml };
}
