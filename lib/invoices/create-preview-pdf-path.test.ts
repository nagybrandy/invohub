// lib/invoices/create-preview-pdf-path.test.ts
// Create → preview HTML → PDF happy path (web pipeline without auth UI).
jest.mock("@/lib/invoices/pdf-document", () => {
  const { EventEmitter } = require("events");

  class MockPDFDocument extends EventEmitter {
    page = {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    };
    y = 100;

    currentLineHeight() {
      return 12;
    }
    heightOfString(text: string) {
      return Math.max(12, Math.ceil(String(text).length / 40) * 12);
    }
    fontSize() {
      return this;
    }
    font() {
      return this;
    }
    fillColor() {
      return this;
    }
    fill() {
      return this;
    }
    text() {
      return this;
    }
    save() {
      return this;
    }
    restore() {
      return this;
    }
    roundedRect() {
      return this;
    }
    lineWidth() {
      return this;
    }
    image() {
      return this;
    }
    moveDown() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    strokeColor() {
      return this;
    }
    stroke() {
      return this;
    }
    addPage() {
      return this;
    }
    end() {
      this.emit("data", Buffer.from("%PDF-1.4\n"));
      this.emit("end");
    }
  }

  return {
    createPdfDocument: () => new MockPDFDocument(),
    withPdfKitFonts: (run: () => unknown) => run(),
  };
});

import { makeLineItem } from "@/__tests__/fixtures/invoices";
import { buildDraftInvoice } from "@/lib/invoices/build-draft-invoice";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";

describe("create → preview → PDF happy path", () => {
  it("builds a draft, renders HTML preview, and produces a PDF buffer", async () => {
    const draft = buildDraftInvoice({
      invoiceNumber: "INV-2026-100",
      clientName: "Acme Kft.",
      clientTaxNumber: "12345678-1-23",
      issueDate: "2026-06-01",
      dueDate: "2026-06-15",
      currency: "HUF",
      notes: "Thank you",
      lineItems: [
        makeLineItem({
          description: "Consulting",
          quantity: 2,
          unitPrice: 50000,
          vatRate: 27,
        }),
      ],
    });

    expect(draft.status).toBe("draft");
    expect(draft.clientName).toBe("Acme Kft.");
    expect(draft.lineItems).toHaveLength(1);

    const html = generateInvoicePreviewHtml(draft);
    expect(html).toContain("INV-2026-100");
    expect(html).toContain("Acme Kft.");
    expect(html).toContain("Consulting");
    expect(html).toContain("VAT");

    const pdf = await generateInvoicePdf({
      invoice: draft,
      company: { name: "InvoHub Demo Kft.", taxNumber: "87654321-2-41" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.toString("utf8")).toContain("%PDF-");
  });
});
