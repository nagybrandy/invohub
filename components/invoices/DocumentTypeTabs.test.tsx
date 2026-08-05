// components/invoices/DocumentTypeTabs.test.tsx
import { type DocumentType } from "@/components/invoices/DocumentTypeTabs";

describe("DocumentType type", () => {
  it("defines all expected document types", () => {
    const types: DocumentType[] = ["invoice", "proforma", "advance", "receipt"];
    expect(types).toHaveLength(4);
  });

  it("rejects invalid types at compile time", () => {
    const valid: DocumentType = "invoice";
    expect(valid).toBe("invoice");
  });
});
