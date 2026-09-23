// components/invoices/composer/useInvoiceComposer.ts
// All state, defaults, validation and save logic for the 3-step invoice
// composer (docs/design/app-ux-spec-2026-09-14.md §2). Shared by
// app/(app)/invoices/new.tsx and app/(app)/invoices/[id]/edit.tsx through
// <InvoiceComposer mode="create" | "edit" />.
import * as React from "react";
import { router, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import type { DocumentType } from "@/components/invoices/DocumentTypeTabs";
import {
  COMPOSER_STEP_ORDER,
  type ComposerStepId,
  type SaveAction,
  canEnableEmailOnSend,
  resolveStatusForAction,
  shouldSendOnAction,
  validateBuyerAddressStep,
  validateComposerStep,
  validateDueDate,
  validateExchangeRateInput,
  validateLineItemsStep,
  validatePartnerStep,
} from "@/components/invoices/composer/composer-logic";
import { useClients } from "@/hooks/useClients";
import { isNavConfigured } from "@/lib/companies/public-company";
import { useCompany } from "@/hooks/useCompany";
import { useInvoices } from "@/hooks/useInvoices";
import { useProducts } from "@/hooks/useProducts";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { Client } from "@/lib/clients/service";
import { isCompanyProfileComplete } from "@/lib/companies/completeness";
import { calculateInvoiceTotals, createEmptyLineItem, createId } from "@/lib/invoices/calculations";
import { applyClientToFormFields } from "@/lib/invoices/client-form-fields";
import { parseExchangeRateInput } from "@/lib/invoices/exchange-rate";
import type { Product } from "@/lib/products/service";
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceDocumentType,
  InvoiceLineItem,
  PaymentMethod,
} from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";

export const DEADLINE_QUICK_DAYS = [8, 15, 30];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(base: string, days: number): string {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentTime(): string {
  return new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
}

/** DocumentTypeTabs also offers "receipt" (a different domain) — an existing invoice can't become one. */
function toInvoiceDocumentType(
  type: DocumentType,
  fallback: InvoiceDocumentType = "invoice"
): InvoiceDocumentType {
  return type === "receipt" ? fallback : type;
}

function toTabDocumentType(type: InvoiceDocumentType): DocumentType {
  return type === "storno" || type === "modify" ? "invoice" : type;
}

export type UseInvoiceComposerOptions = {
  mode: "create" | "edit";
  /** Required (and already loaded) for mode="edit". Ignored for mode="create". */
  invoice?: Invoice | null;
  /** From /invoices/new?clientId=… — the "Invoice this partner" shortcut (spec §3.4). */
  initialClientId?: string | null;
  /** From routes.invoiceEdit(id, { focus }) — e.g. the exchange-rate-missing
   * warning card's deep link (StepPartner reacts to focusField). */
  initialFocusField?: string | null;
};

export type ComposerErrors = {
  partner?: string;
  lineItems?: string;
  dueDate?: string;
  /** Áfa tv. 169. § e) — buyer name + zip/city/address, checked only when finalizing. */
  buyerAddress?: string;
};

export function useInvoiceComposer({
  mode,
  invoice,
  initialClientId,
  initialFocusField,
}: UseInvoiceComposerOptions) {
  const { t } = useTranslation();
  const { clients } = useClients();
  const { products } = useProducts();
  const { company, loading: companyLoading } = useCompany();
  const { addOrUpdate } = useInvoices();

  // Finalizing (assigning a real invoice number) is refused server-side
  // when the seller's own profile is missing mandatory fields
  // (lib/invoices/service.ts's CompanyProfileIncompleteError) — the
  // composer surfaces that BEFORE the user hits save instead of failing
  // late. `false` while the profile is still loading, so the banner never
  // flashes on for a returning user with a complete profile.
  const companyProfileIncomplete = !companyLoading && !isCompanyProfileComplete(company);

  const [step, setStep] = React.useState<ComposerStepId>("partner");
  const [documentType, setDocumentType] = React.useState<DocumentType>(
    invoice ? toTabDocumentType(invoice.documentType) : "invoice"
  );

  // Partner ---------------------------------------------------------------
  const [clientId, setClientIdState] = React.useState<string | null>(invoice?.clientId ?? null);
  const [clientName, setClientNameState] = React.useState(invoice?.clientName ?? "");
  const [clientTaxNumber, setClientTaxNumber] = React.useState(invoice?.clientTaxNumber ?? "");
  const [clientEmail, setClientEmail] = React.useState("");
  const [clientCountry, setClientCountry] = React.useState(invoice?.clientCountry ?? "Magyarország");
  // Seeded from the invoice's own buyer-address snapshot in edit mode (Áfa
  // tv. 169. § e) — never re-derived from the linked client here, matching
  // build-pdf-context.ts's snapshot-first rule.
  const [clientZip, setClientZip] = React.useState(invoice?.clientZipCode ?? "");
  const [clientCity, setClientCity] = React.useState(invoice?.clientCity ?? "");
  const [clientAddress, setClientAddress] = React.useState(invoice?.clientAddress ?? "");
  const [clientEuVatNumber, setClientEuVatNumber] = React.useState(invoice?.clientEuVatNumber ?? "");
  const [showClientDetails, setShowClientDetails] = React.useState(false);
  const appliedInitialClientId = React.useRef(false);

  // Dates & payment ---------------------------------------------------------
  const [fulfillmentDate, setFulfillmentDate] = React.useState(
    invoice?.fulfillmentDate ?? invoice?.issueDate ?? todayIso()
  );
  const [issueDate, setIssueDate] = React.useState(invoice?.issueDate ?? todayIso());
  const [continuousPerformance, setContinuousPerformance] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(
    invoice?.paymentMethod ?? "transfer"
  );
  const [currency, setCurrency] = React.useState<InvoiceCurrency>(invoice?.currency ?? "HUF");
  const [exchangeRate, setExchangeRateRaw] = React.useState(
    invoice?.exchangeRate != null ? String(invoice.exchangeRate) : ""
  );
  // MNB auto-fetch (owner request: "az árfolyamot mindig valami külső
  // helyről kérje le, mint a számlázz.hu") — see the effect below.
  // "manual" means the user (or a pre-existing edit) owns the value;
  // "mnb" means the last successful fetch is what's shown, with
  // `exchangeRateAsOf` (the MNB-published day, possibly earlier than the
  // requested date on a weekend/holiday) driving the caption.
  const [exchangeRateSource, setExchangeRateSource] = React.useState<"mnb" | "manual" | null>(
    invoice?.exchangeRate != null ? "manual" : null
  );
  const [exchangeRateLoading, setExchangeRateLoading] = React.useState(false);
  const [exchangeRateFetchError, setExchangeRateFetchError] = React.useState<string | null>(null);
  const [exchangeRateAsOf, setExchangeRateAsOf] = React.useState<string | null>(null);
  // True once a manual edit has happened since the last currency/date
  // change — guards a late-arriving fetch response against clobbering it.
  const exchangeRateManualRef = React.useRef(false);
  // True after the first [currency, fulfillmentDate] effect run — lets that
  // first run skip auto-fetching over an already-valid rate (e.g. opening
  // the edit screen for an invoice that already has one saved).
  const exchangeRateArmedRef = React.useRef(false);
  const [deadlineDays, setDeadlineDaysState] = React.useState(8);
  const [dueDate, setDueDate] = React.useState(invoice?.dueDate ?? addDaysIso(todayIso(), 8));
  const [bankAccount, setBankAccount] = React.useState("");
  const [showDatesPayment, setShowDatesPayment] = React.useState(false);
  const dueDateTouched = React.useRef(mode === "edit");
  const appliedCompanyDefaults = React.useRef(false);

  // Line items --------------------------------------------------------------
  const [lineItems, setLineItems] = React.useState<InvoiceLineItem[]>(
    invoice?.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [{ ...createEmptyLineItem(), unit: "db" }]
  );

  // Review ------------------------------------------------------------------
  const [notes, setNotes] = React.useState(invoice?.notes ?? "");
  const [emailOnSend, setEmailOnSend] = React.useState(false);

  // Save/dirty state ---------------------------------------------------------
  const [errors, setErrors] = React.useState<ComposerErrors>({});
  const [focusField, setFocusField] = React.useState<string | null>(
    initialFocusField ?? null
  );
  const [isDirty, setIsDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const savedInvoiceIdRef = React.useRef<string>(invoice?.id ?? createId());

  function markDirty() {
    setIsDirty(true);
  }

  // Apply saved-partner data to all the partner-step fields.
  const handleSelectClient = React.useCallback((client: Client) => {
    const fields = applyClientToFormFields(client);
    setClientIdState(fields.clientId);
    setClientNameState(fields.clientName);
    setClientTaxNumber(fields.clientTaxNumber);
    setClientEmail(fields.clientEmail);
    setClientCountry(fields.clientCountry);
    setClientZip(fields.clientZip);
    setClientCity(fields.clientCity);
    setClientAddress(fields.clientAddress);
    setClientEuVatNumber(fields.clientEuVatNumber);
    // INV-2: selecting a saved partner must NEVER silently arm e-mail
    // sending — that decision belongs only to the explicit step-3 toggle.
    setEmailOnSend(false);
    setErrors((prev) =>
      prev.partner || prev.buyerAddress ? { ...prev, partner: undefined, buyerAddress: undefined } : prev
    );
    markDirty();
  }, []);

  // Clear a step's error banner as soon as its condition is actually fixed,
  // instead of leaving a stale "Legalább egy tételt adj meg." on screen
  // after the user has already added one (spec §2.6, INV-3).
  React.useEffect(() => {
    if (!errors.lineItems) return;
    if (validateLineItemsStep(lineItems).valid) {
      setErrors((prev) => ({ ...prev, lineItems: undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems]);

  React.useEffect(() => {
    if (!errors.dueDate) return;
    if (validateDueDate(issueDate, dueDate).valid) {
      setErrors((prev) => ({ ...prev, dueDate: undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDate, dueDate]);

  // AC13: clear a stale "missing exchange rate" partner-slot error as soon
  // as the rate (or currency) becomes valid again — same pattern as the
  // line-items/due-date effects above.
  React.useEffect(() => {
    if (!errors.partner) return;
    if (validateExchangeRateInput(exchangeRate, currency).valid && validatePartnerStep(clientName).valid) {
      setErrors((prev) => ({ ...prev, partner: undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeRate, currency]);

  // Same pattern for the buyer-address error (Áfa tv. 169. § e) — clears as
  // soon as zip/city/address are all filled in again.
  React.useEffect(() => {
    if (!errors.buyerAddress) return;
    if (validateBuyerAddressStep({ clientZip, clientCity, clientAddress }).valid) {
      setErrors((prev) => ({ ...prev, buyerAddress: undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientZip, clientCity, clientAddress]);

  // Owner request: auto-fetch the official MNB HUF rate whenever the
  // currency or the relevant date (teljesítés/fulfillment — Áfa tv. 80. §)
  // changes, instead of making the user type it in. Skips its very first
  // run when opening the composer already lands on a valid manual rate
  // (editing an existing non-HUF invoice) so nothing gets silently
  // overwritten on mount — every run after that always (re-)fetches, since
  // a currency/date change invalidates whatever rate was there before.
  // Áfa tv. 80. §: the teljesítés date's rate; a cleared fulfillment date
  // falls back to the issue date (same rule as the server-side autofill).
  const exchangeRateDate = fulfillmentDate.trim() || issueDate;
  React.useEffect(() => {
    if (currency === "HUF") {
      setExchangeRateSource(null);
      setExchangeRateFetchError(null);
      setExchangeRateAsOf(null);
      return;
    }

    const isFirstRun = !exchangeRateArmedRef.current;
    exchangeRateArmedRef.current = true;
    if (isFirstRun && parseExchangeRateInput(exchangeRate) !== null) {
      setExchangeRateSource("manual");
      return;
    }

    exchangeRateManualRef.current = false;
    setExchangeRateFetchError(null);
    setExchangeRateLoading(true);
    let cancelled = false;

    apiFetch<{ rate: number; rateDate: string; source: string }>(
      `/api/exchange-rates?currency=${currency}&date=${exchangeRateDate}`
    )
      .then((data) => {
        if (cancelled || exchangeRateManualRef.current) return;
        if (typeof data?.rate !== "number" || !Number.isFinite(data.rate) || !data.rateDate) {
          setExchangeRateFetchError(t("invoices.errors.exchangeRateFetchFailed"));
          return;
        }
        setExchangeRateRaw(String(data.rate));
        setExchangeRateSource("mnb");
        setExchangeRateAsOf(data.rateDate);
        markDirty();
      })
      .catch(() => {
        if (cancelled || exchangeRateManualRef.current) return;
        // Failure → keep whatever manual entry is already there (spec item 5).
        setExchangeRateFetchError(t("invoices.errors.exchangeRateFetchFailed"));
      })
      .finally(() => {
        if (!cancelled) setExchangeRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, exchangeRateDate]);

  /** Manual override (spec item 5) — marks the rate as user-owned so the next fetch response can't clobber it mid-flight. */
  function setExchangeRate(value: string) {
    exchangeRateManualRef.current = true;
    setExchangeRateRaw(value);
    setExchangeRateSource("manual");
    setExchangeRateFetchError(null);
    markDirty();
  }

  React.useEffect(() => {
    if (mode !== "create" || appliedInitialClientId.current) return;
    if (!initialClientId || clients.length === 0) return;
    const match = clients.find((c) => c.id === initialClientId);
    if (match) {
      appliedInitialClientId.current = true;
      handleSelectClient(match);
    }
  }, [mode, initialClientId, clients, handleSelectClient]);

  function setClientName(value: string) {
    setClientNameState(value);
    if (clientId) setClientIdState(null);
    if (value.trim()) setErrors((prev) => (prev.partner ? { ...prev, partner: undefined } : prev));
    markDirty();
  }

  function clearClient() {
    setClientIdState(null);
    setClientNameState("");
    setClientTaxNumber("");
    setClientEmail("");
    setClientZip("");
    setClientCity("");
    setClientAddress("");
    setClientEuVatNumber("");
    setEmailOnSend(false);
    markDirty();
  }

  // Company defaults, applied once, only while the fields are still
  // pristine (spec §2.3) — never overwrites something the user already
  // edited, and never runs for an existing invoice being edited.
  React.useEffect(() => {
    if (mode !== "create" || !company || appliedCompanyDefaults.current) return;
    appliedCompanyDefaults.current = true;

    // NAV adatszolgáltatás is mandatory for an issued invoice, so the toggle
    // starts on for a company that has its NAV credentials on file — leaving it
    // off by default made every invoice depend on the user remembering it.
    // Companies without NAV set up keep it off; nothing would come of it.
    if (isNavConfigured(company)) setNavEnabled(true);

    if (company.defaultCurrency) setCurrency(company.defaultCurrency);
    if (company.defaultPaymentMethod) setPaymentMethod(company.defaultPaymentMethod);
    if (company.bankAccount) setBankAccount(company.bankAccount);
    if (company.defaultPaymentTermDays) {
      setDeadlineDaysState(company.defaultPaymentTermDays);
      if (!dueDateTouched.current) {
        setDueDate(addDaysIso(issueDate, company.defaultPaymentTermDays));
      }
    }

    setLineItems((items) => {
      const [only] = items;
      const isPristine =
        items.length === 1 &&
        !only.description.trim() &&
        only.quantity === 1 &&
        only.unitPrice === 0 &&
        only.vatCategory === "normal";
      return isPristine
        ? [{ ...createEmptyLineItem({ vatExempt: company.vatExempt }), unit: "db" }]
        : items;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, company]);

  function setDeadlineDays(days: number) {
    dueDateTouched.current = true;
    setDeadlineDaysState(days);
    setDueDate(addDaysIso(issueDate, days));
    markDirty();
  }

  function handleIssueDateChange(value: string) {
    setIssueDate(value);
    if (!dueDateTouched.current) {
      setDueDate(addDaysIso(value, deadlineDays));
    }
    markDirty();
  }

  function handleDueDateChange(value: string) {
    dueDateTouched.current = true;
    setDueDate(value);
    markDirty();
  }

  // Line item mutators --------------------------------------------------------
  function updateLineItem(id: string, patch: Partial<InvoiceLineItem>) {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    markDirty();
  }

  function addLineItem() {
    setLineItems((items) => [
      ...items,
      { ...createEmptyLineItem({ vatExempt: company?.vatExempt }), unit: "db" },
    ]);
    markDirty();
  }

  /** INV-5: fills description, unit price, VAT rate and unit from the product catalogue. */
  function addLineItemFromProduct(product: Product) {
    const rate = ([0, 5, 18, 27] as const).includes(product.vatRate as 0 | 5 | 18 | 27)
      ? (product.vatRate as 0 | 5 | 18 | 27)
      : 27;
    setLineItems((items) => [
      ...items,
      {
        id: createId(),
        description: product.name,
        quantity: 1,
        unitPrice: product.unitPrice,
        vatRate: rate,
        vatCategory: "normal",
        unit: product.unit ?? "db",
      },
    ]);
    markDirty();
  }

  function fillLineItemFromProduct(id: string, product: Product) {
    const rate = ([0, 5, 18, 27] as const).includes(product.vatRate as 0 | 5 | 18 | 27)
      ? (product.vatRate as 0 | 5 | 18 | 27)
      : 27;
    updateLineItem(id, {
      description: product.name,
      unitPrice: product.unitPrice,
      vatRate: rate,
      vatCategory: "normal",
      unit: product.unit ?? "db",
    });
  }

  function removeLineItem(id: string) {
    setLineItems((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
    markDirty();
  }

  const totals = React.useMemo(() => calculateInvoiceTotals(lineItems), [lineItems]);

  const draftInvoice = React.useMemo<Invoice>(() => {
    const now = new Date().toISOString();
    return {
      id: savedInvoiceIdRef.current,
      invoiceNumber: invoice?.invoiceNumber ?? "",
      documentType: toInvoiceDocumentType(documentType, invoice?.documentType),
      clientName: clientName.trim() || "—",
      clientTaxNumber: clientTaxNumber.trim() || undefined,
      clientZipCode: clientZip.trim() || undefined,
      clientCity: clientCity.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientCountry: clientCountry.trim() || undefined,
      clientEuVatNumber: clientEuVatNumber.trim() || undefined,
      clientId: clientId ?? undefined,
      issueDate,
      dueDate,
      fulfillmentDate: fulfillmentDate.trim() || undefined,
      status: invoice?.status ?? "draft",
      currency,
      exchangeRate: currency !== "HUF" ? (parseExchangeRateInput(exchangeRate) ?? undefined) : undefined,
      lineItems: lineItems.filter((item) => item.description.trim()),
      notes: notes.trim() || undefined,
      paymentMethod,
      createdAt: invoice?.createdAt ?? now,
      updatedAt: now,
    };
  }, [
    invoice,
    documentType,
    clientName,
    clientTaxNumber,
    clientZip,
    clientCity,
    clientAddress,
    clientCountry,
    clientEuVatNumber,
    clientId,
    issueDate,
    dueDate,
    fulfillmentDate,
    currency,
    exchangeRate,
    lineItems,
    notes,
    paymentMethod,
  ]);

  const invalidSteps: Record<ComposerStepId, boolean> = {
    partner: Boolean(errors.partner || errors.dueDate || errors.buyerAddress),
    items: Boolean(errors.lineItems),
    review: false,
  };

  function clearFocusField() {
    setFocusField(null);
  }

  /**
   * The stepper's "Tovább": validates the step being left, so a missing
   * partner or line item is reported where it can still be fixed instead of
   * at finalize time. Invalid steps keep the user where they are, with the
   * offending field focused.
   */
  function goToNextStep() {
    const check = validateComposerStep(step, { clientName, lineItems });
    if (!check.valid) {
      setErrors(step === "partner" ? { partner: t(check.errorKey!) } : { lineItems: t(check.errorKey!) });
      setFocusField(check.focusField ?? null);
      return;
    }

    setErrors({});
    setFocusField(null);
    const next = COMPOSER_STEP_ORDER[COMPOSER_STEP_ORDER.indexOf(step) + 1];
    if (next) setStep(next);
  }

  async function save(action: SaveAction): Promise<Invoice | undefined> {
    setSaveError(null);

    const partnerCheck = validatePartnerStep(clientName);
    if (!partnerCheck.valid) {
      setErrors({ partner: t(partnerCheck.errorKey!) });
      setStep("partner");
      setFocusField(partnerCheck.focusField ?? null);
      return undefined;
    }

    // AC13: a non-HUF invoice can't be saved without a usable HUF exchange
    // rate — surfaced on the partner step (where the currency/rate fields
    // live) rather than a dedicated step, matching validateDueDate's slot.
    const exchangeRateCheck = validateExchangeRateInput(exchangeRate, currency);
    if (!exchangeRateCheck.valid) {
      setErrors({ partner: t(exchangeRateCheck.errorKey!) });
      setStep("partner");
      setFocusField(exchangeRateCheck.focusField ?? null);
      return undefined;
    }

    const dueCheck = validateDueDate(issueDate, dueDate);
    if (!dueCheck.valid) {
      setErrors({ dueDate: t(dueCheck.errorKey!) });
      setStep("partner");
      setFocusField(dueCheck.focusField ?? null);
      return undefined;
    }

    const itemsCheck = validateLineItemsStep(lineItems);
    if (!itemsCheck.valid) {
      setErrors({ lineItems: t(itemsCheck.errorKey!) });
      setStep("items");
      setFocusField(itemsCheck.focusField ?? null);
      return undefined;
    }

    const status = resolveStatusForAction(action, documentType);

    // Áfa tv. 169. § e) — a document that leaves "draft" (any action other
    // than "draft" itself) must carry a complete buyer name+address. A
    // proforma (díjbekérő) is exempt — it's never an accounting document
    // (see requiresCompleteBuyerAddress in lib/invoices/types.ts).
    if (status !== "draft" && documentType !== "proforma") {
      const buyerAddressCheck = validateBuyerAddressStep({ clientZip, clientCity, clientAddress });
      if (!buyerAddressCheck.valid) {
        setErrors({ buyerAddress: t(buyerAddressCheck.errorKey!) });
        setStep("partner");
        setShowClientDetails(true);
        setFocusField(buyerAddressCheck.focusField ?? null);
        return undefined;
      }
    }

    setErrors({});

    const willSend = shouldSendOnAction(action) && emailOnSend;
    if (willSend && !clientEmail.trim()) {
      setErrors({ partner: t("invoices.errors.clientEmailRequired") });
      setStep("review");
      return undefined;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Invoice = {
        id: savedInvoiceIdRef.current,
        invoiceNumber: invoice?.invoiceNumber ?? "",
        documentType: toInvoiceDocumentType(documentType, invoice?.documentType),
        clientName: clientName.trim(),
        clientTaxNumber: clientTaxNumber.trim() || undefined,
        clientZipCode: clientZip.trim() || undefined,
        clientCity: clientCity.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        clientCountry: clientCountry.trim() || undefined,
        clientEuVatNumber: clientEuVatNumber.trim() || undefined,
        clientId: clientId ?? undefined,
        issueDate,
        dueDate,
        fulfillmentDate: fulfillmentDate.trim() || undefined,
        status,
        currency,
        exchangeRate: currency !== "HUF" ? (parseExchangeRateInput(exchangeRate) ?? undefined) : undefined,
        lineItems: lineItems.filter((item) => item.description.trim()),
        notes: notes.trim() || undefined,
        paymentMethod,
        createdAt: invoice?.createdAt ?? now,
        updatedAt: now,
      };

      const saved = await addOrUpdate(payload);
      savedInvoiceIdRef.current = saved.id;

      if (willSend) {
        await apiFetch(`/api/invoices/${saved.id}/send`, {
          method: "POST",
          body: JSON.stringify({ to: clientEmail.trim() || undefined }),
        });
      }

      // NAV Online Számla: finalization (POST/PATCH /api/invoices) submits
      // server-side automatically when NAV is configured — no client call
      // and no opt-in toggle. Status/retry live on the detail screen.

      setSavedAt(currentTime());
      setIsDirty(false);
      // INV-15: only a finalized save leaves the composer — "Mentés
      // piszkozatként" stays on screen so the user can keep editing.
      if (status !== "draft") {
        router.replace(routes.invoiceDetail(saved.id));
      }
      return saved;
    } catch (e) {
      // The composer already disables finalize while the profile is known
      // incomplete (companyProfileIncomplete above) — this only fires on
      // the rare race where it changed between page load and save, so it
      // still needs a translated message instead of the raw English one
      // the API sends.
      setSaveError(
        e instanceof ApiError && e.code === "companyProfileIncomplete"
          ? t("invoices.composer.companyProfileIncomplete")
          : e instanceof Error
            ? e.message
            : t("invoices.errors.saveFailed")
      );
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  return {
    t,
    mode,
    step,
    setStep,
    goToNextStep,
    documentType,
    setDocumentType: (type: DocumentType) => {
      setDocumentType(type);
      markDirty();
    },
    documentTabsDisabled: mode === "edit",

    // Partner
    clients,
    clientId,
    clientName,
    clientTaxNumber,
    clientEmail,
    clientCountry,
    clientZip,
    clientCity,
    clientAddress,
    clientEuVatNumber,
    setClientName,
    setClientTaxNumber: (v: string) => {
      setClientTaxNumber(v);
      markDirty();
    },
    setClientEmail: (v: string) => {
      setClientEmail(v);
      markDirty();
    },
    setClientCountry: (v: string) => {
      setClientCountry(v);
      markDirty();
    },
    setClientZip: (v: string) => {
      setClientZip(v);
      markDirty();
    },
    setClientCity: (v: string) => {
      setClientCity(v);
      markDirty();
    },
    setClientAddress: (v: string) => {
      setClientAddress(v);
      markDirty();
    },
    setClientEuVatNumber: (v: string) => {
      setClientEuVatNumber(v);
      markDirty();
    },
    handleSelectClient,
    clearClient,
    showClientDetails,
    setShowClientDetails,

    // Dates & payment
    fulfillmentDate,
    setFulfillmentDate: (v: string) => {
      setFulfillmentDate(v);
      markDirty();
    },
    issueDate,
    setIssueDate: handleIssueDateChange,
    dueDate,
    setDueDate: handleDueDateChange,
    continuousPerformance,
    setContinuousPerformance: (v: boolean) => {
      setContinuousPerformance(v);
      markDirty();
    },
    paymentMethod,
    setPaymentMethod: (v: PaymentMethod) => {
      setPaymentMethod(v);
      markDirty();
    },
    currency,
    setCurrency: (v: InvoiceCurrency) => {
      setCurrency(v);
      markDirty();
    },
    exchangeRate,
    setExchangeRate,
    exchangeRateSource,
    exchangeRateLoading,
    exchangeRateFetchError,
    exchangeRateAsOf,
    deadlineDays,
    setDeadlineDays,
    bankAccount,
    setBankAccount: (v: string) => {
      setBankAccount(v);
      markDirty();
    },
    showDatesPayment,
    setShowDatesPayment,

    // Line items
    lineItems,
    setLineItems: (items: InvoiceLineItem[]) => {
      setLineItems(items);
      markDirty();
    },
    updateLineItem,
    addLineItem,
    addLineItemFromProduct,
    fillLineItemFromProduct,
    removeLineItem,
    totals,
    products,

    // Review
    notes,
    setNotes: (v: string) => {
      setNotes(v);
      markDirty();
    },
    emailOnSend,
    setEmailOnSend: (v: boolean) => {
      setEmailOnSend(v);
      markDirty();
    },
    canEnableEmailOnSend: canEnableEmailOnSend(clientEmail),

    // Preview
    draftInvoice,
    /** The already-loaded company — for the unsaved-draft preview's issuer block (INV, AC20). */
    company,
    /** True once loaded and missing a required field — gates the finalize buttons (see InvoiceComposer.tsx). */
    companyProfileIncomplete,

    // Validation
    errors,
    invalidSteps,
    focusField,
    clearFocusField,

    // Save / dirty
    isDirty,
    saving,
    savedAt,
    saveError,
    save,
  };
}

export type InvoiceComposerState = ReturnType<typeof useInvoiceComposer>;
export { COMPOSER_STEP_ORDER };
export type { ComposerStepId, SaveAction };
