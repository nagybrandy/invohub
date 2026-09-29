// lib/invoices/pdf-brand-mark.test.ts
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VIEWBOX,
  type BrandShape,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";
import { documentInk } from "@/lib/invoices/document-ink";
import {
  BRAND_MARK_PDF_SIZE,
  brandMarkWidth,
  drawBrandMark,
  drawBrandLockup,
} from "@/lib/invoices/pdf-brand-mark";

type Call = { method: string; args: unknown[] };

function makeRecordingDoc() {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return doc;
    };

  const doc = {
    path: record("path"),
    circle: record("circle"),
    translate: record("translate"),
    scale: record("scale"),
    save: record("save"),
    restore: record("restore"),
    lineWidth: record("lineWidth"),
    lineCap: record("lineCap"),
    lineJoin: record("lineJoin"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillColor: record("fillColor"),
    strokeColor: record("strokeColor"),
    // Needed by drawBrandLockup (text layout), unused by drawBrandMark.
    font: record("font"),
    fontSize: record("fontSize"),
    widthOfString: (text: string) => {
      calls.push({ method: "widthOfString", args: [text] });
      return String(text).length * 6;
    },
    currentLineHeight: () => {
      calls.push({ method: "currentLineHeight", args: [] });
      return 10;
    },
    text: record("text"),
  };

  return { doc, calls };
}

function shapesOfKind(shapes: BrandShape[], kind: "path" | "circle") {
  return shapes.filter((s) => s.kind === kind);
}

describe("drawBrandMark", () => {
  const geometry = BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT];

  it("issues every shape of the imported geometry's frame and flow groups (AC2/AC13)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 10,
      y: 20,
      size: BRAND_MARK_PDF_SIZE,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    const pathArgs = calls.filter((c) => c.method === "path").map((c) => c.args[0]);
    const circleArgs = calls
      .filter((c) => c.method === "circle")
      .map((c) => c.args as [number, number, number]);

    const allShapes = [...geometry.frame, ...geometry.flow];
    const expectedPaths = shapesOfKind(allShapes, "path").map((s) => (s as { d: string }).d);
    const expectedCircles = shapesOfKind(allShapes, "circle").map(
      (s) => s as { cx: number; cy: number; r: number }
    );

    expect(pathArgs).toEqual(expectedPaths);
    expect(circleArgs).toEqual(
      expectedCircles.map((c) => [c.cx, c.cy, c.r])
    );
  });

  it("draws frame shapes in the given ink and flow shapes in the given accent (AC3)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 0,
      y: 0,
      size: BRAND_MARK_PDF_SIZE,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    // Walk the calls in order, tracking which ink is "current" for each
    // fillColor/strokeColor call, and confirm the frame shape count worth
    // of paint calls use navy before switching to cornflower for flow.
    const frameShapeCount = geometry.frame.length;
    const paintCalls = calls.filter(
      (c) => c.method === "fillColor" || c.method === "strokeColor"
    );
    const frameInks = paintCalls.slice(0, frameShapeCount).map((c) => c.args[0]);
    const flowInks = paintCalls.slice(frameShapeCount, frameShapeCount + geometry.flow.length)
      .map((c) => c.args[0]);

    expect(frameInks.every((ink) => ink === landingColors.navy)).toBe(true);
    expect(flowInks.every((ink) => ink === landingColors.cornflower)).toBe(true);
  });

  it("strokes a shape with a stroke weight at that lineWidth and never fills it; fills a shape without one and never strokes it (AC4)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 0,
      y: 0,
      size: BRAND_MARK_PDF_SIZE,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    // The rounded direction's flow stripe is stroked at weight 6.5.
    const strokedShape = geometry.flow.find(
      (s) => s.stroke !== undefined
    ) as Extract<BrandShape, { stroke: number }>;
    expect(strokedShape).toBeDefined();
    expect(calls.some((c) => c.method === "lineWidth" && c.args[0] === strokedShape.stroke)).toBe(
      true
    );

    const strokeCount = calls.filter((c) => c.method === "stroke").length;
    const fillCount = calls.filter((c) => c.method === "fill").length;
    const shapesWithStroke = [...geometry.frame, ...geometry.flow].filter(
      (s) => s.stroke !== undefined
    ).length;
    const shapesWithoutStroke = [...geometry.frame, ...geometry.flow].filter(
      (s) => s.stroke === undefined
    ).length;

    expect(strokeCount).toBe(shapesWithStroke);
    expect(fillCount).toBe(shapesWithoutStroke);

    // Round cap/join set for the rounded direction.
    expect(geometry.rounded).toBe(true);
    expect(calls.some((c) => c.method === "lineCap" && c.args[0] === "round")).toBe(true);
    expect(calls.some((c) => c.method === "lineJoin" && c.args[0] === "round")).toBe(true);
  });

  it("respects a per-shape cap override", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 0,
      y: 0,
      size: BRAND_MARK_PDF_SIZE,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    const overriddenCapShapes = [...geometry.frame, ...geometry.flow].filter(
      (s) => s.kind === "path" && s.cap !== undefined
    ) as Extract<BrandShape, { kind: "path"; cap: "round" | "butt" }>[];

    for (const shape of overriddenCapShapes) {
      expect(calls.some((c) => c.method === "lineCap" && c.args[0] === shape.cap)).toBe(true);
    }
  });

  it("leaves the graphics state clean: balanced save/restore, colors reset afterwards (AC5)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 0,
      y: 0,
      size: BRAND_MARK_PDF_SIZE,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    const saveCount = calls.filter((c) => c.method === "save").length;
    const restoreCount = calls.filter((c) => c.method === "restore").length;
    expect(saveCount).toBe(1);
    expect(restoreCount).toBe(1);
    expect(saveCount).toBe(restoreCount);

    // restore() must be the last graphics-state call before the final
    // color reset — no draw call happens after restore().
    const restoreIndex = calls.findIndex((c) => c.method === "restore");
    const drawMethodsAfterRestore = calls
      .slice(restoreIndex + 1)
      .filter((c) => c.method === "path" || c.method === "circle" || c.method === "fill" || c.method === "stroke");
    expect(drawMethodsAfterRestore).toHaveLength(0);

    // Colors reset after the call — the very last fillColor/strokeColor
    // calls put the state back to a neutral default, not left on navy or
    // cornflower.
    const lastFillColor = [...calls].reverse().find((c) => c.method === "fillColor");
    const lastStrokeColor = [...calls].reverse().find((c) => c.method === "strokeColor");
    expect(lastFillColor?.args[0]).not.toBe(landingColors.navy);
    expect(lastFillColor?.args[0]).not.toBe(landingColors.cornflower);
    expect(lastStrokeColor?.args[0]).not.toBe(landingColors.navy);
    expect(lastStrokeColor?.args[0]).not.toBe(landingColors.cornflower);
  });

  it("translates then scales by size / BRAND_MARK_VIEWBOX", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandMark(doc as never, {
      x: 100,
      y: 200,
      size: 18,
      ink: landingColors.navy,
      accent: landingColors.cornflower,
    });

    const translateIndex = calls.findIndex((c) => c.method === "translate");
    const scaleIndex = calls.findIndex((c) => c.method === "scale");
    expect(translateIndex).toBeGreaterThanOrEqual(0);
    expect(scaleIndex).toBeGreaterThan(translateIndex);
    expect(calls[translateIndex]?.args).toEqual([100, 200]);
    expect(calls[scaleIndex]?.args[0]).toBeCloseTo(18 / BRAND_MARK_VIEWBOX);
  });
});

describe("brandMarkWidth", () => {
  it("is square: equal to size", () => {
    expect(brandMarkWidth(18)).toBe(18);
    expect(brandMarkWidth(40)).toBe(40);
  });

  it("defaults to BRAND_MARK_PDF_SIZE", () => {
    expect(brandMarkWidth()).toBe(BRAND_MARK_PDF_SIZE);
  });
});

describe("drawBrandLockup — attribution text ink (AC9/AC10)", () => {
  it("fills the attribution text with documentInk.muted, never the old #8a90a6 (AC9)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandLockup(doc as never, {
      x: 0,
      y: 0,
      text: "InvoHub",
      font: "Regular",
      fontSize: 8,
    });

    const fillColorArgs = calls.filter((c) => c.method === "fillColor").map((c) => c.args[0]);
    expect(fillColorArgs).not.toContain("#8a90a6");
    expect(fillColorArgs).toContain(documentInk.muted);
  });

  it("still restores the fill colour to #000000 as its last colour call (AC10)", () => {
    const { doc, calls } = makeRecordingDoc();

    drawBrandLockup(doc as never, {
      x: 0,
      y: 0,
      text: "InvoHub",
      font: "Regular",
      fontSize: 8,
    });

    const lastFillColor = [...calls].reverse().find((c) => c.method === "fillColor");
    expect(lastFillColor?.args[0]).toBe("#000000");
  });
});

describe("BRAND_MARK_PDF_SIZE", () => {
  it("is 18pt", () => {
    expect(BRAND_MARK_PDF_SIZE).toBe(18);
  });
});
