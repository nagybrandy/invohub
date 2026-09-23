// app/api/invoices/tax-audit-export+api.ts
// GET /api/invoices/tax-audit-export?from=YYYY-MM-DD&to=YYYY-MM-DD
//   or ?fromNumber=INV-2026-00001&toNumber=INV-2026-00050
// "Adóhatósági ellenőrzési adatszolgáltatás" (23/2014. NGM rendelet 11/A. §):
// the caller's own issued invoices in the 3. melléklet XML structure, as a
// file download. Drafts and díjbekérők are never included.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { generateTaxAuditExport } from "@/lib/invoices/tax-audit-export/generate";
import { parseTaxAuditSelection } from "@/lib/invoices/tax-audit-export/selection";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const parsed = parseTaxAuditSelection(new URL(request.url).searchParams);
  if (!parsed.ok) return jsonResponse({ error: parsed.code, code: parsed.code }, 400);

  try {
    const result = await generateTaxAuditExport(session.user.id, parsed.selection);

    if (!result.ok) {
      if (result.reason === "empty") {
        return jsonResponse({ error: "noInvoices", code: "noInvoices" }, 404);
      }
      if (result.reason === "tooMany") {
        return jsonResponse({ error: "tooManyInvoices", code: "tooManyInvoices", limit: result.limit }, 422);
      }
      return jsonResponse(
        { error: "incompleteInvoiceData", code: "incompleteInvoiceData", problems: result.problems },
        422
      );
    }

    return new Response(result.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/invoices/tax-audit-export]", error);
    return jsonResponse({ error: "exportFailed", code: "exportFailed" }, 500);
  }
}
