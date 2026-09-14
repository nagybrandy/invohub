// app/(app)/invoices/[id]/edit.tsx
// Edit an existing invoice. Drafts are fully editable; finalized documents
// (anything past "draft") are read-only with a hint to use storno/helyesbítő.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { DocumentTypeTabs, type DocumentType } from "@/components/invoices/DocumentTypeTabs";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { LineItemEditor } from "@/components/invoices/LineItemEditor";
import { apiFetch } from "@/lib/api/client";
import { useCompany } from "@/hooks/useCompany";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type {
  Invoice,
  InvoiceCurrency,
  InvoiceDocumentType,
  PaymentMethod,
} from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useRouteParam } from "@/lib/routing/route-param";
import { useInvoices } from "@/hooks/useInvoices";

const PAYMENT_METHOD_I18N: { value: PaymentMethod; i18nKey: string }[] = [
  { value: "transfer", i18nKey: "invoices.paymentMethods.transfer" },
  { value: "cash", i18nKey: "invoices.paymentMethods.cash" },
  { value: "card", i18nKey: "invoices.paymentMethods.card" },
  { value: "other", i18nKey: "invoices.paymentMethods.other" },
];

/** DocumentTypeTabs also offers "receipt" (a different domain); an existing invoice can't become one. */
function toInvoiceDocumentType(
  type: DocumentType,
  fallback: InvoiceDocumentType
): InvoiceDocumentType {
  return type === "receipt" ? fallback : type;
}

function toTabDocumentType(type: InvoiceDocumentType): DocumentType {
  return type === "storno" || type === "modify" ? "invoice" : type;
}

export default function EditInvoiceScreen() {
  const id = useRouteParam("id");
  const { t } = useTranslation();
  const { company } = useCompany();
  const { addOrUpdate } = useInvoices();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [exchangeRateInput, setExchangeRateInput] = React.useState("");

  React.useEffect(() => {
    if (!id) return;
    void apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`)
      .then((data) => {
        setInvoice(data.invoice);
        setExchangeRateInput(
          data.invoice.exchangeRate != null ? String(data.invoice.exchangeRate) : ""
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  function patch(fields: Partial<Invoice>) {
    setInvoice((current) => (current ? { ...current, ...fields } : current));
  }

  async function handleSave() {
    if (!invoice) return;
    setError(null);
    if (!invoice.clientName.trim()) {
      setError(t("invoices.errors.clientRequired"));
      return;
    }
    if (!invoice.lineItems.some((item) => item.description.trim())) {
      setError(t("invoices.errors.lineItemRequired"));
      return;
    }

    setSaving(true);
    try {
      const exchangeRate =
        invoice.currency !== "HUF" && exchangeRateInput.trim()
          ? Number(exchangeRateInput)
          : undefined;
      await addOrUpdate({
        ...invoice,
        lineItems: invoice.lineItems.filter((item) => item.description.trim()),
        exchangeRate,
        updatedAt: new Date().toISOString(),
      });
      router.replace(routes.invoiceDetail(id!));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoices.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !invoice) {
    return (
      <FormScreen>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  const totals = calculateInvoiceTotals(invoice.lineItems);
  const isFinalized = invoice.status !== "draft";

  if (isFinalized) {
    return (
      <FormScreen header={<Heading size="2xl">{t("invoices.edit.title")}</Heading>}>
        <VStack space="lg">
          <Card className="border-primary/30 bg-accent p-4">
            <VStack space="xs">
              <Text className="font-semibold">{t("invoices.edit.readOnlyTitle")}</Text>
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.edit.readOnlyHint")}
              </Text>
            </VStack>
          </Card>
          <InvoiceDocumentPreview invoice={invoice} invoiceId={id} />
          <Button variant="outline" onPress={() => router.replace(routes.invoiceDetail(id!))}>
            <ButtonText>{t("invoices.actions.backToEdit")}</ButtonText>
          </Button>
        </VStack>
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<Heading size="2xl">{t("invoices.edit.title")}</Heading>}>
      <VStack space="lg">
        <DocumentTypeTabs
          selected={toTabDocumentType(invoice.documentType)}
          onChange={(type) =>
            patch({ documentType: toInvoiceDocumentType(type, invoice.documentType) })
          }
        />

        <Card className="p-4 md:p-5">
          <VStack space="md">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("invoices.fields.partnerNameOrTax")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={invoice.clientName}
                  onChangeText={(v) => patch({ clientName: v })}
                />
              </Input>
            </FormControl>
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("invoices.fields.taxNumber")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  value={invoice.clientTaxNumber ?? ""}
                  onChangeText={(v) => patch({ clientTaxNumber: v || undefined })}
                  placeholder="12345678-1-23"
                />
              </Input>
            </FormControl>

            <HStack space="sm">
              <FormControl className="flex-1">
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.fields.issueDate")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={invoice.issueDate}
                    onChangeText={(v) => patch({ issueDate: v })}
                    placeholder="ÉÉÉÉ-HH-NN"
                  />
                </Input>
              </FormControl>
              <FormControl className="flex-1">
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.fields.paymentDeadline")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={invoice.dueDate}
                    onChangeText={(v) => patch({ dueDate: v })}
                    placeholder="ÉÉÉÉ-HH-NN"
                  />
                </Input>
              </FormControl>
            </HStack>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("invoices.fields.paymentMethod")}</FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm" className="flex-wrap">
                {PAYMENT_METHOD_I18N.map((pm) => (
                  <Pressable
                    key={pm.value}
                    onPress={() => patch({ paymentMethod: pm.value })}
                    className={`rounded-lg border px-4 py-2 ${
                      invoice.paymentMethod === pm.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text size="sm" className="font-light">{t(pm.i18nKey)}</Text>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>

            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("invoices.fields.currency")}</FormControlLabelText>
              </FormControlLabel>
              <HStack space="sm">
                {(["HUF", "EUR"] as InvoiceCurrency[]).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => patch({ currency: value })}
                    className={`rounded-lg border px-4 py-2 ${
                      invoice.currency === value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <Text size="sm" className="font-light">{value}</Text>
                  </Pressable>
                ))}
              </HStack>
            </FormControl>

            {invoice.currency !== "HUF" ? (
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.fields.exchangeRate")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    keyboardType="decimal-pad"
                    value={exchangeRateInput}
                    onChangeText={setExchangeRateInput}
                    placeholder="390.50"
                  />
                </Input>
                <Text size="xs" className="mt-1 font-light text-muted-foreground">
                  {t("invoices.fields.exchangeRateHint")}
                </Text>
              </FormControl>
            ) : null}
          </VStack>
        </Card>

        <Card className="p-4 md:p-5">
          <LineItemEditor
            lineItems={invoice.lineItems}
            currency={invoice.currency}
            companyVatExempt={company?.vatExempt}
            onChange={(lineItems) => patch({ lineItems })}
          />
        </Card>

        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("invoices.fields.notes")}</FormControlLabelText>
          </FormControlLabel>
          <Textarea>
            <TextareaInput
              value={invoice.notes ?? ""}
              onChangeText={(v) => patch({ notes: v || undefined })}
              placeholder={t("invoices.placeholders.notes")}
            />
          </Textarea>
        </FormControl>

        <Text className="font-semibold">
          {t("invoices.totals.grossTotal")}: {formatCurrency(totals.totalAmount, invoice.currency)}
        </Text>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={() => void handleSave()} disabled={saving}>
          <ButtonText>{t("invoices.edit.saveChanges")}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
