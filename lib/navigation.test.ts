// lib/navigation.test.ts
import { routes } from "@/lib/navigation";

describe("routes", () => {
  it("builds invoice detail path", () => {
    expect(routes.invoiceDetail("abc")).toBe("/invoices/abc");
  });

  it("builds invoice edit path", () => {
    expect(routes.invoiceEdit("xyz")).toBe("/invoices/xyz/edit");
  });

  it("exposes static app routes", () => {
    expect(routes.invoices).toBe("/invoices");
    expect(routes.settingsCompany).toBe("/settings/company");
    expect(routes.receipts).toBe("/receipts");
    expect(routes.admin).toBe("/admin");
  });

  it("builds client and product edit paths", () => {
    expect(routes.clientEdit("c1")).toBe("/clients/c1/edit");
    expect(routes.productEdit("p1")).toBe("/products/p1/edit");
  });
});
