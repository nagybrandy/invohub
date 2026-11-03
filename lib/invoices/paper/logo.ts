// lib/invoices/paper/logo.ts
// Logo helpers of the paper renderer.
//
// "Saját logó" draws company.logoUrl ONLY when it is a data:image/png or
// data:image/jpeg URI (pdfkit cannot draw SVG, and the server must never fetch
// an arbitrary URL while rendering a legal document); anything else falls back
// to the monogram. Upload UI and storage are a separate item.

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte);
}

/** The decoded PNG / JPEG bytes of a data: URI, or null for anything else. */
export function parseLogoDataUri(logoUrl: string | undefined): Buffer | null {
  if (!logoUrl) return null;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(logoUrl.trim());
  if (!match) return null;
  const kind = match[1]!.toLowerCase();
  const buffer = Buffer.from(match[2]!.replace(/\s+/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) return null;
  // The declared type must match the bytes (a mislabelled file is not drawn).
  if (kind === "png" && !startsWith(buffer, PNG_SIGNATURE)) return null;
  if (kind === "jpeg" && !startsWith(buffer, [0xff, 0xd8, 0xff])) return null;
  return buffer;
}

// Hungarian company-form suffixes the monogram ignores.
const COMPANY_FORM_RE = /^(e\.?\s?v\.?|kft\.?|zrt\.?|bt\.?|nyrt\.?|kkt\.?|ev\.?)$/i;

/**
 * Monogram letters: the first letters of the first two words of the name
 * without its company form ("Kovács Anna e.v." -> "KA", "Minta Kft." -> "MI").
 */
export function paperInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word && !COMPANY_FORM_RE.test(word));
  const significant = words.length > 0 ? words : name.trim().split(/\s+/).filter(Boolean);
  if (significant.length === 0) return "?";
  if (significant.length === 1) return significant[0]!.slice(0, 2).toUpperCase();
  return `${significant[0]![0] ?? ""}${significant[1]![0] ?? ""}`.toUpperCase();
}
