// lib/api/resolve-id-param.test.ts
import { resolveIdParam } from "@/lib/api/resolve-id-param";

describe("resolveIdParam", () => {
  it("prefers router params when present", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/invoices/ignored"),
      { id: "mr682pvd-ketybxz3p" }
    );
    expect(id).toBe("mr682pvd-ketybxz3p");
  });

  it("falls back to invoice id in request path", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/invoices/mr682pvd-ketybxz3p"),
      undefined
    );
    expect(id).toBe("mr682pvd-ketybxz3p");
  });

  it("falls back for nested invoice routes", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/invoices/mr682pvd-ketybxz3p/pdf"),
      Promise.resolve({ id: "" })
    );
    expect(id).toBe("mr682pvd-ketybxz3p");
  });

  it("falls back for v1 invoice routes", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/v1/invoices/external-id/nav"),
      undefined
    );
    expect(id).toBe("external-id");
  });

  it("falls back for v1 client routes", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/v1/clients/client-id"),
      undefined
    );
    expect(id).toBe("client-id");
  });

  it("falls back for v1 product routes", async () => {
    const id = await resolveIdParam(
      new Request("https://invohub.vercel.app/api/v1/products/product-id"),
      undefined
    );
    expect(id).toBe("product-id");
  });
});
