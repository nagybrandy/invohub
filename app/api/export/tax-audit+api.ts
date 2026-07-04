// app/api/export/tax-audit+api.ts
// Tax authority audit CSV export.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { generateTaxAuditExport } from "@/lib/export/tax-audit";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "2026-01-01";
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const csv = await generateTaxAuditExport(session.user.id, from, to);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tax-audit-${from}-${to}.csv"`,
    },
  });
}
