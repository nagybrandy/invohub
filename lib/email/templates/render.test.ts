// lib/email/templates/render.test.ts
import { renderTemplate } from "@/lib/email/templates/render";

describe("renderTemplate", () => {
  it("substitutes variables", () => {
    const result = renderTemplate(
      "Hello {{clientName}}, invoice {{invoiceNumber}} for {{total}}",
      {
        clientName: "Acme",
        invoiceNumber: "INV-001",
        total: "€127.00",
      }
    );
    expect(result).toBe("Hello Acme, invoice INV-001 for €127.00");
  });

  it("replaces missing variables with empty string", () => {
    expect(renderTemplate("Due: {{dueDate}}", {})).toBe("Due: ");
  });

  it("handles repeated placeholders", () => {
    expect(
      renderTemplate("{{invoiceNumber}} / {{invoiceNumber}}", {
        invoiceNumber: "X",
      })
    ).toBe("X / X");
  });

  it("preserves Hungarian characters (Számla, ő/ű) unmangled — no encoding corruption", () => {
    const result = renderTemplate("Számla {{invoiceNumber}} — {{companyName}}, {{clientName}}", {
      invoiceNumber: "INV-2026-042",
      companyName: "Nagy Ünőke Kft.",
      clientName: "Fűszer Üzletház Zrt.",
    });
    expect(result).toBe("Számla INV-2026-042 — Nagy Ünőke Kft., Fűszer Üzletház Zrt.");
    // Explicit codepoint checks — catch silent mojibake (e.g. UTF-8 bytes
    // reinterpreted as Latin-1/1252) that a plain string-equality assert
    // could still pass if both sides were corrupted identically.
    expect(result).toContain("á"); // Számla
    expect(result).toContain("ő"); // Ünőke
    expect(result).toContain("ű"); // Fűszer
    expect(result.codePointAt(result.indexOf("ő"))).toBe(0x151);
    expect(result.codePointAt(result.indexOf("ű"))).toBe(0x171);
  });
});
