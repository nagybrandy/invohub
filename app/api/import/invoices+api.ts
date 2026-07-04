// app/api/import/invoices+api.ts
// Bulk import invoices from Excel/CSV spreadsheet.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { parseInvoiceSpreadsheet } from "@/lib/import/parse-invoices";
import { upsertInvoice } from "@/lib/invoices/service";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const contentType = request.headers.get("content-type") ?? "";
  let buffer: ArrayBuffer;

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { base64?: string };
    if (!body.base64) {
      return jsonResponse({ error: "base64 field required for JSON upload." }, 400);
    }
    const binary = atob(body.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    buffer = bytes.buffer;
  } else {
    buffer = await request.arrayBuffer();
  }

  const drafts = parseInvoiceSpreadsheet(buffer);
  const now = new Date().toISOString();
  const created = [];

  for (const draft of drafts) {
    const saved = await upsertInvoice(session.user.id, {
      ...draft,
      createdAt: now,
      updatedAt: now,
    });
    created.push(saved);
  }

  return jsonResponse({ count: created.length, invoices: created }, 201);
}
