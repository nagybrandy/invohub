// app/(app)/settings/billing.tsx
// Számlázási beállítások: the tax profile the owner states about the business,
// the invoice-number prefix, and the defaults every new invoice/receipt starts
// from. Stored on the company profile (POST /api/companies).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { FormField } from "@/components/layout/FormField";
import { OptionSelect } from "@/components/settings/OptionSelect";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { useCompany } from "@/hooks/useCompany";
import { useSupportedCurrencies } from "@/hooks/useSupportedCurrencies";
import {
  DEFAULT_VAT_RATES,
  HIPA_MODES,
  MAX_DEFAULT_NOTE_LENGTH,
  PAYMENT_METHODS,
  TAX_MODES,
  VAT_REGIMES,
  normalizeInvoicePrefix,
  type BillingSettings,
  type DocumentLanguage,
} from "@/lib/companies/billing-settings";
import { routes } from "@/lib/navigation";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { type } from "@/lib/ui/type";

/** The languages a document can actually be issued in today (more follow). */
const AVAILABLE_LANGUAGES: DocumentLanguage[] = ["hu", "en"];

const BILLING_KEYS = [
  "taxMode",
  "vatRegime",
  "hipaMode",
  "defaultPaymentMethod",
  "defaultLanguage",
  "defaultCurrency",
  "defaultVatRate",
  "defaultNote",
] as const satisfies ReadonlyArray<keyof BillingSettings>;

type SavedBilling = { form: BillingSettings; prefixText: string; termDays: string };

export default function BillingSettingsScreen() {
  const { t } = useTranslation();
  const { company, loading, save } = useCompany();
  const currencies = useSupportedCurrencies();
  const keys = settingsItemKeys("billing");

  const saved = React.useMemo<SavedBilling>(
    () => ({
      form: company
        ? {
            taxMode: company.taxMode,
            vatRegime: company.vatRegime,
            hipaMode: company.hipaMode,
            defaultPaymentMethod: company.defaultPaymentMethod,
            defaultLanguage: company.defaultLanguage,
            defaultCurrency: company.defaultCurrency,
            defaultVatRate: company.defaultVatRate,
            defaultNote: company.defaultNote,
          }
        : {},
      prefixText: company?.invoicePrefix ?? "",
      termDays: company?.defaultPaymentTermDays != null ? String(company.defaultPaymentTermDays) : "",
    }),
    [company]
  );

  const [form, setForm] = React.useState<BillingSettings>({});
  const [prefixText, setPrefixText] = React.useState("");
  const [termDays, setTermDays] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (!company || hydrated.current) return;
    hydrated.current = true;
    setForm(saved.form);
    setPrefixText(saved.prefixText);
    setTermDays(saved.termDays);
  }, [company, saved]);

  const set = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) => {
    setMessage(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const prefixTrimmed = prefixText.trim();
  const prefix = normalizeInvoicePrefix(prefixText);
  const prefixInvalid = prefixTrimmed.length > 0 && !prefix;
  const termInvalid = termDays.trim() !== "" && !/^\d{1,3}$/.test(termDays.trim());
  const canSave = Boolean(company) && !saving && !prefixInvalid && !termInvalid;

  const dirty =
    Boolean(company) &&
    (BILLING_KEYS.some((key) => (form[key] ?? null) !== (saved.form[key] ?? null)) ||
      prefixText !== saved.prefixText ||
      termDays !== saved.termDays);

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    setMessage(null);
    try {
      // null clears a stored value; undefined would leave it unchanged.
      await save({
        name: company.name,
        taxMode: form.taxMode ?? (null as never),
        vatRegime: form.vatRegime ?? (null as never),
        hipaMode: form.hipaMode ?? (null as never),
        invoicePrefix: prefix ?? (null as never),
        defaultPaymentMethod: form.defaultPaymentMethod ?? (null as never),
        defaultPaymentTermDays: termDays.trim() ? Number(termDays.trim()) : (null as never),
        defaultCurrency: form.defaultCurrency ?? (null as never),
        defaultLanguage: form.defaultLanguage ?? (null as never),
        defaultVatRate: form.defaultVatRate ?? (null as never),
        defaultNote: form.defaultNote?.trim() ? form.defaultNote.trim() : (null as never),
      });
      // The server stores the normalised values; show them back.
      setPrefixText(prefix ?? "");
      setForm((prev) => ({ ...prev, defaultNote: prev.defaultNote?.trim() ? prev.defaultNote.trim() : undefined }));
      setMessage({ kind: "ok", text: t("billing.saved") });
    } catch {
      setMessage({ kind: "error", text: t("billing.failed") });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setForm(saved.form);
    setPrefixText(saved.prefixText);
    setTermDays(saved.termDays);
    setMessage(null);
  }

  const year = new Date().getFullYear();
  const notSet = t("settingsPages.billing.notSet");
  const currencyCodes = React.useMemo(
    () => (form.defaultCurrency && !currencies.includes(form.defaultCurrency) ? [...currencies, form.defaultCurrency] : currencies),
    [currencies, form.defaultCurrency]
  );

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-billing">
      {!loading && !company ? (
        <SettingsNote tone="warn" testID="billing-needs-company">
          {t("billing.needCompany")}{" "}
          <Text
            accessibilityRole="link"
            onPress={() => router.push(routes.settingsCompany)}
            className="font-semibold text-primary"
          >
            {t("billing.openCompany")}
          </Text>
        </SettingsNote>
      ) : null}

      <SettingsSheet>
        <SettingsSection title={t("billing.tax.title")} hint={t("billing.tax.hint")} testID="billing-tax">
          <FormField label={t("billing.tax.mode")}>
            <OptionSelect
              testID="billing-tax-mode"
              accessibilityLabel={t("billing.tax.mode")}
              emptyLabel={notSet}
              value={form.taxMode}
              onChange={(v) => set("taxMode", v)}
              options={TAX_MODES.map((value) => ({ value, label: t(`billing.tax.modes.${value}`) }))}
            />
          </FormField>
          <FormField label={t("billing.tax.vat")}>
            <OptionSelect
              testID="billing-vat-regime"
              accessibilityLabel={t("billing.tax.vat")}
              emptyLabel={notSet}
              value={form.vatRegime}
              onChange={(v) => set("vatRegime", v)}
              options={VAT_REGIMES.map((value) => ({ value, label: t(`billing.tax.vatOptions.${value}`) }))}
            />
          </FormField>
          <FormField label={t("billing.tax.hipa")}>
            <OptionSelect
              testID="billing-hipa"
              accessibilityLabel={t("billing.tax.hipa")}
              emptyLabel={notSet}
              value={form.hipaMode}
              onChange={(v) => set("hipaMode", v)}
              options={HIPA_MODES.map((value) => ({ value, label: t(`billing.tax.hipaOptions.${value}`) }))}
            />
          </FormField>
        </SettingsSection>

        <SettingsSection title={t("billing.prefix.title")} hint={t("billing.prefix.hint")} testID="billing-prefix">
          <Input data-invalid={prefixInvalid}>
            <InputField
              testID="billing-prefix-input"
              accessibilityLabel={t("billing.prefix.title")}
              value={prefixText}
              onChangeText={(v) => {
                setMessage(null);
                setPrefixText(v);
              }}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="INV"
            />
          </Input>
          {prefixInvalid ? (
            <Text className="text-[13px] font-semibold text-err">{t("billing.prefix.invalid")}</Text>
          ) : (
            <Text className={type.meta} testID="billing-prefix-example">
              {t("billing.prefix.example", { example: `${prefix ?? "INV"}-${year}-00001` })}
            </Text>
          )}
        </SettingsSection>

        <SettingsSection title={t("billing.defaults.title")} hint={t("billing.defaults.hint")} testID="billing-defaults">
          <FormField label={t("billing.defaults.paymentMethod")}>
            <OptionSelect
              testID="billing-payment-method"
              accessibilityLabel={t("billing.defaults.paymentMethod")}
              emptyLabel={notSet}
              value={form.defaultPaymentMethod}
              onChange={(v) => set("defaultPaymentMethod", v)}
              options={PAYMENT_METHODS.map((value) => ({ value, label: t(`invoices.paymentMethods.${value}`) }))}
            />
          </FormField>
          <FormField label={t("billing.defaults.language")}>
            <OptionSelect
              testID="billing-language"
              accessibilityLabel={t("billing.defaults.language")}
              emptyLabel={notSet}
              value={form.defaultLanguage}
              onChange={(v) => set("defaultLanguage", v)}
              options={AVAILABLE_LANGUAGES.map((value) => ({ value, label: t(`billing.languages.${value}`) }))}
            />
          </FormField>
          <FormField
            label={t("billing.defaults.termDays")}
            error={termInvalid ? t("billing.defaults.termInvalid") : undefined}
          >
            <Input data-invalid={termInvalid}>
              <InputField
                testID="billing-term-days"
                accessibilityLabel={t("billing.defaults.termDays")}
                value={termDays}
                onChangeText={(v) => {
                  setMessage(null);
                  setTermDays(v);
                }}
                keyboardType="number-pad"
                placeholder="8"
              />
            </Input>
          </FormField>
          <FormField label={t("billing.defaults.vatRate")}>
            <OptionSelect
              testID="billing-vat-rate"
              accessibilityLabel={t("billing.defaults.vatRate")}
              emptyLabel={notSet}
              value={form.defaultVatRate}
              onChange={(v) => set("defaultVatRate", v)}
              options={DEFAULT_VAT_RATES.map((value) => ({ value, label: `${value}%` }))}
            />
          </FormField>
          <FormField label={t("billing.defaults.currency")} hint={t("currency.hint")}>
            <OptionSelect
              testID="billing-currency"
              accessibilityLabel={t("billing.defaults.currency")}
              emptyLabel={notSet}
              value={form.defaultCurrency}
              onChange={(v) => set("defaultCurrency", v)}
              options={currencyCodes.map((code) => ({ value: code, label: code }))}
            />
          </FormField>
          <FormField label={t("billing.defaults.note")}>
            <Textarea>
              <TextareaInput
                testID="billing-note"
                accessibilityLabel={t("billing.defaults.note")}
                value={form.defaultNote ?? ""}
                onChangeText={(v) => set("defaultNote", v)}
                maxLength={MAX_DEFAULT_NOTE_LENGTH}
                placeholder={t("billing.defaults.notePlaceholder")}
              />
            </Textarea>
          </FormField>
        </SettingsSection>
      </SettingsSheet>

      {message ? (
        <SettingsNote tone={message.kind === "ok" ? "ok" : "err"} testID="billing-message">
          {message.text}
        </SettingsNote>
      ) : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={!canSave}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        saveLabel={t("billing.save")}
        saveTestID="billing-save"
      />
    </SettingsPage>
  );
}
