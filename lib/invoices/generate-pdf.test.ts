// lib/invoices/generate-pdf.test.ts
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

import { generateInvoicePdf, invoicePdfFilename } from "@/lib/invoices/generate-pdf";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

describe("invoicePdfFilename", () => {
  it("sanitizes unsafe characters", () => {
    expect(invoicePdfFilename("INV/2026#001")).toBe("INV_2026_001.pdf");
  });
});

describe("generateInvoicePdf", () => {
  it("returns a PDF buffer from the document stream", async () => {
    const invoice = makeInvoice({
      lineItems: [makeLineItem({ description: "Consulting", quantity: 2, unitPrice: 100 })],
    });

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
      template: { titleText: "CUSTOM INVOICE", accentColor: "#ff0000" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.toString("utf8")).toContain("%PDF-");
  });
});
