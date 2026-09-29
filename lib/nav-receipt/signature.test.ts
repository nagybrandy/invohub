// lib/nav-receipt/signature.test.ts
import {
  buildReceiptRequestSignature,
  newAuthRequestId,
  newServiceRequestId,
} from "@/lib/nav-receipt/signature";

describe("buildReceiptRequestSignature", () => {
  it("reproduces the NAV eRECEIPT spec's published golden vector", () => {
    // docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md §1.1
    const signature = buildReceiptRequestSignature({
      requestId: "DPrHL3Tr6djsrPt",
      timestamp: new Date("2026-08-24T06:50:53.000Z"),
      signKey: "ce-8f5e-215119fa7dd621DLMRHRLH2S",
    });

    expect(signature).toBe(
      "2FD464BE4D01BE6BB72A30E9AD864BB433D3D253BEFA9FA921316075A1341844" +
        "567CFBC7CBAEB9E20E4723F583DB8962F46054F928FB203EFC6467B77B969625"
    );
    expect(signature).toHaveLength(128);
    expect(signature).toMatch(/^[A-F0-9]{128}$/);
  });

  it("changes when the sign key changes by one character", () => {
    const base = {
      requestId: "DPrHL3Tr6djsrPt",
      timestamp: new Date("2026-08-24T06:50:53.000Z"),
    };
    const a = buildReceiptRequestSignature({ ...base, signKey: "ce-8f5e-215119fa7dd621DLMRHRLH2S" });
    const b = buildReceiptRequestSignature({ ...base, signKey: "ce-8f5e-215119fa7dd621DLMRHRLH2T" });
    expect(a).not.toBe(b);
  });
});

describe("newAuthRequestId", () => {
  it("always matches the legacy requestId pattern, never repeats, never emits '-'", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = newAuthRequestId();
      expect(id).toMatch(/^[+A-Za-z0-9_]{1,30}$/);
      expect(id).not.toContain("-");
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});

describe("newServiceRequestId", () => {
  it("matches the RFC-4122 UUID shape", () => {
    const id = newServiceRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
