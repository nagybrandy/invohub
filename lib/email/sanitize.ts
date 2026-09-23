// lib/email/sanitize.ts
// Strips characters that could be used for SMTP header injection (CR/LF —
// a newline in a From display name or Reply-To value could inject extra
// headers like a forged Bcc:) or that would break a quoted display name
// ("), from any value that ends up in an e-mail header. Never strips
// non-ASCII text — Hungarian company/contact names (Kovács, Ügyvezető, …)
// must survive unchanged.
const HEADER_INJECTION_PATTERN = /[\r\n]+/g;
const QUOTE_PATTERN = /"/g;

export function sanitizeHeaderValue(value: string): string {
  return value
    .replace(HEADER_INJECTION_PATTERN, " ")
    .replace(QUOTE_PATTERN, "")
    .trim();
}
