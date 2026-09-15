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
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import { getPdfTemplate, upsertPdfTemplate } from "@/lib/invoices/pdf-template/service";

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
    // The render path (preview-html.ts) interpolates accentColor straight
    // into a <style> block — its safety must not depend on every row in
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

describe("upsertPdfTemplate", () => {
  it("inserts when no existing template", async () => {
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
});
