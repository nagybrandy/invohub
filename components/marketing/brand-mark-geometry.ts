// components/marketing/brand-mark-geometry.ts
// Hand-drawn geometry for the InvoHub mark, in two parallel design directions.
//
// CONCEPT (shared by both directions) — "the open ledger hub".
// Two mirrored corner brackets describe a square frame: the ledger page. The
// two corners on the 45° axis are left OPEN, so the frame reads as a gateway
// rather than a closed box. One flow stripe runs the whole diagonal through both
// gates — value enters through one gate, is recorded at the hub in the middle,
// and leaves through the other.
//
// TWO READINGS, both deliberate:
//   Two figures — each bracket is a curled body carrying its own round head, so
//     the pair reads as two people either side of the flow. (Chosen direction
//     only; the heads are what make this legible at a glance.)
//   H and I — the two bracket uprights, at the far left and far right, are the
//     stems of an H and the stripe crossing between them is its crossbar; that
//     same stripe, with the hub button on it, is the I.
//
// The whole composition sits on the single diagonal x + y = 48, which is also
// what lets the mark tile: repeated, neighbouring stripes meet end to end and
// form continuous diagonal chains with no visible seam.
//
// Both directions share the same edge treatment: each bracket end is cut along
// a line PARALLEL to the flow stripe, so the two walls run flush alongside it.
//
//   rounded — THE CHOSEN DIRECTION. Rounded bracket corners, each carrying its
//             own round head so the mark reads as two figures; a round-capped
//             stripe with a hub button at the centre.
//   angular — archived alternative. Sharp corners, square-cut stripe, no heads.
//             Kept on disk and buildable, but no longer the default.
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

/**
 * The chosen brand direction, wired into the app and the marketing site.
 * `angular` remains available as an archived alternative.
 */
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

// THE SELECTED DIRECTION.
//
// Two figures, one stripe. Each bracket is a filled L-wall carrying its own
// round head in the crook — head plus curled body, so the mark reads as two
// small figures facing each other across the stripe rather than as one abstract
// frame. Because the heads are in the FRAME ink and the stripe is in the ACCENT
// ink, the two readings separate at a glance even at small sizes.
//
// Geometry: outer box 4..44 (larger than direction A's, so the parts stay
// legible small), 7-unit wall, 14-unit outer corner radius with a concentric
// 7-unit inner radius. Both bracket ends are cut along `x + y = 34`
// (mirror: 62) — lines PARALLEL to the flow stripe's own axis (x + y = 48) — so
// each wall runs flush alongside the stripe. The channel is wide (6.7 units) so
// walls, heads and stripe never merge into one blob.
//
// Flow: a 6.5-unit round-capped stripe on x + y = 48, swelling into a 5.5-unit
// hub button at the centre. Stripe plus button is the I; the two bracket
// uprights at the far left and far right are the stems of the H, with the
// stripe crossing between them as its crossbar.
const ROUNDED_MARK: BrandMarkGeometry = {
  rounded: true,
  frame: [
    { kind: "path", d: "M30 4H18A14 14 0 0 0 4 18V30L11 23V18A7 7 0 0 1 18 11H23Z" },
    { kind: "path", d: "M18 44H30A14 14 0 0 0 44 30V18L37 25V30A7 7 0 0 1 30 37H25Z" },
    // The two heads.
    { kind: "circle", cx: 17.5, cy: 17.5, r: 4.4 },
    { kind: "circle", cx: 30.5, cy: 30.5, r: 4.4 },
  ],
  flow: [
    { kind: "path", d: "M7 41L41 7", stroke: 6.5 },
    { kind: "circle", cx: 24, cy: 24, r: 5.5 },
  ],
};

// Texture weight: the brackets collapse to their centrelines (box 7.5..40.5,
// corner radius 10.5, cut at x + y = 34) and the flow stripe becomes the chain.
// The heads are dropped — at hairline weight they would read as noise — and the
// hub dots carry the motif.
const ROUNDED_TILE: BrandTileGeometry = {
  rounded: true,
  shapes: [
    { kind: "path", d: "M0 48L48 0M0 96L96 0M48 96L96 48", stroke: 2, cap: "butt" },
    { kind: "path", d: "M26.5 7.5H18A10.5 10.5 0 0 0 7.5 18V26.5", stroke: 2 },
    { kind: "path", d: "M21.5 40.5H30A10.5 10.5 0 0 0 40.5 30V21.5", stroke: 2 },
    { kind: "path", d: "M74.5 55.5H66A10.5 10.5 0 0 0 55.5 66V74.5", stroke: 2 },
    { kind: "path", d: "M69.5 88.5H78A10.5 10.5 0 0 0 88.5 78V69.5", stroke: 2 },
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
