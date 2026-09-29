// lib/nav-receipt/response.test.ts
import { parseNavReceiptResponse } from "@/lib/nav-receipt/response";

describe("parseNavReceiptResponse", () => {
  it("reads resultCode/message with no namespace prefix", () => {
    const xml = "<Response><resultCode>OK</resultCode><message>All good</message></Response>";
    const result = parseNavReceiptResponse(xml);
    expect(result?.resultCode).toBe("OK");
    expect(result?.message).toBe("All good");
  });

  it("reads resultCode/message through a namespace prefix", () => {
    const xml =
      '<ns2:Response xmlns:ns2="http://schemas.nav.gov.hu/NTCA/1.0/receipt">' +
      "<ns2:resultCode>OK</ns2:resultCode><ns2:message>All good</ns2:message>" +
      "</ns2:Response>";
    const result = parseNavReceiptResponse(xml);
    expect(result?.resultCode).toBe("OK");
    expect(result?.message).toBe("All good");
  });

  it("reads named extra tags, prefix-tolerant", () => {
    const xml = "<Response><ns2:token>tok-123</ns2:token><ns2:validTo>2026-09-18T10:00:00Z</ns2:validTo></Response>";
    const result = parseNavReceiptResponse(xml, ["token", "validTo"]);
    expect(result?.token).toBe("tok-123");
    expect(result?.validTo).toBe("2026-09-18T10:00:00Z");
  });

  it("returns undefined rather than throwing on unparseable input", () => {
    expect(parseNavReceiptResponse("not xml at all")).toBeUndefined();
    expect(parseNavReceiptResponse("")).toBeUndefined();
    expect(parseNavReceiptResponse(undefined as unknown as string)).toBeUndefined();
    expect(parseNavReceiptResponse(null as unknown as string)).toBeUndefined();
  });
});
