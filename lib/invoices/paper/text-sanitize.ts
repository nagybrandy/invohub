// lib/invoices/paper/text-sanitize.ts
// The paper fonts (Stack Sans, Source, Nunito) are smaller than the Noto Sans
// the legacy renderer used and lack a few typographic code points that people
// paste into item descriptions, notes and customer names: the non-breaking
// hyphen (U+2011), the narrow no-break space (U+202F), the soft hyphen,
// zero-width characters, the modifier apostrophe (U+02BC) and the numero sign.
// A missing glyph prints a .notdef box, so these are mapped to their plain
// equivalents before measuring and drawing. Applied to the whole paper
// renderer through the pdfkit text path (see render-paper.ts); idempotent.
const MAP: Array<[RegExp, string]> = [
  // hyphen variants -> hyphen-minus
  [/[‐‑‒]/g, "-"],
  // fixed-width / thin / narrow spaces -> plain space (NBSP U+00A0 is covered by every font and stays)
  [/[ -   　]/g, " "],
  // soft hyphen, zero-width and invisible joiners / marks -> nothing
  [/[­​-‍⁠﻿]/g, ""],
  // modifier letter apostrophe -> right single quotation mark
  [/ʼ/g, "’"],
  // numero sign -> "No."
  [/№/g, "No."],
];

export function sanitizePaperText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of MAP) out = out.replace(pattern, replacement);
  return out;
}
