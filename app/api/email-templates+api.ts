// app/api/email-templates+api.ts
// List and seed email templates for the current user.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { listEmailTemplates } from "@/lib/email/templates/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const templates = await listEmailTemplates(session.user.id);
  return jsonResponse({ templates });
}
