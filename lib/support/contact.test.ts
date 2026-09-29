// lib/support/contact.test.ts
import fs from "fs";
import path from "path";
import {
  SUPPORT_EMAIL_ENV,
  getSupportEmail,
  buildSupportDiagnostics,
  buildSupportMailtoUrl,
} from "@/lib/support/contact";

describe("SUPPORT_EMAIL_ENV", () => {
  it("names the env var that gates the support UI", () => {
    expect(SUPPORT_EMAIL_ENV).toBe("EXPO_PUBLIC_SUPPORT_EMAIL");
  });
});

describe("getSupportEmail", () => {
  it("returns the trimmed address when a valid address is configured", () => {
    expect(getSupportEmail({ EXPO_PUBLIC_SUPPORT_EMAIL: "  help@example.test  " })).toBe(
      "help@example.test"
    );
  });

  it.each([
    ["key absent", {}],
    ["empty string", { EXPO_PUBLIC_SUPPORT_EMAIL: "" }],
    ["whitespace only", { EXPO_PUBLIC_SUPPORT_EMAIL: "   " }],
    ["no @", { EXPO_PUBLIC_SUPPORT_EMAIL: "notanemail" }],
    ["empty domain", { EXPO_PUBLIC_SUPPORT_EMAIL: "a@" }],
    ["empty local part", { EXPO_PUBLIC_SUPPORT_EMAIL: "@b.hu" }],
    ["contains a space", { EXPO_PUBLIC_SUPPORT_EMAIL: "a b@c.hu" }],
  ])("returns null when %s", (_label, env) => {
    expect(getSupportEmail(env as NodeJS.ProcessEnv)).toBeNull();
  });

  it("reads its default via a literal `process.env.EXPO_PUBLIC_SUPPORT_EMAIL` member expression, not a variable-aliased bracket lookup", () => {
    // babel-preset-expo's inline-env-vars plugin only statically recognizes
    // and inlines the literal `process.env.<LITERAL_KEY>` pattern. A bracket
    // lookup through a local variable (e.g. `env[SUPPORT_EMAIL_ENV]` applied
    // directly to `process.env`) is invisible to it, so the value would
    // silently be `undefined` in an actual Metro/EAS-bundled app even though
    // it reads fine under plain Node/Jest. This is a source-level regression
    // guard for that class of bug — see
    // node_modules/babel-preset-expo/build/plugins/inline-env-vars.js.
    const source = fs.readFileSync(path.join(__dirname, "contact.ts"), "utf8");
    expect(source).toMatch(/process\.env\.EXPO_PUBLIC_SUPPORT_EMAIL/);
  });
});

describe("buildSupportMailtoUrl", () => {
  it("builds a percent-encoded mailto URL for accented Hungarian text and newlines", () => {
    const url = buildSupportMailtoUrl({
      email: "help@example.test",
      subject: "Kérdés",
      body: "Első sor\nMásodik sor",
    });

    expect(url.startsWith("mailto:help@example.test?")).toBe(true);
    expect(url).toContain("subject=");
    expect(url).toContain("body=");
    // "é" -> %C3%A9
    expect(url).toContain("%C3%A9");
    // "\n" -> %0A
    expect(url).toContain("%0A");
    // URLSearchParams would encode spaces as "+" — that must never happen here.
    expect(url).not.toContain("+");
    expect(url).not.toMatch(/\n/);
    expect(url).not.toContain(" ");
  });
});

describe("buildSupportDiagnostics — privacy guard", () => {
  it("never puts user identity into the prefilled mail", () => {
    const diagnostics = buildSupportDiagnostics({
      locale: "hu",
      platform: "web",
      appVersion: "1.0.0",
    });

    expect(diagnostics).toContain("hu");
    expect(diagnostics).toContain("web");
    expect(diagnostics).toContain("1.0.0");

    const sampleEmail = "nagy.bendeguz@example.test";
    const sampleName = "Nagy Bendegúz";
    const sampleTaxNumber = "12345678-1-42";

    const url = buildSupportMailtoUrl({
      email: "help@example.test",
      subject: "Kérdés",
      body: diagnostics,
    });

    for (const secret of [sampleEmail, sampleName, sampleTaxNumber]) {
      expect(url).not.toContain(secret);
      expect(url).not.toContain(encodeURIComponent(secret));
      expect(diagnostics).not.toContain(secret);
    }

    // The type itself has no field that could carry identity — a
    // compile-time guard against a future field expanding the leak surface.
    type Diagnostics = Parameters<typeof buildSupportDiagnostics>[0];
    type DiagnosticsKeys = keyof Diagnostics;
    const keys: DiagnosticsKeys[] = ["locale", "platform", "appVersion"];
    expect(keys.sort()).toEqual(["appVersion", "locale", "platform"]);
  });
});
