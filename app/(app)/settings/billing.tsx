// app/(app)/settings/billing.tsx
// Számlázási beállítások: the tax profile the owner states about the business,
// the invoice-number prefix, and the defaults every new invoice/receipt starts
// from. Stored on the company profile (POST /api/companies).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { OptionChips } from "@/components/settings/OptionChips";
import { useCompany } from "@/hooks/useCompany";
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

/** The languages a document can actually be issued in today (more follow). */
const AVAILABLE_LANGUAGES: DocumentLanguage[] = ["hu", "en"];
const CURRENCIES = ["HUF", "EUR"] as const;

export default function BillingSettingsScreen() {
  const { t } = useTranslation();
  const { company, loading, save } = useCompany();

  const [form, setForm] = React.useState<BillingSettings>({});
  const [prefixText, setPrefixText] = React.useState("");
  const [termDays, setTermDays] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (!company || hydrated.current) return;
    hydrated.current = true;
    setForm({
      taxMode: company.taxMode,
      vatRegime: company.vatRegime,
      hipaMode: company.hipaMode,
      defaultPaymentMethod: company.defaultPaymentMethod,
      defaultLanguage: company.defaultLanguage,
      defaultCurrency: company.defaultCurrency,
      defaultVatRate: company.defaultVatRate,
      defaultNote: company.defaultNote,
    });
    setPrefixText(company.invoicePrefix ?? "");
    setTermDays(company.defaultPaymentTermDays != null ? String(company.defaultPaymentTermDays) : "");
  }, [company]);

  const set = <K extends keyof BillingSettings>(key: K, value: BillingSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const prefixTrimmed = prefixText.trim();
  const prefix = normalizeInvoicePrefix(prefixText);
  const prefixInvalid = prefixTrimmed.length > 0 && !prefix;
  const termInvalid = termDays.trim() !== "" && !/^\d{1,3}$/.test(termDays.trim());
  const canSave = Boolean(company) && !saving && !prefixInvalid && !termInvalid;

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
      setMessage({ kind: "ok", text: t("billing.saved") });
    } catch {
      setMessage({ kind: "error", text: t("billing.failed") });
    } finally {
      setSaving(false);
    }
  }

  const year = new Date().getFullYear();

  return (
    <ScreenLayout header={<Heading size="2xl">{t("billing.title")}</Heading>}>
      <VStack space="lg">
        <Text size="sm" className="text-muted-foreground">
          {t("billing.subtitle")}
        </Text>

        {!loading && !company ? (
          <Card className="p-4">
            <VStack space="sm">
              <Text className="text-foreground">{t("billing.needCompany")}</Text>
              <Pressable onPress={() => router.push(routes.settingsCompany)} accessibilityRole="button">
                <Text className="font-medium text-primary">{t("billing.openCompany")}</Text>
              </Pressable>
            </VStack>
          </Card>
        ) : null}

        <Card className="p-4" testID="billing-tax">
          <VStack space="md">
            <VStack space="xs">
              <Heading size="md">{t("billing.tax.title")}</Heading>
              <Text size="xs" className="text-muted-foreground">
                {t("billing.tax.hint")}
              </Text>
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.tax.mode")}</Text>
              <OptionChips
                testIDPrefix="billing-tax-mode"
                clearable
                value={form.taxMode}
                onChange={(v) => set("taxMode", v)}
                options={TAX_MODES.map((value) => ({ value, label: t(`billing.tax.modes.${value}`) }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.tax.vat")}</Text>
              <OptionChips
                testIDPrefix="billing-vat-regime"
                clearable
                value={form.vatRegime}
                onChange={(v) => set("vatRegime", v)}
                options={VAT_REGIMES.map((value) => ({ value, label: t(`billing.tax.vatOptions.${value}`) }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.tax.hipa")}</Text>
              <OptionChips
                testIDPrefix="billing-hipa"
                clearable
                value={form.hipaMode}
                onChange={(v) => set("hipaMode", v)}
                options={HIPA_MODES.map((value) => ({ value, label: t(`billing.tax.hipaOptions.${value}`) }))}
              />
            </VStack>
          </VStack>
        </Card>

        <Card className="p-4" testID="billing-prefix">
          <VStack space="sm">
            <Heading size="md">{t("billing.prefix.title")}</Heading>
            <Text size="xs" className="text-muted-foreground">
              {t("billing.prefix.hint")}
            </Text>
            <Input className="max-w-[200px]" data-invalid={prefixInvalid}>
              <InputField
                testID="billing-prefix-input"
                value={prefixText}
                onChangeText={setPrefixText}
                autoCapitalize="characters"
                maxLength={10}
                placeholder="INV"
              />
            </Input>
            {prefixInvalid ? (
              <Text size="xs" className="text-destructive">{t("billing.prefix.invalid")}</Text>
            ) : (
              <Text size="xs" className="text-muted-foreground" testID="billing-prefix-example">
                {t("billing.prefix.example", { example: `${prefix ?? "INV"}-${year}-00001` })}
              </Text>
            )}
          </VStack>
        </Card>

        <Card className="p-4" testID="billing-defaults">
          <VStack space="md">
            <VStack space="xs">
              <Heading size="md">{t("billing.defaults.title")}</Heading>
              <Text size="xs" className="text-muted-foreground">
                {t("billing.defaults.hint")}
              </Text>
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.paymentMethod")}</Text>
              <OptionChips
                testIDPrefix="billing-payment-method"
                clearable
                value={form.defaultPaymentMethod}
                onChange={(v) => set("defaultPaymentMethod", v)}
                options={PAYMENT_METHODS.map((value) => ({ value, label: t(`invoices.paymentMethods.${value}`) }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.language")}</Text>
              <OptionChips
                testIDPrefix="billing-language"
                clearable
                value={form.defaultLanguage}
                onChange={(v) => set("defaultLanguage", v)}
                options={AVAILABLE_LANGUAGES.map((value) => ({ value, label: t(`billing.languages.${value}`) }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.termDays")}</Text>
              <Input className="max-w-[160px]" data-invalid={termInvalid}>
                <InputField
                  testID="billing-term-days"
                  value={termDays}
                  onChangeText={setTermDays}
                  keyboardType="number-pad"
                  placeholder="8"
                />
              </Input>
              {termInvalid ? <Text size="xs" className="text-destructive">{t("billing.defaults.termInvalid")}</Text> : null}
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.vatRate")}</Text>
              <OptionChips
                testIDPrefix="billing-vat-rate"
                clearable
                value={form.defaultVatRate}
                onChange={(v) => set("defaultVatRate", v)}
                options={DEFAULT_VAT_RATES.map((value) => ({ value, label: `${value}%` }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.currency")}</Text>
              <OptionChips
                testIDPrefix="billing-currency"
                clearable
                value={form.defaultCurrency}
                onChange={(v) => set("defaultCurrency", v)}
                options={CURRENCIES.map((value) => ({ value, label: value }))}
              />
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("billing.defaults.note")}</Text>
              <Textarea>
                <TextareaInput
                  testID="billing-note"
                  value={form.defaultNote ?? ""}
                  onChangeText={(v) => set("defaultNote", v)}
                  maxLength={MAX_DEFAULT_NOTE_LENGTH}
                  placeholder={t("billing.defaults.notePlaceholder")}
                />
              </Textarea>
            </VStack>
          </VStack>
        </Card>

        {message ? (
          <Text size="sm" className={message.kind === "ok" ? "text-green-600" : "text-destructive"} testID="billing-message">
            {message.text}
          </Text>
        ) : null}
        <Button onPress={() => void handleSave()} disabled={!canSave} testID="billing-save">
          <ButtonText>{saving ? t("common.saving") : t("billing.save")}</ButtonText>
        </Button>
      </VStack>
    </ScreenLayout>
  );
}
