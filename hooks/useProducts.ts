// hooks/useProducts.ts
// Product catalog hook backed by the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { Product, ProductInput } from "@/lib/products/service";

type ProductsResponse = { products: Product[] };
type ProductResponse = { product: Product };

export function useProducts() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ProductsResponse>("/api/products");
      setProducts(data.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(
    async (input: ProductInput) => {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh]
  );

  const update = React.useCallback(
    async (id: string, input: Partial<ProductInput>) => {
      const data = await apiFetch<ProductResponse>(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await refresh();
      return data.product;
    },
    [refresh]
  );

  const getById = React.useCallback(async (id: string) => {
    const data = await apiFetch<ProductResponse>(`/api/products/${id}`);
    return data.product;
  }, []);

  return { products, loading, error, refresh, create, update, getById };
}
