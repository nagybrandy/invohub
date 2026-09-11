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

  it("exposes every required public legal route", () => {
    expect(routes.terms).toBe("/aszf");
    expect(routes.privacy).toBe("/adatkezeles");
    expect(routes.cookies).toBe("/cookie-tajekoztato");
    expect(routes.imprint).toBe("/impresszum");
  });

  it("exposes blog index and article routes", () => {
    expect(routes.blog).toBe("/blog");
    expect(routes.blogPost("magyar-szamlazas-alapok")).toBe(
      "/blog/magyar-szamlazas-alapok",
    );
  });

  it("builds client and product edit paths", () => {
    expect(routes.clientEdit("c1")).toBe("/clients/c1/edit");
    expect(routes.productEdit("p1")).toBe("/products/p1/edit");
  });

  it("builds receipt detail path", () => {
    expect(routes.receiptDetail("r1")).toBe("/receipts/r1");
  });

  it("exposes onboarding route", () => {
    expect(routes.onboarding).toBe("/onboarding");
  });

  it("exposes new receipt route", () => {
    expect(routes.newReceipt).toBe("/receipts/new");
  });
});
