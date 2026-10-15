// lib/nav/status-messages.test.ts
import { parseTransactionStatusMessages } from "@/lib/nav/status-messages";
import { extractAllBlocks } from "@/lib/nav/xml-utils";

const RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<QueryTransactionStatusResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <processingResults>
    <processingResult>
      <index>1</index>
      <invoiceStatus>ABORTED</invoiceStatus>
      <technicalValidationMessages>
        <validationResultCode>ERROR</validationResultCode>
        <message>XML contains on line: [17] and column: [24] error: [cvc-complex-type.2.4.a: Invalid content was found]</message>
      </technicalValidationMessages>
      <technicalValidationMessages>
        <validationResultCode>ERROR</validationResultCode>
        <message>Xml validation failed</message>
      </technicalValidationMessages>
      <businessValidationMessages>
        <validationResultCode>ERROR</validationResultCode>
        <validationErrorCode>INVALID_LINE_OPERATION</validationErrorCode>
        <message>A tétel művelete nem megfelelő.</message>
        <pointer>
          <tag>lineOperation</tag>
          <value>MODIFY</value>
          <line>1</line>
        </pointer>
      </businessValidationMessages>
      <businessValidationMessages>
        <validationResultCode>WARN</validationResultCode>
        <validationErrorCode>INCORRECT_SUPPLIER_ADDRESS</validationErrorCode>
        <message>A szállító címe hiányos.</message>
      </businessValidationMessages>
    </processingResult>
  </processingResults>
</QueryTransactionStatusResponse>`;

describe("parseTransactionStatusMessages — nothing NAV says gets dropped", () => {
  it("keeps technical messages and renders each business message with its code, text and pointer", () => {
    expect(parseTransactionStatusMessages(RESPONSE)).toEqual([
      "XML contains on line: [17] and column: [24] error: [cvc-complex-type.2.4.a: Invalid content was found]",
      "Xml validation failed",
      "Üzleti validáció (ERROR) INVALID_LINE_OPERATION: A tétel művelete nem megfelelő. [lineOperation = MODIFY, sor 1]",
      "Üzleti validáció (WARN) INCORRECT_SUPPLIER_ADDRESS: A szállító címe hiányos.",
    ]);
  });

  it("does not list a business message's text a second time as a technical one", () => {
    const lines = parseTransactionStatusMessages(RESPONSE);
    expect(lines.filter((l) => l.includes("A tétel művelete"))).toHaveLength(1);
  });

  it("handles namespace prefixes and a response with no messages", () => {
    const prefixed = RESPONSE.replace(/<(\/?)(\w)/g, "<$1ns2:$2").replace(/xmlns=/, "xmlns:ns2=");
    expect(parseTransactionStatusMessages(prefixed)).toHaveLength(4);
    expect(extractAllBlocks(prefixed, "businessValidationMessages")).toHaveLength(2);
    expect(parseTransactionStatusMessages("<r><processingResult><invoiceStatus>DONE</invoiceStatus></processingResult></r>")).toEqual([]);
  });
});
