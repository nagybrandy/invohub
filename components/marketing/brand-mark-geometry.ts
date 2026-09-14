// components/marketing/brand-mark-geometry.ts
// Hand-drawn geometry for the InvoHub mark, in two parallel design directions.
//
// CONCEPT (shared by both directions) — "the open ledger hub".
// Two mirrored corner brackets describe a square frame: the ledger page. The
// two corners on the 45° axis are left OPEN, so the frame reads as a gateway
// rather than a closed box. A hub sits at the centre, and two links spring from
// it out through both gates — value enters through one gate, is recorded at the
// hub, and leaves through the other.
//
// The letterform reading: the brackets' two upright arms are the stems of an
// **H**, the link stroke crossing between them is its crossbar, and that same
// stroke running through the hub is the **I** — I and H sharing one diagonal.
//
// The whole composition sits on the single diagonal x + y = 48, which is also
// what lets the mark tile: repeated, neighbouring links meet end to end and
// form continuous diagonal chains with no visible seam.
//
// Both directions share the same edge treatment: each bracket end is cut along
// a line PARALLEL to the flow stripe, so the two walls run flush alongside it.
//
// TWO DIRECTIONS, pending the brand owner's choice:
//   angular — sharp corners, square-cut stripe. Technical and precise.
//   rounded — the same composition softened: generously rounded bracket corners,
//             a round-capped stripe, and a round hub swelling at the centre —
//             the "button" that gives the mark its figure-like impression.
//
// Both are kept on disk so they can be compared:
//   assets/brand/directions/angular/*  ·  assets/brand/directions/rounded/*
//   marketing/brand-directions.html    ·  side-by-side comparison page
// `assets/brand/mark.svg` and `mark-pattern.svg` mirror BRAND_MARK_DEFAULT.

/** viewBox edge of the standalone mark (square). */
export const BRAND_MARK_VIEWBOX = 48;

/** viewBox edge of the repeating texture tile (square). */
export const BRAND_TILE_VIEWBOX = 96;

export type BrandMarkVariant = "angular" | "rounded";

/** Wired into the app and the marketing site until the direction is chosen. */
export const BRAND_MARK_DEFAULT: BrandMarkVariant = "rounded";

/**
 * One drawn element. `stroke` absent means the shape is filled; present means it
 * is stroked at that weight. Keeping both directions in one shape lets a single
 * component render either without branching on the variant.
 */
export type BrandShape =
  | { kind: "path"; d: string; stroke?: number; cap?: "round" | "butt" }
  | { kind: "circle"; cx: number; cy: number; r: number; stroke?: number };

export type BrandMarkGeometry = {
  /** Drawn in the structural ink (white on navy, navy on light). */
  frame: BrandShape[];
  /** Drawn in the accent ink (cornflower), or in the structural ink when mono. */
  flow: BrandShape[];
  /** Round joins/caps for the whole mark. */
  rounded: boolean;
};

export type BrandTileGeometry = {
  shapes: BrandShape[];
  rounded: boolean;
};

/* ------------------------------------------------------------------ angular */

// Brackets: sharp-cornered L-walls on the outer box 6..42 with a 7-unit wall.
// Both ends are cut along `x + y = 38` (mirror: 58) — lines PARALLEL to the flow
// stripe's own axis (x + y = 48) — so each wall runs flush alongside the stripe
// with a constant 4.07-unit channel. Same edge treatment as direction B; only
// the corners stay rectilinear.
//
// Flow: one uniform stripe of the same 7-unit weight on x + y = 48, its ends cut
// square along the same 45° direction as the walls.
const ANGULAR_MARK: BrandMarkGeometry = {
  rounded: false,
  frame: [
    { kind: "path", d: "M32 6H6V32L13 25V13H25Z" },
    { kind: "path", d: "M16 42H42V16L35 23V35H23Z" },
  ],
  flow: [
    { kind: "path", d: "M7.025 36.025L36.025 7.025L40.975 11.975L11.975 40.975Z" },
  ],
};

const ANGULAR_TILE: BrandTileGeometry = {
  rounded: false,
  shapes: [
    { kind: "path", d: "M0 48L48 0M0 96L96 0M48 96L96 48", stroke: 2, cap: "butt" },
    { kind: "path", d: "M32 6H6V32M16 42H42V16", stroke: 2 },
    { kind: "path", d: "M80 54H54V80M64 90H90V64", stroke: 2 },
    { kind: "path", d: "M19 19H25.5L29 22.5V29H22.5L19 25.5Z" },
    { kind: "path", d: "M67 67H73.5L77 70.5V77H70.5L67 73.5Z" },
    { kind: "path", d: "M19 67H25.5L29 70.5V77H22.5L19 73.5Z" },
    { kind: "path", d: "M67 19H73.5L77 22.5V29H70.5L67 25.5Z" },
  ],
};

/* ------------------------------------------------------------------ rounded */

// Brackets: filled L-walls on the outer box 6..42 with a 7-unit wall, a 12-unit
// outer corner radius and a concentric 5-unit inner radius. Both ends are cut
// along `x + y = 36` (mirror: 60) — lines PARALLEL to the flow stripe's own axis
// (x + y = 48) — so each wall runs flush alongside the stripe instead of meeting
// it at a mismatched angle. The cut sits two units further out than direction
// A's so the hub below has room to swell without pinching the channel.
//
// Flow: one uniform round-capped stripe of the same 7-unit weight on x + y = 48,
// with a round hub swelling at the centre. The hub is the "button" that keeps
// the mark from reading as a plain rounded slash, and it is what gives the mark
// its head-and-body, figure-like impression.
const ROUNDED_MARK: BrandMarkGeometry = {
  rounded: true,
  frame: [
    { kind: "path", d: "M30 6H18A12 12 0 0 0 6 18V30L13 23V18A5 5 0 0 1 18 13H23Z" },
    { kind: "path", d: "M18 42H30A12 12 0 0 0 42 30V18L35 25V30A5 5 0 0 1 30 35H25Z" },
  ],
  flow: [
    { kind: "path", d: "M9.5 38.5L38.5 9.5", stroke: 7 },
    { kind: "circle", cx: 24, cy: 24, r: 5.5 },
  ],
};

// Texture weight: the brackets collapse to their centrelines (box 9.5..38.5,
// corner radius 8.5, cut at x + y = 36) and the flow stripe becomes the chain.
// The hubs stay as dots, echoing the mark's own centre button.
const ROUNDED_TILE: BrandTileGeometry = {
  rounded: true,
  shapes: [
    { kind: "path", d: "M0 48L48 0M0 96L96 0M48 96L96 48", stroke: 2, cap: "butt" },
    { kind: "path", d: "M26.5 9.5H18A8.5 8.5 0 0 0 9.5 18V26.5", stroke: 2 },
    { kind: "path", d: "M21.5 38.5H30A8.5 8.5 0 0 0 38.5 30V21.5", stroke: 2 },
    { kind: "path", d: "M74.5 57.5H66A8.5 8.5 0 0 0 57.5 66V74.5", stroke: 2 },
    { kind: "path", d: "M69.5 86.5H78A8.5 8.5 0 0 0 86.5 78V69.5", stroke: 2 },
    { kind: "circle", cx: 24, cy: 24, r: 3 },
    { kind: "circle", cx: 72, cy: 72, r: 3 },
    { kind: "circle", cx: 24, cy: 72, r: 3 },
    { kind: "circle", cx: 72, cy: 24, r: 3 },
  ],
};

/* ----------------------------------------------------------------- registry */

export const BRAND_MARK_GEOMETRY: Record<BrandMarkVariant, BrandMarkGeometry> = {
  angular: ANGULAR_MARK,
  rounded: ROUNDED_MARK,
};

export const BRAND_TILE_GEOMETRY: Record<BrandMarkVariant, BrandTileGeometry> = {
  angular: ANGULAR_TILE,
  rounded: ROUNDED_TILE,
};

export const BRAND_MARK_VARIANTS: BrandMarkVariant[] = ["angular", "rounded"];
