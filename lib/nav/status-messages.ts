// lib/nav/status-messages.ts
// Turns a queryTransactionStatus response into the lines the invoice detail
// screen shows. NAV answers with two kinds of blocks under processingResult:
//   <technicalValidationMessages> — validationResultCode + message (XSD errors)
//   <businessValidationMessages>  — validationResultCode + validationErrorCode
//                                   + message + pointer{tag,value,line}
// The first live rejection (2026-10-14) showed five bare "Üzleti validáció:
// ERROR" lines: the error code, the text and the pointer were all dropped,
// so nobody could tell what to fix. Every piece NAV sends is kept here.
import { extractAllBlocks, extractAllTags, extractTag } from "@/lib/nav/xml-utils";

export function formatBusinessValidationMessage(block: string): string {
  const code = extractTag(block, "validationResultCode") ?? "ERROR";
  const errorCode = extractTag(block, "validationErrorCode");
  const message = extractTag(block, "message");
  const tag = extractTag(block, "tag");
  const value = extractTag(block, "value");
  const line = extractTag(block, "line");
  const where = tag
    ? ` [${tag}${value ? ` = ${value}` : ""}${line ? `, sor ${line}` : ""}]`
    : "";
  return `Üzleti validáció (${code})${errorCode ? ` ${errorCode}` : ""}${message ? `: ${message}` : ""}${where}`;
}

export function parseTransactionStatusMessages(responseXml: string): string[] {
  const technicalBlocks = extractAllBlocks(responseXml, "technicalValidationMessages");
  const businessBlocks = extractAllBlocks(responseXml, "businessValidationMessages");

  const technical =
    technicalBlocks.length > 0
      ? technicalBlocks.map((block) => {
          const code = extractTag(block, "validationResultCode");
          const message = extractTag(block, "message") ?? "";
          return code && code !== "ERROR" ? `${message} (${code})` : message;
        })
      : // No typed blocks (older/other envelopes): fall back to every <message>,
        // minus the ones that belong to a business block (handled below).
        extractAllTags(
          businessBlocks.reduce((rest, block) => rest.replace(block, ""), responseXml),
          "message"
        );

  const business = businessBlocks.map(formatBusinessValidationMessage);

  return [...technical, ...business].map((m) => m.trim()).filter(Boolean);
}
