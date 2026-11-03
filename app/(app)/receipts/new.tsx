// app/(app)/receipts/new.tsx
import { CurrencyPicker } from "@/components/settings/CurrencyPicker";
import { isCurrencyCode } from "@/lib/currency/currencies";
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { FormField } from "@/components/layout/FormField";
import { ComposerBottomBar } from "@/components/invoices/composer/ComposerBottomBar";
import { ComposerPage } from "@/components/invoices/composer/ComposerPage";
import { ComposerSection } from "@/components/invoices/composer/ComposerSection";
import { ReceiptItems } from "@/components/invoices/composer/ReceiptItems";
import { apiFetch } from "@/lib/api/client";
import { useCompany } from "@/hooks/useCompany";
import type { DocumentLanguage } from "@/lib/companies/billing-settings";
import { createId } from "@/lib/id";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import {
  calculateLineItemTotals,
  type ReceiptLineItemCalcInput,
} from "@/lib/receipts/calculations";
import type { ReceiptRecord } from "@/lib/receipts/service";
import {
  RECEIPT_PAYMENT_METHODS,
  type ReceiptCurrency,
  type ReceiptPaymentMethod,
} from "@/lib/receipts/types";
import QRCode from "react-native-qrcode-svg";

type DraftLineItem = ReceiptLineItemCalcInput & { id: string };


const PAYMENT_METHOD_LABEL_KEYS: Record<ReceiptPaymentMethod, string> = {
  cash: "receipts.paymentMethods.cash",
  card: "receipts.paymentMethods.card",
  transfer: "receipts.paymentMethods.transfer",
  voucher: "receipts.paymentMethods.voucher",
};

function createEmptyLineItem(): DraftLineItem {
  return {
    id: createId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 27,
    unit: "db",
  };
}

type EntryMode = "simple" | "detailed";

export default function NewReceiptScreen() {
  const { t } = useTranslation();

  const { company } = useCompany();
  const [currency, setCurrency] = React.useState<ReceiptCurrency>("HUF");
  const [language, setLanguage] = React.useState<DocumentLanguage>("hu");
  const [paymentMethod, setPaymentMethod] = React.useState<ReceiptPaymentMethod>("cash");
  const [entryMode, setEntryMode] = React.useState<EntryMode>("detailed");

  const [totalAmount, setTotalAmount] = React.useState("");
  const [lineItems, setLineItems] = React.useState<DraftLineItem[]>([
    createEmptyLineItem(),
  ]);

  const [created, setCreated] = React.useState<ReceiptRecord | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Company defaults (settings → Számlázási beállítások), applied once while
  // the form is still untouched — the same defaults an invoice starts from.
  const appliedDefaults = React.useRef(false);
  React.useEffect(() => {
    if (!company || appliedDefaults.current) return;
    appliedDefaults.current = true;
    if (isCurrencyCode(company.defaultCurrency)) setCurrency(company.defaultCurrency);
    if (company.defaultLanguage) setLanguage(company.defaultLanguage);
    if (company.defaultPaymentMethod && (RECEIPT_PAYMENT_METHODS as string[]).includes(company.defaultPaymentMethod)) {
      setPaymentMethod(company.defaultPaymentMethod as ReceiptPaymentMethod);
    }
  }, [company]);

  const totals = React.useMemo(
    () => calculateLineItemTotals(lineItems),
    [lineItems]
  );

  function updateItem(id: string, patch: Partial<DraftLineItem>) {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function removeItem(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem() {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  }

  function resetForm() {
    setCreated(null);
    setTotalAmount("");
    setLineItems([createEmptyLineItem()]);
    setError(null);
  }

  async function handleCreate() {
    setError(null);

    if (entryMode === "simple") {
      const amount = Number(totalAmount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(t("receipts.amountRequired"));
        return;
      }
    } else {
      if (!lineItems.some((item) => item.description.trim())) {
        setError(t("receipts.lineItemRequired"));
        return;
      }
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        // No receiptNumber / clientName: a nyugta strictly numbered (szigorú
        // számadású) — the server assigns the next number — and has no
        // customer on it.
        currency,
        paymentMethod,
        language,
      };

      if (entryMode === "simple") {
        body.totalAmount = Number(totalAmount.replace(",", "."));
      } else {
        body.lineItems = lineItems
          .filter((item) => item.description.trim())
          .map(({ description, quantity, unitPrice, vatRate, unit }) => ({
            description,
            quantity,
            unitPrice,
            vatRate,
            unit,
          }));
      }

      const data = await apiFetch<{ receipt: ReceiptRecord }>("/api/receipts", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCreated(data.receipt);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("receipts.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function copyQrUrl(url: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  if (created) {
    return (
      <FormScreen header={<Heading size="2xl">{t("receipts.new")}</Heading>}>
        <Card className="items-center p-6">
          <VStack space="md" className="w-full items-center">
            <Text className="text-center font-semibold text-foreground">
              {created.receiptNumber}
            </Text>
            <Text className="text-center text-lg font-bold text-foreground">
              {formatCurrency(created.totalAmount, created.currency)}
            </Text>
            <QRCode value={created.qrUrl} size={200} />
            <Text size="xs" className="text-center text-muted-foreground">
              {t("receipts.qrHint")}
            </Text>
            <Text size="xs" selectable className="text-center font-mono text-muted-foreground">
              {created.qrUrl}
            </Text>
            <HStack space="sm" className="flex-wrap justify-center">
              <Button variant="outline" onPress={() => void copyQrUrl(created.qrUrl)}>
                <ButtonText>{t("receipts.copyLink")}</ButtonText>
              </Button>
              <Button onPress={() => router.push(routes.receiptDetail(created.id))}>
                <ButtonText>{t("receipts.viewDetail")}</ButtonText>
              </Button>
              <Button variant="outline" onPress={resetForm}>
                <ButtonText>{t("receipts.createAnother")}</ButtonText>
              </Button>
            </HStack>
          </VStack>
        </Card>
      </FormScreen>
    );
  }

  const detailed = entryMode === "detailed";
  const simpleAmount = Number(totalAmount.replace(",", "."));
  const bottomGross = detailed ? totals.grossTotal : Number.isFinite(simpleAmount) ? simpleAmount : 0;

  return (
    <ComposerPage
      breadcrumb={[
        { label: t("invoices.breadcrumbs.home"), href: routes.dashboard },
        { label: t("nav.receipts"), href: routes.receipts },
        { label: t("receipts.new") },
      ]}
      title={t("composer.newReceiptTitle")}
      bottomBar={
        <ComposerBottomBar
          net={detailed ? totals.netTotal : undefined}
          gross={bottomGross}
          currency={currency}
          netLabel={t("receipts.netTotal")}
          grossLabel={t("receipts.grossTotal")}
          error={error ?? undefined}
        >
          <Button
            size="form"
            className="phone:flex-1"
            onPress={() => void handleCreate()}
            disabled={saving}
            testID="receipt-create"
          >
            <ButtonText>{saving ? t("common.loading") : t("receipts.create")}</ButtonText>
          </Button>
        </ComposerBottomBar>
      }
    >
      <ComposerSection title={t("composer.receiptDetailsTitle")} first testID="composer-section-receipt-details">
        <Text className="mb-4 text-sm text-muted-ink" testID="receipt-number-auto-hint">
          {t("receipts.numberAutoHint")}
        </Text>
        <Box className="flex-row flex-wrap gap-4">
          <FormField label={t("receipts.paymentMethod")} className="min-w-[220px] flex-1">
            <Select
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as ReceiptPaymentMethod)}
              options={RECEIPT_PAYMENT_METHODS.map((method) => ({
                value: method,
                label: t(PAYMENT_METHOD_LABEL_KEYS[method]),
              }))}
              accessibilityLabel={t("receipts.paymentMethod")}
              testID="receipt-payment-method"
            />
          </FormField>
          <FormField label={t("receipts.language")} className="min-w-[220px] flex-1">
            <Select
              value={language}
              onChange={(value) => setLanguage(value as DocumentLanguage)}
              options={(["hu", "en"] as const).map((value) => ({ value, label: t(`billing.languages.${value}`) }))}
              accessibilityLabel={t("receipts.language")}
              testID="receipt-language"
            />
          </FormField>
          <FormField label={t("receipts.currency")} className="w-full">
            <CurrencyPicker
              value={currency}
              onChange={(value) => value && setCurrency(value)}
              testIDPrefix="receipt-currency"
            />
          </FormField>
        </Box>
      </ComposerSection>

      <ReceiptItems
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        currency={currency}
        totalAmount={totalAmount}
        onTotalAmountChange={setTotalAmount}
        items={lineItems}
        onUpdate={updateItem}
        onAdd={addItem}
        onRemove={removeItem}
        totals={totals}
        t={t}
      />
    </ComposerPage>
  );
}
