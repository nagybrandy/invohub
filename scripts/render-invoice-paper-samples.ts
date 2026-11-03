// scripts/render-invoice-paper-samples.ts
// Visual-check helper for the invoice paper redesign: renders the sample
// invoice (and the special document types) through generateInvoicePdf for
// every layout x font style and writes PDFs. Never touches the database or
// NAV. Usage:
//   npx tsx scripts/render-invoice-paper-samples.ts <outDir> [only-substring]
// then e.g. `pdftoppm -png -r 80 <pdf> <prefix>` to look at them.
import fs from "node:fs";
import path from "node:path";
import { generateInvoicePdf, type InvoicePdfContext } from "../lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "../lib/invoices/pdf-template/sample-invoice";
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE } from "../lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplate } from "../lib/invoices/pdf-template/types";
import type { Invoice, InvoiceLineItem } from "../lib/invoices/types";

const outDir = process.argv[2];
const only = process.argv[3];
if (!outDir) {
  console.error("usage: render-invoice-paper-samples.ts <outDir> [only]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const COMPANY = {
  name: "Kovács Anna e.v.",
  taxNumber: "66123456-1-33",
  address: "Bartók Béla út 21. 2/4.",
  city: "Budapest",
  zipCode: "1114",
  country: "Magyarország",
  bankAccount: "10700024-12345678-51100005",
};

// A small opaque PNG (rounded blue square with a white diamond) as the own logo.
function logoDataUri(): string {
  const { PNG_BASE64 } = require("./render-invoice-paper-logo") as { PNG_BASE64: string };
  return `data:image/png;base64,${PNG_BASE64}`;
}

const sample = (overrides: Partial<Invoice> = {}): Invoice => ({ ...buildSamplePreviewInvoice(), ...overrides });
const line = (overrides: Partial<InvoiceLineItem>): InvoiceLineItem => ({
  id: "x",
  description: "Tétel",
  quantity: 1,
  unitPrice: 10000,
  vatRate: 27,
  vatCategory: "normal",
  ...overrides,
});
const tpl = (overrides: Partial<InvoicePdfTemplate> = {}): InvoicePdfTemplate => ({ ...DEFAULT_PDF_TEMPLATE, ...overrides });

type Job = { name: string; ctx: InvoicePdfContext };
const jobs: Job[] = [];
const add = (name: string, invoice: Invoice, template: InvoicePdfTemplate, extra: Partial<InvoicePdfContext> = {}) =>
  jobs.push({
    name,
    ctx: {
      invoice,
      company: COMPANY,
      template,
      buyer: {
        address: invoice.clientAddress,
        city: invoice.clientCity,
        zipCode: invoice.clientZipCode,
        country: invoice.clientCountry,
      },
      ...extra,
    },
  });

for (const layout of ["clean", "band", "frame"] as const) {
  for (const fontStyle of ["invohub", "classic", "round"] as const) {
    add(`sample-${layout}-${fontStyle}`, sample(), tpl({ layout, fontStyle }));
  }
}
add("sample-legacy", sample(), LEGACY_PDF_TEMPLATE);
for (const size of ["S", "M", "L"] as const) {
  add(`logo-monogram-${size}-left`, sample(), tpl({ logoSize: size }));
  add(`logo-own-${size}-left`, sample(), tpl({ logoMode: "own", logoSize: size }), {
    company: { ...COMPANY, logoUrl: logoDataUri() },
  });
}
add("logo-monogram-M-right", sample(), tpl({ logoPosition: "right" }));
add("logo-own-M-right", sample(), tpl({ logoMode: "own", logoPosition: "right" }), {
  company: { ...COMPANY, logoUrl: logoDataUri() },
});
add("logo-none", sample(), tpl({ logoMode: "none" }));
add("logo-own-fallback", sample(), tpl({ logoMode: "own" }));
for (const [hex, label] of [["#E8590C", "orange"], ["#16803C", "green"], ["#212325", "black"], ["#F2B705", "yellow"]] as const) {
  add(`color-${label}-band`, sample(), tpl({ layout: "band", accentColor: hex }));
}
add("toggles-off-frame", sample(), tpl({ showCompanyBlock: false, showBankDetails: false, showClientTaxNumber: false }));
add("draft-frame", sample({ invoiceNumber: "", status: "draft" }), tpl());
add("proforma-clean", sample({ documentType: "proforma", invoiceNumber: "DIJ-2026-00004" }), tpl({ layout: "clean" }));
add("advance-band", sample({ documentType: "advance", invoiceNumber: "ELO-2026-00002" }), tpl({ layout: "band" }));
add(
  "storno-frame",
  sample({
    documentType: "storno",
    invoiceNumber: "STORNO-2026-00001",
    lineItems: sample().lineItems.map((item) => ({ ...item, quantity: -item.quantity })),
  }),
  tpl(),
  { referencedInvoiceNumber: "INV-2026-00018" }
);
add(
  "modify-clean",
  sample({
    documentType: "modify",
    invoiceNumber: "HELY-2026-00001",
    lineItems: [line({ description: "Webfejlesztés (óradíj)", quantity: -24, unit: "óra", unitPrice: 15000 }), line({ id: "y", description: "Webfejlesztés (óradíj)", quantity: 20, unit: "óra", unitPrice: 15000 })],
  }),
  tpl({ layout: "clean" }),
  { referencedInvoiceNumber: "INV-2026-00018" }
);
add(
  "aam-frame",
  sample({ lineItems: [line({ id: "a", description: "Tanácsadás", quantity: 8, unit: "óra", unitPrice: 25000, vatRate: 0, vatCategory: "AAM" })] }),
  tpl()
);
add(
  "aam-band",
  sample({ lineItems: [line({ id: "a", description: "Tanácsadás", quantity: 8, unit: "óra", unitPrice: 25000, vatRate: 0, vatCategory: "AAM" })] }),
  tpl({ layout: "band" })
);
add(
  "fad-clean",
  sample({ lineItems: [line({ id: "a", description: "Építési szolgáltatás", quantity: 1, unitPrice: 500000, vatRate: 0, vatCategory: "FAD" })] }),
  tpl({ layout: "clean" })
);
add(
  "eur-frame",
  sample({
    currency: "EUR",
    exchangeRate: 395.5,
    lineItems: [
      line({ id: "a", description: "Consulting", quantity: 12, unit: "hours", unitPrice: 85 }),
      line({ id: "b", description: "Licence", quantity: 1, unit: "pcs", unitPrice: 1250.5 }),
    ],
  }),
  tpl()
);
add(
  "english-frame",
  sample({
    language: "en",
    currency: "EUR",
    exchangeRate: 395.5,
    clientName: "Acme Ltd.",
    notes: "Payment within 15 days by bank transfer.",
    lineItems: [
      line({ id: "a", description: "Web development (hourly)", quantity: 24, unit: "hours", unitPrice: 60 }),
      line({ id: "b", description: "Monthly maintenance", quantity: 1, unit: "month", unitPrice: 180 }),
    ],
  }),
  tpl({ layout: "band", fontStyle: "classic" })
);
add(
  "english-eur-frame-round",
  sample({
    language: "en",
    lineItems: [line({ id: "a", description: "Web development", quantity: 10, unit: "hours", unitPrice: 15000 })],
  }),
  tpl({ fontStyle: "round" })
);
for (const layout of ["clean", "frame"] as const) {
  add(
    `many-lines-${layout}`,
    sample({
      lineItems: Array.from({ length: 40 }, (_, i) =>
        line({ id: `l${i}`, description: `Fejlesztési feladat ${i + 1}`, quantity: i + 1, unit: "óra", unitPrice: 15000 })
      ),
      notes: "Fizetési határidő 15 nap, átutalással.",
    }),
    tpl({ layout })
  );
}
add(
  "long-notes-band",
  sample({
    lineItems: Array.from({ length: 16 }, (_, i) => line({ id: `l${i}`, description: `Tétel ${i + 1}`, quantity: i + 1, unitPrice: 12500 })),
    notes: "Ez egy hosszú, ismétlődő szöveg a tördelés teszteléséhez. ".repeat(110),
  }),
  tpl({ layout: "band" })
);
add(
  "long-names-frame",
  sample({
    clientName: "Nagyon Hosszú Nevű Szolgáltató és Kereskedelmi Korlátolt Felelősségű Társaság",
    lineItems: [
      line({ id: "a", description: "Nagyon hosszú megnevezésű tétel, amely több sorba tördelődik a táblázat első oszlopában, hogy lássuk a sormagasságot", comment: "Megjegyzés a tételhez, amely szintén lehet hosszabb is.", quantity: 1234.5, unit: "óra", unitPrice: 1250000 }),
    ],
  }),
  tpl()
);
add(
  "header-long-title-frame",
  sample({ documentType: "modify", invoiceNumber: "HELY-2026-00001", status: "cancelled" }),
  tpl(),
  { referencedInvoiceNumber: "INV-2026-00018" }
);

async function main() {
  for (const job of jobs) {
    if (only && !job.name.includes(only)) continue;
    const pdf = await generateInvoicePdf(job.ctx);
    fs.writeFileSync(path.join(outDir, `${job.name}.pdf`), pdf);
    console.log(`${job.name}.pdf ${pdf.length}`);
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
