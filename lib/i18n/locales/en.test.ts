// lib/i18n/locales/en.test.ts
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";

describe("i18n en locale", () => {
  it("defines navigation keys", () => {
    expect(en.nav.invoices).toBe("Invoices");
    expect(en.nav.dashboard).toBe("Dashboard");
    expect(en.settings.darkMode).toBe("Dark mode");
  });
});

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key)
  );
}

describe("hu/en locale parity", () => {
  it("defines the exact same set of keys in both locales", () => {
    const enKeys = keyPaths(en).sort();
    const huKeys = keyPaths(hu).sort();
    expect(huKeys).toEqual(enKeys);
  });

  it("defines the new invoices.vat/lineItemEditor/markPaid/correction/links/edit keys in both locales", () => {
    for (const locale of [en, hu]) {
      expect(locale.invoices.vat.category.AAM).toBeTruthy();
      expect(locale.invoices.lineItemEditor.addLineItem).toBeTruthy();
      expect(locale.invoices.markPaid.action).toBeTruthy();
      expect(locale.invoices.correction.action).toBeTruthy();
      expect(locale.invoices.links.stornoOf).toBeTruthy();
      expect(locale.invoices.edit.title).toBeTruthy();
      expect(locale.company.vatExempt).toBeTruthy();
    }
  });

  it("defines the invoices.document / invoices.preview / invoices.detail.previewTitle keys in both locales", () => {
    for (const locale of [en, hu]) {
      expect(locale.invoices.document.buyer).toBeTruthy();
      expect(locale.invoices.preview.title).toBeTruthy();
      expect(locale.invoices.detail.previewTitle).toBeTruthy();
    }
  });

  // AC14: the PDF continuation caption ("<invoiceNumber> · folytatás") and
  // the multi-page footer indicator ("{{page}}/{{total}}. oldal") both need
  // hu + en document vocabulary.
  it("defines invoices.document.continued and invoices.document.pageIndicator in both locales (AC14)", () => {
    for (const locale of [en, hu]) {
      expect(locale.invoices.document.continued).toBeTruthy();
      expect(locale.invoices.document.pageIndicator).toBeTruthy();
    }
  });

  it("defines notifications.panel.* and notifications.when.* in both locales", () => {
    for (const locale of [en, hu]) {
      expect(locale.notifications.panel.title).toBeTruthy();
      expect(locale.notifications.panel.unreadCount).toBeTruthy();
      expect(locale.notifications.panel.markAllRead).toBeTruthy();
      expect(locale.notifications.panel.markAllReadA11y).toBeTruthy();
      expect(locale.notifications.panel.refresh).toBeTruthy();
      expect(locale.notifications.panel.close).toBeTruthy();
      expect(locale.notifications.panel.loading).toBeTruthy();
      expect(locale.notifications.panel.empty.title).toBeTruthy();
      expect(locale.notifications.panel.empty.description).toBeTruthy();
      expect(locale.notifications.when.justNow).toBeTruthy();
      expect(locale.notifications.when.minutesAgo).toBeTruthy();
      expect(locale.notifications.when.hoursAgo).toBeTruthy();
      expect(locale.notifications.when.yesterday).toBeTruthy();
    }
  });

  it("defines the 10 new notifications.content.* keys in both locales", () => {
    for (const locale of [en, hu]) {
      expect(locale.notifications.content.overdueInvoiceTitle).toBeTruthy();
      expect(locale.notifications.content.overdueInvoiceBody).toBeTruthy();
      expect(locale.notifications.content.invoiceSentTitle).toBeTruthy();
      expect(locale.notifications.content.invoiceSentBody).toBeTruthy();
      expect(locale.notifications.content.navPendingTitle).toBeTruthy();
      expect(locale.notifications.content.navPendingBody).toBeTruthy();
      expect(locale.notifications.content.welcomeTitle).toBeTruthy();
      expect(locale.notifications.content.welcomeBody).toBeTruthy();
      expect(locale.notifications.content.reminderScheduledTitle).toBeTruthy();
      expect(locale.notifications.content.reminderScheduledBody).toBeTruthy();
    }
  });

  // AC4 (incoming-invoices-dashboard-button): the mislabelled desktop
  // "Bejövő számlák" button was removed, not relabelled — its only consumer
  // is gone, so the key must not silently come back in either locale.
  it("does not define dashboard.incomingInvoices in either locale", () => {
    for (const locale of [en, hu]) {
      expect((locale.dashboard as Record<string, unknown>).incomingInvoices).toBeUndefined();
    }
  });
});
