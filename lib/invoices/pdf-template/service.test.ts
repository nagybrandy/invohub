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
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import {
  getInvoicePdfTemplateSnapshot,
  getLegacyAppearance,
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
    // A row without a layout column value is a pre-redesign row: legacy colour fallback.
    expect(template.accentColor).toBe(LEGACY_PDF_TEMPLATE.accentColor);
  });

  it("reads the five paper columns", async () => {
    mockDb.select.mockReturnValue(
      chain([
        {
          ...STORED_ROW,
          accentColor: "#E8590C",
          layout: "band",
          fontStyle: "classic",
          logoMode: "own",
          logoSize: "L",
          logoPosition: "right",
        },
      ])
    );
    expect(await getPdfTemplate("user-1")).toMatchObject({
      layout: "band",
      fontStyle: "classic",
      logoMode: "own",
      logoSize: "L",
      logoPosition: "right",
      accentColor: "#E8590C",
    });
  });

  it("maps a pre-redesign row (column defaults) to the legacy layout, and unknown values to legacy-safe ones", async () => {
    mockDb.select.mockReturnValue(
      chain([{ ...STORED_ROW, layout: "legacy", fontStyle: "invohub", logoMode: "monogram", logoSize: "M", logoPosition: "left" }])
    );
    expect((await getPdfTemplate("user-1")).layout).toBe("legacy");

    mockDb.select.mockReturnValue(
      chain([{ ...STORED_ROW, layout: "hologram", fontStyle: "comic", logoMode: "x", logoSize: "XL", logoPosition: "up" }])
    );
    expect(await getPdfTemplate("user-1")).toMatchObject({
      layout: "legacy",
      fontStyle: "invohub",
      logoMode: "monogram",
      logoSize: "M",
      logoPosition: "left",
    });
  });

  it("normalizes a bad accent on a new-layout row to Dóri's blue, not the legacy cornflower", async () => {
    mockDb.select.mockReturnValue(chain([{ ...STORED_ROW, accentColor: "nope", layout: "frame" }]));
    expect((await getPdfTemplate("user-1")).accentColor).toBe(DEFAULT_PDF_TEMPLATE.accentColor);
  });
});


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
        layout: "legacy",
        fontStyle: "invohub",
        logoMode: "monogram",
        logoSize: "M",
        logoPosition: "left",
      },
    });
    // Only this user's issued (non-draft) documents.
    expect(updates[0].params).toEqual(expect.arrayContaining(["user-1", "draft"]));
  });

  it("freezes the LEGACY appearance (never a paper layout) even when the stored row is already a new design", async () => {
    const updates = recordUpdates({ ...STORED_ROW, layout: "frame" });
    mockDb.select.mockReturnValue(chain([{ ...STORED_ROW, layout: "frame", fontStyle: "round", accentColor: "#3F6BC4" }]));

    await upsertPdfTemplate("user-1", { titleText: "X" });

    expect(updates[0].table).toBe(invoice);
    expect(updates[0].values.pdfTemplateSnapshot).toMatchObject({ layout: "legacy", accentColor: "#3F6BC4" });
  });

  it("freezes the frozen legacy values (not Dóri's defaults) when the user never saved a template before", async () => {
    const updates = recordUpdates(undefined);
    mockDb.select.mockReturnValue(chain([]));
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([{ ...STORED_ROW }]) })),
    });

    await upsertPdfTemplate("user-1", { accentColor: "#000000" });

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe(invoice);
    expect(updates[0].values).toEqual({ pdfTemplateSnapshot: LEGACY_PDF_TEMPLATE });
  });

  it("gives a user without a row Dóri's design for the row it inserts, with all five paper columns written", async () => {
    recordUpdates(undefined);
    mockDb.select.mockReturnValue(chain([]));
    const values = jest.fn(() => ({ returning: jest.fn().mockResolvedValue([{ ...STORED_ROW }]) }));
    mockDb.insert.mockReturnValue({ values });

    await upsertPdfTemplate("user-1", {});

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: "frame",
        fontStyle: "invohub",
        logoMode: "monogram",
        logoSize: "M",
        logoPosition: "left",
        accentColor: "#3F6BC4",
        footerText: "Köszönjük a bizalmát!",
      })
    );
  });

  it("merges the input onto the STORED row: a PATCH without layout keeps a legacy row legacy", async () => {
    const updates = recordUpdates({ ...STORED_ROW });
    mockDb.select.mockReturnValue(chain([{ ...STORED_ROW, layout: "legacy" }]));

    const result = await upsertPdfTemplate("user-1", { titleText: "ÚJ" });

    const rowUpdate = updates.find((u) => u.table === invoicePdfTemplate)!;
    expect(rowUpdate.values).toMatchObject({
      titleText: "ÚJ",
      accentColor: "#112233",
      layout: "legacy",
      fontStyle: "invohub",
      logoMode: "monogram",
      logoSize: "M",
      logoPosition: "left",
    });
    expect(result.layout).toBe("legacy");
  });

  it("writes an explicit layout choice and all five paper columns on update", async () => {
    const updates = recordUpdates({ ...STORED_ROW });
    mockDb.select.mockReturnValue(chain([{ ...STORED_ROW, layout: "legacy" }]));

    await upsertPdfTemplate("user-1", {
      layout: "band",
      fontStyle: "round",
      logoMode: "none",
      logoSize: "S",
      logoPosition: "right",
    });

    expect(updates.find((u) => u.table === invoicePdfTemplate)!.values).toMatchObject({
      layout: "band",
      fontStyle: "round",
      logoMode: "none",
      logoSize: "S",
      logoPosition: "right",
    });
  });

  it("a layout-only change on a never-customised legacy row takes Dóri's accent and footer, and still freezes the legacy look onto issued invoices", async () => {
    const legacyRow = {
      ...STORED_ROW,
      titleText: LEGACY_PDF_TEMPLATE.titleText,
      accentColor: LEGACY_PDF_TEMPLATE.accentColor,
      footerText: LEGACY_PDF_TEMPLATE.footerText,
      layout: "legacy",
    };
    const updates = recordUpdates({ ...legacyRow, layout: "frame" });
    mockDb.select.mockReturnValue(chain([legacyRow]));

    await upsertPdfTemplate("user-1", { layout: "frame" });

    expect(updates[0].values).toMatchObject({
      pdfTemplateSnapshot: { layout: "legacy", accentColor: "#6495ed", footerText: "Köszönjük a bizalmat!" },
    });
    expect(updates.find((u) => u.table === invoicePdfTemplate)!.values).toMatchObject({
      layout: "frame",
      accentColor: DEFAULT_PDF_TEMPLATE.accentColor,
      footerText: DEFAULT_PDF_TEMPLATE.footerText,
    });
  });
});

describe("getLegacyAppearance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is the frozen legacy template for a user without a row", async () => {
    mockDb.select.mockReturnValue(chain([]));
    expect(await getLegacyAppearance("user-1")).toEqual(LEGACY_PDF_TEMPLATE);
  });

  it("is the stored row's values with the layout forced to legacy", async () => {
    mockDb.select.mockReturnValue(chain([{ ...STORED_ROW, layout: "frame", accentColor: "#3F6BC4" }]));
    expect(await getLegacyAppearance("user-1")).toMatchObject({
      layout: "legacy",
      accentColor: "#3F6BC4",
      titleText: "RÉGI SZÁMLA",
    });
  });
});
