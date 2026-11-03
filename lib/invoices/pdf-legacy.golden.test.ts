// lib/invoices/pdf-legacy.golden.test.ts
// "An issued invoice never changes appearance." Pins the byte output of the
// legacy invoice renderer (real pdfkit, real fonts, only Date faked) with a
// sha256 per fixture. Recorded on the base commit BEFORE the paper redesign
// (docs/design/invoice-paper-2026-11/PLAN.md §9.1) and must stay green after
// every later change: the redesign may add renderers, never alter this one.
//
// Regenerate ONLY when the legacy look is deliberately changed (it must not
// be): UPDATE_GOLDEN=1 npx jest lib/invoices/pdf-legacy.golden.test.ts
/** @jest-environment node */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generateInvoicePdf, type InvoicePdfContext } from "@/lib/invoices/generate-pdf";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Invoice } from "@/lib/invoices/types";

const GOLDEN_FILE = path.join(__dirname, "__golden__", "pdf-legacy.sha256.json");
const FIXED_NOW = new Date("2026-11-03T09:00:00.000Z");

// 1x1 PNG, enough for pdfkit to embed an image.
const PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const COMPANY = {
  name: "Kovács Anna e.v.",
  taxNumber: "66123456-1-33",
  address: "Bartók Béla út 21. 2/4.",
  city: "Budapest",
  zipCode: "1114",
  country: "Magyarország",
  bankAccount: "11773016-11111018-00000000",
};
const BUYER = {
  address: "Minta utca 12.",
  city: "Budapest",
  zipCode: "1117",
  country: "Magyarország",
};

// A frozen copy of buildSamplePreviewInvoice() as it was on the base commit
// (the live sample is allowed to evolve with the redesign).
function sampleInvoice(): Invoice {
  const now = FIXED_NOW.toISOString();
  return {
    id: "sample-preview",
    invoiceNumber: "SZLA-PREVIEW-001",
    documentType: "invoice",
    clientName: "Minta Ügyfél Kft.",
    clientTaxNumber: "12345678-1-23",
    issueDate: now.slice(0, 10),
    dueDate: now.slice(0, 10),
    status: "sent",
    currency: "HUF",
    lineItems: [
      { id: "line-1", description: "Tanácsadás", quantity: 8, unitPrice: 25000, vatRate: 27, vatCategory: "normal" },
      { id: "line-2", description: "Projektmenedzsment", quantity: 1, unitPrice: 120000, vatRate: 27, vatCategory: "normal" },
    ],
    notes: "Ez egy minta számla a PDF elrendezés előnézetéhez.",
    createdAt: now,
    updatedAt: now,
  };
}

function longText(charCount: number): string {
  const base = "Ez egy hosszú, ismétlődő szöveg a PDF tördelés teszteléséhez. ";
  return base.repeat(Math.ceil(charCount / base.length)).slice(0, charCount);
}

// Old snapshots / rows carry exactly these eight keys (no layout etc.).
const OLD_TEMPLATE = {
  titleText: "SZÁMLA",
  accentColor: "#6495ed",
  showCompanyBlock: true,
  showBankDetails: true,
  showClientTaxNumber: true,
  footerText: "Köszönjük a bizalmat!",
  notesLabel: "Megjegyzés",
  fontScale: "medium" as const,
};

type Fixture = { name: string; ctx: () => InvoicePdfContext };

const base = (invoice: Invoice, extra: Partial<InvoicePdfContext> = {}): InvoicePdfContext => ({
  invoice,
  company: COMPANY,
  buyer: BUYER,
  template: OLD_TEMPLATE,
  ...extra,
});

const eurInvoice = (overrides: Partial<Invoice> = {}) =>
  makeInvoice({
    invoiceNumber: "INV-2026-EUR",
    currency: "EUR",
    exchangeRate: 395.5,
    language: "en",
    fulfillmentDate: "2026-06-01",
    paymentMethod: "transfer",
    lineItems: [makeLineItem({ description: "Consulting", quantity: 3, unitPrice: 250.5, unit: "hours" })],
    ...overrides,
  } as Partial<Invoice>);

const FIXTURES: Fixture[] = [
  { name: "sample", ctx: () => base(sampleInvoice()) },
  {
    name: "draft",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "",
          status: "draft",
          lineItems: [makeLineItem({ quantity: 3, unitPrice: 19990 })],
        })
      ),
  },
  { name: "eur-en", ctx: () => base(eurInvoice()) },
  {
    name: "aam",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-AAM",
          lineItems: [makeLineItem({ vatCategory: "AAM", vatRate: 0, description: "Szolgáltatás" })],
        })
      ),
  },
  {
    name: "tam",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-TAM",
          lineItems: [makeLineItem({ vatCategory: "TAM", vatRate: 0, description: "Szolgáltatás" })],
        })
      ),
  },
  {
    name: "fad",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-FAD",
          lineItems: [makeLineItem({ vatCategory: "FAD", vatRate: 0, description: "Szolgáltatás" })],
        })
      ),
  },
  {
    name: "mixed-vat",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-MIX",
          lineItems: [
            makeLineItem({ id: "a", description: "Szoftver", quantity: 2, unitPrice: 10000, vatRate: 27 }),
            makeLineItem({ id: "b", description: "Könyv", quantity: 3, unitPrice: 4000, vatRate: 5 }),
            makeLineItem({ id: "c", description: "Étel", quantity: 1, unitPrice: 8000, vatRate: 18 }),
          ],
        })
      ),
  },
  {
    name: "storno",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "STORNO-2026-001",
          documentType: "storno",
          lineItems: [makeLineItem({ quantity: -2, unitPrice: 100 })],
        }),
        { referencedInvoiceNumber: "INV-2026-001" }
      ),
  },
  {
    name: "modify",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "HELY-2026-001",
          documentType: "modify",
          lineItems: [
            makeLineItem({ quantity: -1, unitPrice: 100 }),
            makeLineItem({ id: "l2", description: "Javított tétel", quantity: 1, unitPrice: 90 }),
          ],
        }),
        { referencedInvoiceNumber: "INV-2026-001" }
      ),
  },
  {
    name: "proforma",
    ctx: () => base(makeInvoice({ invoiceNumber: "DIJ-2026-001", documentType: "proforma" })),
  },
  {
    name: "advance",
    ctx: () => base(makeInvoice({ invoiceNumber: "ELO-2026-001", documentType: "advance" })),
  },
  {
    name: "many-lines",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-MANY",
          notes: "",
          lineItems: Array.from({ length: 40 }, (_, i) =>
            makeLineItem({ id: `l${i}`, description: `Tétel ${i + 1}`, quantity: 1, unitPrice: 5000 })
          ),
        })
      ),
  },
  {
    name: "long-notes",
    ctx: () =>
      base(
        makeInvoice({
          invoiceNumber: "INV-2026-NOTES",
          lineItems: Array.from({ length: 16 }, (_, i) =>
            makeLineItem({
              id: `l${i}`,
              description: `Tétel ${i + 1} — hosszabb leírással a sortördeléshez`,
              quantity: i + 1,
              unitPrice: 12500,
            })
          ),
          notes: longText(6000),
        })
      ),
  },
  {
    name: "toggles-off",
    ctx: () =>
      base(sampleInvoice(), {
        template: { ...OLD_TEMPLATE, showCompanyBlock: false, showBankDetails: false, showClientTaxNumber: false },
      }),
  },
  {
    name: "custom-small",
    ctx: () =>
      base(sampleInvoice(), {
        template: {
          ...OLD_TEMPLATE,
          accentColor: "#e8590c",
          fontScale: "small",
          titleText: "DÍJSZÁMLA",
          footerText: "Szeretettel",
          notesLabel: "Közlemény",
        },
      }),
  },
  {
    name: "custom-large",
    ctx: () => base(sampleInvoice(), { template: { ...OLD_TEMPLATE, accentColor: "#16803c", fontScale: "large" } }),
  },
  {
    name: "logo-png",
    ctx: () => base(sampleInvoice(), { company: { ...COMPANY, logoUrl: PNG_DATA_URI } }),
  },
];

async function renderHash(ctx: InvoicePdfContext): Promise<string> {
  const pdf = await generateInvoicePdf(ctx);
  return crypto.createHash("sha256").update(pdf).digest("hex");
}

describe("legacy invoice renderer (no-restyle golden hashes)", () => {
  beforeAll(() => {
    // Only Date is faked (pdfkit stamps CreationDate); timers stay real.
    jest.useFakeTimers({
      now: FIXED_NOW,
      doNotFake: [
        "hrtime",
        "nextTick",
        "performance",
        "queueMicrotask",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "requestIdleCallback",
        "cancelIdleCallback",
        "setImmediate",
        "clearImmediate",
        "setInterval",
        "clearInterval",
        "setTimeout",
        "clearTimeout",
      ],
    });
  });
  afterAll(() => jest.useRealTimers());

  const golden: Record<string, string> = fs.existsSync(GOLDEN_FILE)
    ? JSON.parse(fs.readFileSync(GOLDEN_FILE, "utf8"))
    : {};

  if (process.env.UPDATE_GOLDEN === "1") {
    it("records the golden hashes", async () => {
      const next: Record<string, string> = {};
      for (const fixture of FIXTURES) next[fixture.name] = await renderHash(fixture.ctx());
      fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
      fs.writeFileSync(GOLDEN_FILE, `${JSON.stringify(next, null, 2)}\n`);
    });
    return;
  }

  it("has a golden hash for every fixture", () => {
    expect(Object.keys(golden).sort()).toEqual(FIXTURES.map((f) => f.name).sort());
  });

  it.each(FIXTURES.map((f) => [f.name, f] as const))(
    "%s renders byte-identical to the recorded legacy output",
    async (_name, fixture) => {
      expect(await renderHash(fixture.ctx())).toBe(golden[fixture.name]);
    }
  );

  // After the paper redesign the stored shape carries layout "legacy" plus the
  // new (ignored) fields: it must hit the very same bytes as the old shape.
  it.each(FIXTURES.map((f) => [f.name, f] as const))(
    "%s: a template with layout 'legacy' and the new fields renders the same bytes as one without a layout key",
    async (_name, fixture) => {
      const ctx = fixture.ctx();
      const withLayout = {
        ...ctx,
        template: {
          ...ctx.template!,
          layout: "legacy" as const,
          fontStyle: "round" as const,
          logoMode: "none" as const,
          logoSize: "L" as const,
          logoPosition: "right" as const,
        },
      };
      expect(await renderHash(withLayout)).toBe(golden[fixture.name]);
    }
  );

  it("renders a context without any template as the legacy look", async () => {
    const { template: _template, ...noTemplate } = FIXTURES[0]!.ctx();
    expect(await renderHash(noTemplate)).not.toBe("");
    const withLegacyDefaults = { ...noTemplate, template: { ...OLD_TEMPLATE } };
    expect(await renderHash(noTemplate)).toBe(await renderHash(withLegacyDefaults));
  });

  it("is deterministic (two renders of the same input are identical)", async () => {
    const a = await renderHash(FIXTURES[0]!.ctx());
    const b = await renderHash(FIXTURES[0]!.ctx());
    expect(a).toBe(b);
  });
});
