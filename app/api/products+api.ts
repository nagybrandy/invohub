// app/api/products+api.ts
// Product list and create.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { requireAccountantAccess } from "@/lib/api/permissions";
import { createProduct, listProducts } from "@/lib/products/service";
import type { ProductInput } from "@/lib/products/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const products = await listProducts(session.user.id);
  return jsonResponse({ products });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const body = (await request.json()) as ProductInput;
  if (!body.name?.trim()) {
    return jsonResponse({ error: "Product name is required." }, 400);
  }

  const product = await createProduct(session.user.id, body);
  return jsonResponse({ product }, 201);
}
