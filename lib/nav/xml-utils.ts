// lib/nav/xml-utils.ts
// Small, dependency-free XML helpers shared by the request builders and the
// (regex-based) response readers. NAV responses are well-formed and don't
// nest same-named tags in the paths we read, so a full DOM parser isn't
// needed for this MVP — see docs/nav-test-setup.md "verify against XSD".

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** First `<tag>` (optionally namespace-prefixed) text content, or null. */
export function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`);
  const match = xml.match(re);
  return match ? match[1].trim() : null;
}

/** All `<tag>` (optionally namespace-prefixed) text contents, in document order. */
export function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`, "g");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    out.push(match[1].trim());
  }
  return out;
}

/** First `<tag ...>...</tag>` block, including the tags themselves, or null. */
export function extractBlock(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/(?:[a-zA-Z0-9]+:)?${tag}>`);
  const match = xml.match(re);
  return match ? match[0] : null;
}
