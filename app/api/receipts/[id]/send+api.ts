// app/api/receipts/[id]/send+api.ts
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { sendReceiptEmail } from "@/lib/receipts/send-receipt-email";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  if (!id?.trim()) {
    return jsonResponse({ error: "Receipt id is required." }, 400);
  }

  const body = (await request.json()) as { to: string | string[] };

  if (!body.to) {
    return jsonResponse({ error: "Recipient email is required." }, 400);
  }

  const result = await sendReceiptEmail(session.user.id, id, body.to);

  if (!result.ok) {
    return jsonResponse(
      { error: result.error },
      result.error?.includes("not found") ? 404 : 500
    );
  }

  return jsonResponse({ ok: true, to: result.to });
}
