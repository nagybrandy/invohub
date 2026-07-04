// app/api/api-keys/[id]+api.ts
// Revoke an API key.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { revokeApiKey } from "@/lib/api-keys/service";

type Params = { id: string };

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const revoked = await revokeApiKey(session.user.id, id);
  if (!revoked) {
    return jsonResponse({ error: "API key not found." }, 404);
  }
  return new Response(null, { status: 204 });
}
