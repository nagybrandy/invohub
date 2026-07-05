// app/api/products/[id]+api.ts
// Single product CRUD.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { requireAccountantAccess } from "@/lib/api/permissions";
import {
  deleteProductById,
  getProductById,
  updateProduct,
} from "@/lib/products/service";
import type { ProductInput } from "@/lib/products/service";

type Params = { id: string };

function checkAccess(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session) return unauthorizedResponse();
  return requireAccountantAccess(session);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  const denied = checkAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  const product = await getProductById(session!.user.id, id);
  if (!product) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ product });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  const denied = checkAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  const body = (await request.json()) as Partial<ProductInput>;
  const product = await updateProduct(session!.user.id, id, body);
  if (!product) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ product });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  const denied = checkAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  const deleted = await deleteProductById(session!.user.id, id);
  if (!deleted) return jsonResponse({ error: "Not found" }, 404);
  return new Response(null, { status: 204 });
}
