// app/api/admin/users/[id]/export+api.ts
// Admin: export the retained records (issued invoices + line items, NAV
// submissions, receipts, seller company data) of a user — typically a closed
// account — on request during the 8-year retention window. JSON attachment;
// never contains NAV credentials or auth secrets (lib/account/export.ts).
import { requireAdminAccess } from "@/lib/api/permissions";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { exportRetainedRecords } from "@/lib/account/export";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAdminAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  if (!id) return jsonResponse({ error: "User id is required." }, 400);

  try {
    const data = await exportRetainedRecords(id);
    if (!data) return jsonResponse({ error: "User not found." }, 404);
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, "_");
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="invohub-retained-${safeId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/users/:id/export]", error);
    return jsonResponse({ error: "Export failed." }, 500);
  }
}
