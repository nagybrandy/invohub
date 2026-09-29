// app/api/v1/products/[id]+api.ts
// External API: single product CRUD, scoped to the key's userId — another
// user's product id is always a 404, never a 403.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import {
  deleteProductById,
  getProductById,
  updateProduct,
} from "@/lib/products/service";
import type { ProductInput } from "@/lib/products/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const product = await getProductById(auth.userId, id);
  if (!product) return jsonApiResponse({ error: "Product not found." }, 404);
  return jsonApiResponse({ product });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  let body: Partial<ProductInput>;
  try {
    body = (await request.json()) as Partial<ProductInput>;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  const product = await updateProduct(auth.userId, id, body);
  if (!product) return jsonApiResponse({ error: "Product not found." }, 404);
  return jsonApiResponse({ product });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const deleted = await deleteProductById(auth.userId, id);
  if (!deleted) return jsonApiResponse({ error: "Product not found." }, 404);
  return new Response(null, { status: 204 });
}
