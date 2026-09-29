// app/api/nav/incoming+api.ts
// Sync and list incoming invoices from NAV.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomingInvoice } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { isDevSeedAllowed } from "@/lib/dev/seed-guard";
import { syncIncomingInvoices } from "@/lib/nav/incoming-sync";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  if (url.searchParams.get("sync") === "true") {
    // The "NAV" incoming sync is a hardcoded demo stub (lib/nav/client.ts's
    // fetchIncomingInvoices) — it contacts no NAV environment and returns
    // two invented supplier invoices. Behind the same guard as the demo
    // seed (app/api/dev/seed+api.ts) so it can never write fabricated cost
    // invoices into a real user's books. requireSession runs first (above)
    // so an unauthenticated caller still gets 401, not 404 — only the sync
    // branch is disabled, not the whole route.
    if (!isDevSeedAllowed()) return jsonResponse({ error: "Not found." }, 404);
    const { synced, invoices } = await syncIncomingInvoices(session.user.id);
    return jsonResponse({ synced, invoices });
  }

  const invoices = await db
    .select()
    .from(incomingInvoice)
    .where(eq(incomingInvoice.userId, session.user.id));

  return jsonResponse({ invoices });
}
