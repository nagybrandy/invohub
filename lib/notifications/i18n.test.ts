// lib/notifications/i18n.test.ts
import {
  decodeNotificationText,
  encodeNotificationText,
  normalizeLegacyNotificationText,
  translateNotificationText,
} from "@/lib/notifications/i18n";

describe("encodeNotificationText / decodeNotificationText", () => {
  it("encodes a bare key with no params", () => {
    expect(encodeNotificationText("notifications.content.navPendingTitle")).toBe(
      "notifications.content.navPendingTitle"
    );
  });

  it("encodes a key + ASCII-space + JSON params", () => {
    const encoded = encodeNotificationText("notifications.content.overdueInvoiceTitle", {
      number: "2026/007",
    });
    expect(encoded).toBe('notifications.content.overdueInvoiceTitle {"number":"2026/007"}');
  });

  it("round-trips a bare key", () => {
    const encoded = encodeNotificationText("notifications.content.navPendingTitle");
    expect(decodeNotificationText(encoded)).toEqual({ key: "notifications.content.navPendingTitle" });
  });

  it("round-trips a key with params", () => {
    const encoded = encodeNotificationText("notifications.content.overdueInvoiceTitle", {
      number: "2026/007",
    });
    expect(decodeNotificationText(encoded)).toEqual({
      key: "notifications.content.overdueInvoiceTitle",
      params: { number: "2026/007" },
    });
  });

  it("decodes a malformed JSON tail to just the key, without throwing", () => {
    expect(() =>
      decodeNotificationText("notifications.content.overdueInvoiceTitle {not json")
    ).not.toThrow();
    expect(decodeNotificationText("notifications.content.overdueInvoiceTitle {not json")).toEqual({
      key: "notifications.content.overdueInvoiceTitle",
    });
  });
});

describe("normalizeLegacyNotificationText", () => {
  const cases: Array<[string, string, Record<string, unknown> | undefined]> = [
    ["Overdue: 2026/007", "notifications.content.overdueInvoiceTitle", { number: "2026/007" }],
    [
      "Kovács Bt. — payment past due date.",
      "notifications.content.overdueInvoiceBody",
      { clientName: "Kovács Bt." },
    ],
    [
      "Budapest Bistro Kft. — payment past due.",
      "notifications.content.overdueInvoiceBody",
      { clientName: "Budapest Bistro Kft." },
    ],
    ["Awaiting payment: 2026/010", "notifications.content.invoiceSentTitle", { number: "2026/010" }],
    ["Sent to Kovács Bt.", "notifications.content.invoiceSentBody", { clientName: "Kovács Bt" }],
    ["NAV submission pending", "notifications.content.navPendingTitle", undefined],
    [
      "2026/010 is waiting for NAV confirmation.",
      "notifications.content.navPendingBody",
      { number: "2026/010" },
    ],
    ["Welcome to InvoHub", "notifications.content.welcomeTitle", undefined],
    [
      "Load demo data from Settings to explore all features.",
      "notifications.content.welcomeBody",
      undefined,
    ],
    ["Payment reminder scheduled", "notifications.content.reminderScheduledTitle", undefined],
    [
      "Automatic reminder will be sent in 7 days.",
      "notifications.content.reminderScheduledBody",
      undefined,
    ],
  ];

  it.each(cases)("maps legacy %j to %s with params %j", (stored, expectedKey, expectedParams) => {
    const normalized = normalizeLegacyNotificationText(stored, "some-ref");
    const decoded = decodeNotificationText(normalized);
    expect(decoded.key).toBe(expectedKey);
    expect(decoded.params).toEqual(expectedParams);
  });

  it("is idempotent: an already-encoded string is returned unchanged", () => {
    const encoded = encodeNotificationText("notifications.content.overdueInvoiceTitle", {
      number: "2026/007",
    });
    expect(normalizeLegacyNotificationText(encoded, "ref")).toBe(encoded);
  });

  it.each([
    ["user-authored text", "Please call the client back tomorrow"],
    ["Hungarian text", "Lejárt: 2026/007"],
    ["empty string", ""],
    ["near-miss: Overdue", "Overdue"],
    ["near-miss: Sent to Kovács Bt (no period)", "Sent to Kovács Bt"],
  ])("returns %s unchanged", (_label, stored) => {
    expect(normalizeLegacyNotificationText(stored, "ref")).toBe(stored);
  });

  it("returns undefined unchanged", () => {
    expect(normalizeLegacyNotificationText(undefined, "ref")).toBeUndefined();
  });

  it("round-trips clientName values with an en dash, a period, and ő/ű, byte-identically", () => {
    const names = ["Kovács Bt.", "Bíró & Társa Kft.", "Tóth Őrs E.V."];
    for (const clientName of names) {
      const legacy = `${clientName} — payment past due date.`;
      const normalized = normalizeLegacyNotificationText(legacy, "ref");
      const decoded = decodeNotificationText(normalized);
      expect(decoded.params?.clientName).toBe(clientName);
    }
  });
});

describe("translateNotificationText", () => {
  function fakeT(key: string, params?: Record<string, unknown>): string {
    return `${key}|${JSON.stringify(params ?? {})}`;
  }

  it("normalizes, decodes, then calls t(key, params) for a legacy string", () => {
    const result = translateNotificationText(fakeT, "Overdue: 2026/007", "overdue:inv-1");
    expect(result).toBe('notifications.content.overdueInvoiceTitle|{"number":"2026/007"}');
  });

  it("decodes and calls t for an already-encoded string", () => {
    const encoded = encodeNotificationText("notifications.content.navPendingTitle");
    const result = translateNotificationText(fakeT, encoded, "nav-pending:sub-1");
    expect(result).toBe("notifications.content.navPendingTitle|{}");
  });

  it("returns an unrecognised string unchanged and never calls t", () => {
    const throwingT = (): string => {
      throw new Error("t must not be called for unrecognised text");
    };
    const result = translateNotificationText(throwingT, "A completely custom note", "ref");
    expect(result).toBe("A completely custom note");
  });

  it("passes through undefined without calling t", () => {
    const throwingT = (): string => {
      throw new Error("t must not be called for undefined");
    };
    expect(translateNotificationText(throwingT, undefined, "ref")).toBeUndefined();
  });
});
