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
// TWO DIRECTIONS, pending the brand owner's choice:
//   angular — the first cut. Chamfered, mitred, drawn entirely as filled paths.
//             Sharp and technical.
//   rounded — the same composition softened: generously rounded bracket corners
//             and one uniform round-capped flow stripe, with each bracket cut
//             parallel to that stripe so the walls run flush alongside it.
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

const ANGULAR_MARK: BrandMarkGeometry = {
  rounded: false,
  frame: [
    // Corner brackets: chamfered square minus its two chamfer walls.
    { kind: "path", d: "M30 6H6V30L13 27.1V13H27.1Z" },
    { kind: "path", d: "M18 42H42V18L35 20.9V35H20.9Z" },
  ],
  flow: [
    // Hub: a self-similar chamfered square.
    { kind: "path", d: "M19 19H25.5L29 22.5V29H22.5L19 25.5Z" },
    // Links: mitred bars springing from the hub's own chamfered faces.
    { kind: "path", d: "M25.5 19L37.25 7.25L40.75 10.75L29 22.5Z" },
    { kind: "path", d: "M22.5 29L10.75 40.75L7.25 37.25L19 25.5Z" },
  ],
};

const ANGULAR_TILE: BrandTileGeometry = {
  rounded: false,
  shapes: [
    { kind: "path", d: "M0 48L48 0M0 96L96 0M48 96L96 48", stroke: 2, cap: "butt" },
    { kind: "path", d: "M30 6H6V30M18 42H42V18", stroke: 2 },
    { kind: "path", d: "M78 54H54V78M66 90H90V66", stroke: 2 },
    { kind: "path", d: "M19 19H25.5L29 22.5V29H22.5L19 25.5Z" },
    { kind: "path", d: "M67 67H73.5L77 70.5V77H70.5L67 73.5Z" },
    { kind: "path", d: "M19 67H25.5L29 70.5V77H22.5L19 73.5Z" },
    { kind: "path", d: "M67 19H73.5L77 22.5V29H70.5L67 25.5Z" },
  ],
};

/* ------------------------------------------------------------------ rounded */

// Brackets: filled L-walls on the outer box 6..42 with a 7-unit wall, a 12-unit
// outer corner radius and a concentric 5-unit inner radius. Both ends are cut
// along `x + y = 38` — a line PARALLEL to the flow stripe's own axis
// (x + y = 48) — so each wall runs flush alongside the stripe with a constant
// 4.07-unit channel, instead of meeting it at a mismatched angle. The mirrored
// bracket is cut along x + y = 58.
//
// Flow: one uniform round-capped stripe of the same 7-unit weight, centred on
// x + y = 48. Deliberately unswollen — a bulging hub would pinch the channel
// and break the parallel reading. The hub is where the two gates' flows meet at
// the centre of the stripe.
const ROUNDED_MARK: BrandMarkGeometry = {
  rounded: true,
  frame: [
    { kind: "path", d: "M32 6H18A12 12 0 0 0 6 18V32L13 25V18A5 5 0 0 1 18 13H25Z" },
    { kind: "path", d: "M16 42H30A12 12 0 0 0 42 30V16L35 23V30A5 5 0 0 1 30 35H23Z" },
  ],
  flow: [{ kind: "path", d: "M9.5 38.5L38.5 9.5", stroke: 7 }],
};

// Texture weight: the brackets collapse to their centrelines (box 9.5..38.5,
// corner radius 8.5) and the flow stripe becomes the continuous chain.
const ROUNDED_TILE: BrandTileGeometry = {
  rounded: true,
  shapes: [
    { kind: "path", d: "M0 48L48 0M0 96L96 0M48 96L96 48", stroke: 2, cap: "butt" },
    { kind: "path", d: "M28.5 9.5H18A8.5 8.5 0 0 0 9.5 18V28.5", stroke: 2 },
    { kind: "path", d: "M19.5 38.5H30A8.5 8.5 0 0 0 38.5 30V19.5", stroke: 2 },
    { kind: "path", d: "M76.5 57.5H66A8.5 8.5 0 0 0 57.5 66V76.5", stroke: 2 },
    { kind: "path", d: "M67.5 86.5H78A8.5 8.5 0 0 0 86.5 78V67.5", stroke: 2 },
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
