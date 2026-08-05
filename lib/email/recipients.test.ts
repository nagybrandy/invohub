// lib/email/recipients.test.ts
import {
  normalizeEmailList,
  validateEmailList,
  validateEmailRecipientsInput,
} from "@/lib/email/recipients";

describe("normalizeEmailList", () => {
  it("parses comma-separated emails", () => {
    expect(normalizeEmailList("a@b.com, c@d.com")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("parses semicolon-separated emails", () => {
    expect(normalizeEmailList("a@b.com; c@d.com")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("deduplicates", () => {
    expect(normalizeEmailList("a@b.com, a@b.com")).toEqual(["a@b.com"]);
  });

  it("handles array input", () => {
    expect(normalizeEmailList(["a@b.com", "c@d.com"])).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("trims whitespace", () => {
    expect(normalizeEmailList("  a@b.com  ,  c@d.com  ")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("filters empty strings", () => {
    expect(normalizeEmailList("a@b.com,,c@d.com,")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });
});

describe("validateEmailList", () => {
  it("accepts valid emails", () => {
    expect(validateEmailList(["user@example.com"])).toBeNull();
  });

  it("rejects invalid emails", () => {
    expect(validateEmailList(["not-an-email"])).toBeTruthy();
  });

  it("returns null for empty list (no emails = nothing invalid)", () => {
    expect(validateEmailList([])).toBeNull();
  });
});

describe("validateEmailRecipientsInput", () => {
  it("validates to field with valid email", () => {
    const result = validateEmailRecipientsInput("to", "user@example.com");
    expect(result).toBeNull();
  });

  it("rejects invalid email in field", () => {
    const result = validateEmailRecipientsInput("to", "not-an-email");
    expect(result).toContain("to");
  });

  it("returns null for undefined input", () => {
    const result = validateEmailRecipientsInput("cc", undefined);
    expect(result).toBeNull();
  });
});
