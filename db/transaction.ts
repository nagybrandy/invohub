// db/transaction.ts
// Interactive Postgres transactions for the few writes that must be atomic
// across several statements — today only "assign invoice number + write
// the invoice and its line items" (lib/invoices/service.ts).
//
// Why a second client instead of reusing db/index.ts:
// db/index.ts uses drizzle-orm/neon-http, which sends every query as its own
// HTTP request and does NOT support interactive transactions
// (`db.transaction(async tx => …)` throws). Its `db.batch([...])` does run in
// one transaction, but every statement is fixed up front: a later statement
// cannot branch on an earlier one's result, so the "is this invoice still
// unnumbered?" re-check under a row lock (the guard against two concurrent
// finalizations of the same draft) would have to be encoded as conditional
// SQL tricks. The WebSocket-based neon-serverless driver gives a real
// session: SELECT … FOR UPDATE, JS-level checks that roll back by throwing,
// and the document_sequence upsert's row lock held until COMMIT. See
// docs/decisions/2026-09-22-atomic-invoice-numbering.md.
//
// Serverless rules (Neon docs): a Pool must not outlive the request, so a
// fresh Pool is created per transaction and always ended in `finally`.
// Node 22 (package.json "engines", Vercel runtime) ships a global
// WebSocket, which the driver needs; nothing else is required.
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { schema } from "@/db/schema";

type TransactionalDb = NeonDatabase<typeof schema>;

/** The `tx` handle passed to runInTransaction's callback. */
export type DbTransaction = Parameters<Parameters<TransactionalDb["transaction"]>[0]>[0];

function ensureWebSocketConstructor() {
  if (neonConfig.webSocketConstructor) return;
  const ws = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof ws !== "function") {
    throw new Error(
      "No WebSocket implementation available for @neondatabase/serverless (requires Node 22+)."
    );
  }
  neonConfig.webSocketConstructor = ws as unknown as typeof neonConfig.webSocketConstructor;
}

/**
 * Runs `fn` inside a single Postgres transaction (READ COMMITTED). Either
 * every statement issued through `tx` commits, or — when `fn` throws, the
 * connection drops, or the function is killed mid-way — none of them do.
 */
export async function runInTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  ensureWebSocketConstructor();
  const pool = new Pool({ connectionString });
  try {
    const txDb: TransactionalDb = drizzle(pool, { schema });
    return await txDb.transaction(fn);
  } finally {
    await pool.end();
  }
}
