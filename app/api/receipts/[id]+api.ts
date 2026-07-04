// app/api/receipts/[id]+api.ts
// Single receipt GET.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getReceiptById } from "@/lib/receipts/service";

type Params = { id: string };

async function resolveParams(
  params: Promise<Params> | Params | undefined
): Promise<Params> {
  if (params == null) return { id: "" };
  return params instanceof Promise ? params : Promise.resolve(params);
}

export async function GET(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const { id } = await resolveParams(params);
    if (!id?.trim()) {
      return jsonResponse({ error: "Receipt id is required." }, 400);
    }

    const receipt = await getReceiptById(session.user.id, id);
    if (!receipt) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ receipt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load receipt.";
    return jsonResponse({ error: message }, 500);
  }
}
