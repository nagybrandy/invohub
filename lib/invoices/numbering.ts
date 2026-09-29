// lib/invoices/numbering.ts
// Per-user, per-year, per-document-type invoice numbering.
//
// Numbers are assigned atomically via a single upsert ("INSERT ... ON CONFLICT
// DO UPDATE ... RETURNING") against document_sequence, so two concurrent
// requests for the same user/docType/year can never receive the same number —
// unlike the old generateInvoiceNumber(), which counted over an in-memory
// (and capped-at-100) invoice list.
//
// Gapless numbering (23/2014. NGM rendelet 8. § (1) a)): the increment on its
// own is atomic, but it must also commit together with the invoice write, or
// a failure in between burns a number. lib/invoices/service.ts therefore
// passes the transaction handle from db/transaction.ts as `executor`; the
// upsert then holds the document_sequence row lock until that transaction
// COMMITs or ROLLs BACK, so concurrent finalizations in the same series
// queue up and get consecutive numbers, and a rolled-back one frees its
// number for the next caller.
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { documentSequence } from "@/db/schema";
import type { InvoiceDocumentType } from "@/lib/invoices/types";

/** document_sequence only tracks three buckets — storno/modify share the "invoice" bucket. */
export type SequenceDocType = "invoice" | "proforma" | "advance";

const PREFIX: Record<SequenceDocType, string> = {
  invoice: "INV",
  proforma: "DBK",
  advance: "ELO",
};

/**
 * Maps a full invoice document type onto its numbering bucket. Storno and
 * helyesbítő (modify) documents are corrections against an existing invoice
 * and consume the same "invoice" sequence/prefix as a regular invoice.
 */
export function sequenceBucketForDocType(
  docType: InvoiceDocumentType
): SequenceDocType {
  switch (docType) {
    case "proforma":
      return "proforma";
    case "advance":
      return "advance";
    case "invoice":
    case "storno":
    case "modify":
    default:
      return "invoice";
  }
}

export function prefixForDocType(docType: InvoiceDocumentType): string {
  return PREFIX[sequenceBucketForDocType(docType)];
}

export function formatDocumentNumber(
  prefix: string,
  year: number,
  seq: number
): string {
  return `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
}

/**
 * Anything that can run the sequence upsert: the neon-http `db` or the
 * `tx` handle from runInTransaction (both are drizzle PgDatabase instances).
 */
export type SequenceExecutor = Pick<PgDatabase<PgQueryResultHKT, any, any>, "insert">;

/**
 * Atomically increments (or creates) the counter for userId/docType/year and
 * returns the new value. Pass the finalize transaction as `executor` so the
 * increment rolls back with it.
 */
export async function nextSequenceNumber(
  userId: string,
  docType: SequenceDocType,
  year: number,
  executor: SequenceExecutor = db
): Promise<number> {
  const [row] = await executor
    .insert(documentSequence)
    .values({ userId, docType, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequence.userId, documentSequence.docType, documentSequence.year],
      set: {
        lastNumber: sql`${documentSequence.lastNumber} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ lastNumber: documentSequence.lastNumber });

  if (!row) {
    throw new Error("Failed to allocate the next document number.");
  }
  return row.lastNumber;
}

/** Allocates and formats the next number for a document type/year, e.g. "INV-2026-00001". */
export async function generateNextInvoiceNumber(
  userId: string,
  docType: InvoiceDocumentType,
  year: number,
  executor: SequenceExecutor = db
): Promise<string> {
  const bucket = sequenceBucketForDocType(docType);
  const seq = await nextSequenceNumber(userId, bucket, year, executor);
  return formatDocumentNumber(PREFIX[bucket], year, seq);
}
