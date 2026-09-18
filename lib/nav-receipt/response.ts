// lib/nav-receipt/response.ts
// Small, dependency-free NAV eRECEIPT response reader, in the style of
// lib/nav/xml-utils.ts (no XML parser dependency — see plan §3).
import { extractTag } from "@/lib/nav/xml-utils";

export type NavReceiptResponse = {
  resultCode: string | null;
  message: string | null;
} & Record<string, string | null>;

/**
 * Reads `resultCode`/`message`-shaped fields common to NAV eRECEIPT
 * responses, plus any extra named tags the caller asks for — every read is
 * namespace-prefix tolerant (matches both `<resultCode>` and
 * `<ns2:resultCode>`). Never throws: unparseable input (not a string, or a
 * string with no XML tags at all) returns `undefined`, which callers treat
 * as "not a NAV response" — distinct from a well-formed NAV error body.
 */
export function parseNavReceiptResponse(
  xml: unknown,
  extraTags: string[] = []
): NavReceiptResponse | undefined {
  if (typeof xml !== "string" || !xml.includes("<")) return undefined;

  try {
    const resultCode = extractTag(xml, "resultCode");
    const message =
      extractTag(xml, "message") ??
      extractTag(xml, "resultMessage") ??
      extractTag(xml, "technicalErrorMsg") ??
      extractTag(xml, "errorMessage");

    const result: NavReceiptResponse = { resultCode, message };
    for (const tag of extraTags) {
      result[tag] = extractTag(xml, tag);
    }
    return result;
  } catch {
    return undefined;
  }
}
