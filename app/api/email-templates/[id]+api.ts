// app/api/email-templates/[id]+api.ts
// Update a single email template.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { updateEmailTemplate } from "@/lib/email/templates/service";

type Params = { id: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = (await request.json()) as {
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
  };

  const template = await updateEmailTemplate(session.user.id, id, body);
  if (!template) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ template });
}
