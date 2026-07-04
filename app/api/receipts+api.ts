// app/api/receipts+api.ts
// Receipt list and create.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  createReceipt,
  listReceipts,
  validateReceiptInput,
  type ReceiptInput,
} from "@/lib/receipts/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const receipts = await listReceipts(session.user.id);
  return jsonResponse({ receipts });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  let body: Partial<ReceiptInput>;
  try {
    body = (await request.json()) as Partial<ReceiptInput>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const validationError = validateReceiptInput(body);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  try {
    const receipt = await createReceipt(session.user.id, body as ReceiptInput);
    return jsonResponse({ receipt }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create receipt.";
    return jsonResponse({ error: message }, 400);
  }
}
