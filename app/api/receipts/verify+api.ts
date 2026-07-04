// app/api/receipts/verify+api.ts
// Public receipt verification by QR token (no auth).
import { getPublicReceiptByToken } from "@/lib/receipts/service";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return jsonResponse({ error: "token query parameter is required." }, 400);
  }

  const receipt = await getPublicReceiptByToken(token);
  if (!receipt) {
    return jsonResponse({ error: "Receipt not found or invalid token." }, 404);
  }

  return jsonResponse({ receipt });
}
