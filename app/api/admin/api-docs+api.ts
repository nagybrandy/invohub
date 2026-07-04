// app/api/admin/api-docs+api.ts
// Admin-only: serve external API integration documentation.
import { requireAdminAccess } from "@/lib/api/permissions";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  EXTERNAL_API_DOC_FILENAME,
  loadExternalApiDoc,
} from "@/lib/docs/load-external-api-doc";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAdminAccess(session);
  if (denied) return denied;

  const url = new URL(request.url);
  const asDownload = url.searchParams.get("download") === "1";

  try {
    const content = loadExternalApiDoc();

    if (asDownload) {
      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${EXTERNAL_API_DOC_FILENAME}"`,
        },
      });
    }

    return jsonResponse({
      filename: EXTERNAL_API_DOC_FILENAME,
      content,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return jsonResponse({ error: "API documentation file not found." }, 500);
  }
}
