// app/api/nav/incoming+api.ts
// Sync and list incoming invoices from NAV.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incomingInvoice } from "@/db/schema";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { syncIncomingInvoices } from "@/lib/nav/incoming-sync";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  if (url.searchParams.get("sync") === "true") {
    const { synced, invoices } = await syncIncomingInvoices(session.user.id);
    return jsonResponse({ synced, invoices });
  }

  const invoices = await db
    .select()
    .from(incomingInvoice)
    .where(eq(incomingInvoice.userId, session.user.id));

  return jsonResponse({ invoices });
}
