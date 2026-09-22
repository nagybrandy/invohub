// lib/email/sanitize.test.ts
import { sanitizeHeaderValue } from "@/lib/email/sanitize";

describe("sanitizeHeaderValue", () => {
  it("strips CR/LF to prevent header injection", () => {
    expect(sanitizeHeaderValue("Acme Kft.\r\nBcc: evil@example.com")).toBe(
      "Acme Kft. Bcc: evil@example.com"
    );
  });

  it("strips bare CR and bare LF individually", () => {
    expect(sanitizeHeaderValue("Acme\rKft.\nLtd")).toBe("Acme Kft. Ltd");
  });

  it("strips double quotes (would break a quoted display name)", () => {
    expect(sanitizeHeaderValue('Acme "Kft."')).toBe("Acme Kft.");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeHeaderValue("  Acme Kft.  ")).toBe("Acme Kft.");
  });

  it("preserves Hungarian diacritics — never mangles UTF-8 text", () => {
    expect(sanitizeHeaderValue("Kovács Anna EV — Ügyvezető")).toBe(
      "Kovács Anna EV — Ügyvezető"
    );
  });

  it("collapses a multi-line injection attempt into a single safe line", () => {
    const malicious = "Anna\r\nTo: victim@example.com\r\nSubject: Hacked";
    const result = sanitizeHeaderValue(malicious);
    expect(result).not.toMatch(/[\r\n]/);
    expect(result).toBe("Anna To: victim@example.com Subject: Hacked");
  });
});
