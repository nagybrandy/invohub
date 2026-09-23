// lib/invoices/send-error-i18n.test.ts
import { SEND_INVOICE_ERROR_I18N_KEY } from "@/lib/invoices/send-error-i18n";
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

describe("SEND_INVOICE_ERROR_I18N_KEY", () => {
  const codes = [
    "invoiceNotFound",
    "noRecipient",
    "buyerAddressMissing",
    "companyProfileIncomplete",
    "templateNotFound",
    "pdfFailed",
    "emailSendFailed",
  ];

  it("maps every documented send-failure code to an i18n key", () => {
    for (const code of codes) {
      expect(SEND_INVOICE_ERROR_I18N_KEY[code]).toBeTruthy();
    }
  });

  it("every mapped key resolves to real Hungarian and English copy (no missing translation)", () => {
    for (const code of Object.keys(SEND_INVOICE_ERROR_I18N_KEY)) {
      const key = SEND_INVOICE_ERROR_I18N_KEY[code];
      expect(typeof getByPath(en, key)).toBe("string");
      expect(typeof getByPath(hu, key)).toBe("string");
    }
  });
});
