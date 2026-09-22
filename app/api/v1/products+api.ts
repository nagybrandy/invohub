// app/api/v1/products+api.ts
// External API: product list and create, scoped to the key's userId.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { createProduct, listProducts } from "@/lib/products/service";
import type { ProductInput } from "@/lib/products/service";

export async function GET(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const products = await listProducts(auth.userId);
  return jsonApiResponse({ products });
}

export async function POST(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  let body: ProductInput;
  try {
    body = (await request.json()) as ProductInput;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!body.name?.trim()) {
    return jsonApiResponse({ error: "Product name is required." }, 400);
  }

  const product = await createProduct(auth.userId, body);
  return jsonApiResponse({ product }, 201);
}
