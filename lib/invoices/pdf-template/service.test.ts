// lib/invoices/pdf-template/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/id", () => ({
  createId: jest.fn(() => "tpl-new-id"),
}));

import { db } from "@/db";
import { invoice, invoicePdfTemplate } from "@/db/schema";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import {
  getInvoicePdfTemplateSnapshot,
  getPdfTemplate,
  upsertPdfTemplate,
} from "@/lib/invoices/pdf-template/service";

const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

function chain(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue(rows),
      })),
    })),
  };
}

describe("getPdfTemplate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns defaults when no row", async () => {
    mockDb.select.mockReturnValue(chain([]));
    const template = await getPdfTemplate("user-1");
    expect(template).toEqual(DEFAULT_PDF_TEMPLATE);
  });

  it("maps stored row", async () => {
    mockDb.select.mockReturnValue(
      chain([
        {
          titleText: "SZÁMLA",
          accentColor: "#ff0000",
          showCompanyBlock: true,
          showBankDetails: false,
          showClientTaxNumber: true,
          footerText: "Footer",
          notesLabel: "Megjegyzés",
          fontScale: "large",
        },
      ])
    );

    const template = await getPdfTemplate("user-1");
    expect(template.titleText).toBe("SZÁMLA");
    expect(template.fontScale).toBe("large");
  });

  it("normalizes a malformed/malicious accentColor read back from the DB", async () => {
    // accentColor reaches the renderer verbatim — its safety must not depend on every row in
    // the DB already being a strict #rrggbb value (a legacy row, or a
    // direct DB edit). getPdfTemplate must sanitize on the way out, not
    // just upsertPdfTemplate on the way in.
    mockDb.select.mockReturnValue(
      chain([
        {
          titleText: "SZÁMLA",
          accentColor: "red; } body { display: none",
          showCompanyBlock: true,
          showBankDetails: false,
          showClientTaxNumber: true,
          footerText: "Footer",
          notesLabel: "Megjegyzés",
          fontScale: "large",
        },
      ])
    );

    const template = await getPdfTemplate("user-1");
    expect(template.accentColor).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
  });
});

const STORED_ROW = {
  id: "tpl-1",
  titleText: "RÉGI SZÁMLA",
  accentColor: "#112233",
  showCompanyBlock: true,
  showBankDetails: false,
  showClientTaxNumber: true,
  footerText: "Régi lábléc",
  notesLabel: "Megjegyzés",
  fontScale: "small",
};

/** Bound parameter values of a drizzle SQL condition (user id, status, …). */
function sqlParams(node: unknown, out: unknown[] = [], seen = new Set<unknown>()): unknown[] {
  if (!node || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    node.forEach((n) => sqlParams(n, out, seen));
    return out;
  }
  const obj = node as Record<string, unknown>;
  if (obj.constructor?.name === "Param") out.push(obj.value);
  if (Array.isArray(obj.queryChunks)) sqlParams(obj.queryChunks, out, seen);
  return out;
}

/** Records every db.update(table).set(values).where(cond) call, in order. */
function recordUpdates(returningRow: unknown) {
  const calls: Array<{ table: unknown; values: Record<string, unknown>; params: unknown[] }> = [];
  mockDb.update.mockImplementation((table: unknown) => ({
    set: jest.fn((values: Record<string, unknown>) => {
      const call = { table, values, params: [] as unknown[] };
      calls.push(call);
      const where = jest.fn((cond: unknown) => {
        call.params = sqlParams(cond);
        const done = Promise.resolve(undefined);
        return Object.assign(done, { returning: jest.fn().mockResolvedValue([returningRow]) });
      });
      return { where };
    }),
  }));
  return calls;
}

describe("getInvoicePdfTemplateSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the appearance frozen on the invoice when it was issued", async () => {
    mockDb.select.mockReturnValue(
      chain([{ pdfTemplateSnapshot: { ...STORED_ROW, id: undefined, titleText: "KIÁLLÍTÁSKORI" } }])
    );
    const snapshot = await getInvoicePdfTemplateSnapshot("user-1", "inv-1");
    expect(snapshot?.titleText).toBe("KIÁLLÍTÁSKORI");
    expect(snapshot?.fontScale).toBe("small");
    expect(snapshot).not.toHaveProperty("id");
  });

  it("returns null for an invoice without a snapshot, or an id that isn't the user's", async () => {
    mockDb.select.mockReturnValue(chain([{ pdfTemplateSnapshot: null }]));
    expect(await getInvoicePdfTemplateSnapshot("user-1", "inv-1")).toBeNull();

    mockDb.select.mockReturnValue(chain([]));
    expect(await getInvoicePdfTemplateSnapshot("user-1", "someone-elses")).toBeNull();
  });
});

describe("upsertPdfTemplate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserts when no existing template", async () => {
    recordUpdates(undefined);
    mockDb.select.mockReturnValue(chain([]));
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            titleText: "INVOICE",
            accentColor: DEFAULT_PDF_TEMPLATE.accentColor,
            showCompanyBlock: true,
            showBankDetails: true,
            showClientTaxNumber: true,
            footerText: "Thanks",
            notesLabel: "Notes",
            fontScale: "medium",
          },
        ]),
      })),
    });

    const template = await upsertPdfTemplate("user-1", { titleText: "INVOICE" });
    expect(template.titleText).toBe("INVOICE");
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("freezes the PREVIOUS appearance onto already-issued invoices that have no snapshot yet, before overwriting it", async () => {
    // Invoices issued before per-invoice snapshots existed render with the
    // live template — changing it must not restyle them retroactively.
    const updates = recordUpdates({ ...STORED_ROW, titleText: "ÚJ SZÁMLA" });
    mockDb.select.mockReturnValue(chain([STORED_ROW]));

    await upsertPdfTemplate("user-1", { ...STORED_ROW, titleText: "ÚJ SZÁMLA" });

    expect(updates.map((u) => u.table)).toEqual([invoice, invoicePdfTemplate]);
    expect(updates[0].values).toEqual({
      pdfTemplateSnapshot: {
        titleText: "RÉGI SZÁMLA",
        accentColor: "#112233",
        showCompanyBlock: true,
        showBankDetails: false,
        showClientTaxNumber: true,
        footerText: "Régi lábléc",
        notesLabel: "Megjegyzés",
        fontScale: "small",
      },
    });
    // Only this user's issued (non-draft) documents.
    expect(updates[0].params).toEqual(expect.arrayContaining(["user-1", "draft"]));
  });

  it("freezes the built-in default appearance when the user never saved a template before", async () => {
    const updates = recordUpdates(undefined);
    mockDb.select.mockReturnValue(chain([]));
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([{ ...STORED_ROW }]) })),
    });

    await upsertPdfTemplate("user-1", { accentColor: "#000000" });

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe(invoice);
    expect(updates[0].values).toEqual({ pdfTemplateSnapshot: DEFAULT_PDF_TEMPLATE });
  });
});
