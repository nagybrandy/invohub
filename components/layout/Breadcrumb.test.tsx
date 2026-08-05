// components/layout/Breadcrumb.test.tsx
import { type BreadcrumbItem } from "@/components/layout/Breadcrumb";

describe("BreadcrumbItem type", () => {
  it("supports label-only items", () => {
    const item: BreadcrumbItem = { label: "Current" };
    expect(item.label).toBe("Current");
    expect(item.href).toBeUndefined();
  });

  it("supports items with href", () => {
    const item: BreadcrumbItem = { label: "Home", href: "/" as any };
    expect(item.label).toBe("Home");
    expect(item.href).toBe("/");
  });

  it("builds breadcrumb trail", () => {
    const trail: BreadcrumbItem[] = [
      { label: "Főoldal", href: "/dashboard" as any },
      { label: "Számlák", href: "/invoices" as any },
      { label: "Új" },
    ];
    expect(trail).toHaveLength(3);
    expect(trail[trail.length - 1].href).toBeUndefined();
  });
});
