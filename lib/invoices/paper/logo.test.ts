// lib/invoices/paper/logo.test.ts
import { paperInitials, parseLogoDataUri } from "@/lib/invoices/paper/logo";
import { LAYOUT_TOKENS, paperVariant } from "@/lib/invoices/paper/tokens";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2]).toString("base64");

describe("parseLogoDataUri", () => {
  it("accepts a PNG and a JPEG data: URI and returns the bytes", () => {
    expect(parseLogoDataUri(`data:image/png;base64,${PNG_B64}`)?.subarray(1, 4).toString()).toBe("PNG");
    expect(parseLogoDataUri(`data:image/jpeg;base64,${JPEG_B64}`)?.[0]).toBe(0xff);
    expect(parseLogoDataUri(`  DATA:IMAGE/PNG;base64,${PNG_B64}  `)).not.toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["http URL", "https://example.com/logo.png"],
    ["relative path", "/logo.png"],
    ["svg", "data:image/svg+xml;base64,PHN2Zy8+"],
    ["gif", "data:image/gif;base64,R0lGODlhAQABAAAAACw="],
    ["no base64 marker", `data:image/png,${PNG_B64}`],
    ["png label on jpeg bytes", `data:image/png;base64,${JPEG_B64}`],
    ["jpeg label on png bytes", `data:image/jpeg;base64,${PNG_B64}`],
    ["empty payload", "data:image/png;base64,"],
  ])("rejects %s", (_label, value) => {
    expect(parseLogoDataUri(value)).toBeNull();
  });

  it("rejects an image over 2 MB", () => {
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2 * 1024 * 1024)]);
    expect(parseLogoDataUri(`data:image/png;base64,${big.toString("base64")}`)).toBeNull();
  });
});

describe("paperInitials", () => {
  it.each([
    ["Kovács Anna e.v.", "KA"],
    ["Kovács Anna EV", "KA"],
    ["Minta Kft.", "MI"],
    ["Tech Solutions Kft.", "TS"],
    ["Nagy és Társa Bt.", "NÉ"],
    ["InvoHub", "IN"],
    ["  spaced   out  name ", "SO"],
    ["e.v.", "E."],
    ["", "?"],
  ])("%s -> %s", (name, initials) => {
    expect(paperInitials(name)).toBe(initials);
  });
});

describe("paperVariant", () => {
  it("resolves the tokens, the logo spec and the palette from a template", () => {
    const v = paperVariant({ ...DEFAULT_PDF_TEMPLATE, layout: "band", logoSize: "L", logoPosition: "right", accentColor: "#E8590C" });
    expect(v.layout).toBe("band");
    expect(v.tokens).toBe(LAYOUT_TOKENS.band);
    expect(v.logo).toEqual({ mode: "monogram", sizePx: 42, position: "right" });
    expect(v.palette.ink).toBe("#cb4e0a");
  });

  it("only knows the three paper layouts (legacy never reaches it; it degrades to Keretes)", () => {
    expect(Object.keys(LAYOUT_TOKENS).sort()).toEqual(["band", "clean", "frame"]);
    expect(paperVariant({ ...DEFAULT_PDF_TEMPLATE, layout: "legacy" }).layout).toBe("frame");
  });
});
