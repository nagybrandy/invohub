// __tests__/helpers/pdf-recorder.ts
// Renders an invoice through the REAL generateInvoicePdf (real pdfkit, real
// fonts) while recording what was drawn: every text string, every filled /
// stroked shape with its colour, every image, every page. Used by the paper
// renderer tests and the mandatory-content matrix (docs/design/
// invoice-paper-2026-11/PLAN.md §9.8-9.9).
import * as pdfDocumentModule from "@/lib/invoices/pdf-document";
import { generateInvoicePdf, type InvoicePdfContext } from "@/lib/invoices/generate-pdf";

export type RecordedShape = {
  kind: "rect" | "roundedRect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  page: number;
  /** "fill" | "stroke", with the colour that was current when it was painted. */
  paint?: "fill" | "stroke";
  color?: string;
};

export type RecordedText = {
  text: string;
  x: number;
  y: number;
  page: number;
  fontSize: number;
  font: string;
  color: string;
  options: Record<string, unknown>;
};

export type PdfRecording = {
  pdf: Buffer;
  texts: RecordedText[];
  /** Just the strings, in drawing order. */
  strings: string[];
  shapes: RecordedShape[];
  images: Array<{ page: number; x: number; y: number; options: Record<string, unknown> }>;
  fillOpacities: number[];
  rotations: number[];
  pageCount: number;
};

type AnyDoc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function renderRecorded(ctx: InvoicePdfContext): Promise<PdfRecording> {
  const texts: RecordedText[] = [];
  const shapes: RecordedShape[] = [];
  const images: PdfRecording["images"] = [];
  const fillOpacities: number[] = [];
  const rotations: number[] = [];
  let pageCount = 0;

  const original = pdfDocumentModule.createPdfDocument;
  const spy = jest.spyOn(pdfDocumentModule, "createPdfDocument").mockImplementation((options) => {
    const doc = original(options) as unknown as AnyDoc;
    pageCount = 1;
    let pageIndex = 0;
    let pendingShape: RecordedShape | null = null;
    let fillColor = "#000000";
    let strokeColor = "#000000";
    doc.on("pageAdded", () => {
      pageCount += 1;
      pageIndex = pageCount - 1;
    });
    const wrap = (name: string, fn: (orig: (...a: unknown[]) => unknown, args: unknown[]) => void) => {
      const orig = doc[name].bind(doc);
      doc[name] = (...args: unknown[]) => {
        fn(orig, args);
        return orig(...args);
      };
    };

    wrap("fillColor", (_o, args) => {
      if (typeof args[0] === "string") fillColor = args[0];
    });
    wrap("strokeColor", (_o, args) => {
      if (typeof args[0] === "string") strokeColor = args[0];
    });
    wrap("fillOpacity", (_o, args) => fillOpacities.push(Number(args[0])));
    wrap("rotate", (_o, args) => rotations.push(Number(args[0])));
    wrap("rect", (_o, args) => {
      const [x, y, w, h] = args as number[];
      pendingShape = { kind: "rect", x: x!, y: y!, w: w!, h: h!, page: pageIndex };
    });
    wrap("roundedRect", (_o, args) => {
      const [x, y, w, h, r] = args as number[];
      pendingShape = { kind: "roundedRect", x: x!, y: y!, w: w!, h: h!, radius: r, page: pageIndex };
    });
    wrap("fill", (_o, args) => {
      if (pendingShape) {
        shapes.push({ ...pendingShape, paint: "fill", color: typeof args[0] === "string" ? args[0] : fillColor });
        pendingShape = null;
      }
      if (typeof args[0] === "string") fillColor = args[0];
    });
    wrap("stroke", () => {
      if (pendingShape) {
        shapes.push({ ...pendingShape, paint: "stroke", color: strokeColor });
        pendingShape = null;
      }
    });
    wrap("image", (_o, args) => {
      images.push({
        page: pageIndex,
        x: args[1] as number,
        y: args[2] as number,
        options: (args[3] ?? {}) as Record<string, unknown>,
      });
    });
    wrap("text", (_o, args) => {
      const value = String(args[0]);
      const x = typeof args[1] === "number" ? args[1] : doc.x;
      const y = typeof args[2] === "number" ? args[2] : doc.y;
      const options = (typeof args[1] === "object" ? args[1] : (args[3] ?? {})) as Record<string, unknown>;
      texts.push({
        text: value,
        x,
        y,
        page: pageIndex,
        fontSize: doc._fontSize,
        font: doc._font?.name ?? "",
        color: fillColor,
        options,
      });
    });
    return doc as never;
  });

  try {
    const pdf = await generateInvoicePdf(ctx);
    return {
      pdf,
      texts,
      strings: texts.map((t) => t.text),
      shapes,
      images,
      fillOpacities,
      rotations,
      pageCount,
    };
  } finally {
    spy.mockRestore();
  }
}

/** Upper-cases and strips a trailing colon, so captions compare across renderers. */
export function normalizeDrawn(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/:$/, "").toUpperCase();
}
