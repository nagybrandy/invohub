import * as React from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Box } from "@/components/ui/box";
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
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DocumentTypeTabs, type DocumentType } from "@/components/invoices/DocumentTypeTabs";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { LineItemEditor } from "@/components/invoices/LineItemEditor";
import { ScreenModeTabs, type ScreenMode } from "@/components/invoices/ScreenModeTabs";
import { useInvoices } from "@/hooks/useInvoices";
import {
  buildDraftInvoice,
  ensureDraftLineItems,
} from "@/lib/invoices/build-draft-invoice";
import {
  calculateInvoiceTotals,
  createEmptyLineItem,
  createId,
  formatCurrency,
  generateInvoiceNumber,
} from "@/lib/invoices/calculations";
import type { Invoice, InvoiceCurrency, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useIconColors } from "@/lib/theme/icon-colors";

type PaymentMethod = "transfer" | "cash" | "card";

const PAYMENT_METHOD_I18N: { value: PaymentMethod; i18nKey: string }[] = [
  { value: "transfer", i18nKey: "invoices.paymentMethods.transfer" },
  { value: "cash", i18nKey: "invoices.paymentMethods.cash" },
  { value: "card", i18nKey: "invoices.paymentMethods.card" },
];

const DEADLINE_QUICK_DAYS = [8, 15, 30];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function NewInvoiceScreen() {
  const { t } = useTranslation();
  const { invoices, addOrUpdate } = useInvoices();
  const icons = useIconColors();

  const [documentType, setDocumentType] = React.useState<DocumentType>("invoice");
  const [screenMode, setScreenMode] = React.useState<ScreenMode>("edit");

  const [clientName, setClientName] = React.useState("");
  const [clientTaxNumber, setClientTaxNumber] = React.useState("");
  const [clientCountry, setClientCountry] = React.useState("Magyarország");
  const [clientZip, setClientZip] = React.useState("");
  const [clientCity, setClientCity] = React.useState("");
  const [clientAddress, setClientAddress] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");

  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [fulfillmentDate, setFulfillmentDate] = React.useState(todayIso());
  const [issueDate, setIssueDate] = React.useState(todayIso());
  const [continuousPerformance, setContinuousPerformance] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("transfer");
  const [currency, setCurrency] = React.useState<InvoiceCurrency>("HUF");
  const [deadlineDays, setDeadlineDays] = React.useState(8);
  const [dueDate, setDueDate] = React.useState(addDaysIso(8));
  const [bankAccount, setBankAccount] = React.useState("");

  const [notes, setNotes] = React.useState("");
  const [navEnabled, setNavEnabled] = React.useState(true);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [lineItems, setLineItems] = React.useState([createEmptyLineItem()]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(generateInvoiceNumber(invoices));
    }
  }, [invoiceNumber, invoices]);

  React.useEffect(() => {
    setDueDate(addDaysIso(deadlineDays));
  }, [deadlineDays]);

  function handleDocumentTypeChange(type: DocumentType) {
    if (type === "receipt") {
      router.replace(routes.newReceipt);
      return;
    }
    setDocumentType(type);
  }

  const totals = calculateInvoiceTotals(lineItems);

  const draftInvoice = React.useMemo(
    () =>
      buildDraftInvoice({
        invoiceNumber,
        clientName,
        clientTaxNumber,
        issueDate,
        dueDate,
        currency,
        notes,
        lineItems: ensureDraftLineItems(
          lineItems.filter((item) => item.description.trim())
        ),
      }),
    [invoiceNumber, clientName, clientTaxNumber, issueDate, dueDate, currency, notes, lineItems]
  );

  async function handleSave(status: InvoiceStatus) {
    setError(null);

    if (!clientName.trim()) {
      setError("Az ügyfél neve kötelező.");
      setScreenMode("edit");
      return;
    }
    if (!lineItems.some((item) => item.description.trim())) {
      setError("Legalább egy tételt adj meg.");
      setScreenMode("edit");
      return;
    }

    const resolvedStatus: InvoiceStatus =
      documentType === "proforma" ? "proforma" : status;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const invoice: Invoice = {
        id: createId(),
        invoiceNumber: invoiceNumber.trim() || generateInvoiceNumber(invoices),
        clientName: clientName.trim(),
        clientTaxNumber: clientTaxNumber.trim() || undefined,
        issueDate,
        dueDate,
        status: resolvedStatus,
        currency,
        lineItems: lineItems.filter((item) => item.description.trim()),
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      await addOrUpdate(invoice);
      router.replace(routes.invoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoices.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4 pb-36"
      keyboardShouldPersistTaps="handled"
    >
      <VStack space="md">
        <Breadcrumb
          items={[
            { label: t("invoices.breadcrumbs.home"), href: routes.dashboard },
            { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          ]}
        />
        <Heading size="2xl">{t("invoices.newDocument")}</Heading>
        <DocumentTypeTabs selected={documentType} onChange={handleDocumentTypeChange} />
        <ScreenModeTabs mode={screenMode} onChange={setScreenMode} />
      </VStack>

      {screenMode === "preview" ? (
        <VStack space="md">
          <Text size="sm" className="text-muted-foreground">
            Élő előnézet a bizonylat végleges kinézetéről.
          </Text>
          <InvoiceDocumentPreview invoice={draftInvoice} />
          <Button variant="outline" onPress={() => setScreenMode("edit")}>
            <ButtonText>Vissza a szerkesztéshez</ButtonText>
          </Button>
        </VStack>
      ) : (
        <>
          <Box className="flex-col gap-4 md:flex-row">
            <Card className="flex-1 p-4">
              <VStack space="md">
                <Heading size="md">{t("invoices.sections.recipient")}</Heading>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.partnerNameOrTax")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder={t("invoices.placeholders.searchPartner")}
                      value={clientName}
                      onChangeText={setClientName}
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.country")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      value={clientCountry}
                      onChangeText={setClientCountry}
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.taxNumber")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder="12345678-1-23"
                      value={clientTaxNumber}
                      onChangeText={setClientTaxNumber}
                    />
                  </Input>
                </FormControl>

                <HStack space="sm">
                  <FormControl className="w-[100px]">
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.zipCode")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder="1011"
                        value={clientZip}
                        onChangeText={setClientZip}
                      />
                    </Input>
                  </FormControl>
                  <FormControl className="flex-1">
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.city")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder={t("invoices.placeholders.city")}
                        value={clientCity}
                        onChangeText={setClientCity}
                      />
                    </Input>
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.address")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder={t("invoices.placeholders.address")}
                      value={clientAddress}
                      onChangeText={setClientAddress}
                    />
                  </Input>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.email")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder="partner@ceg.hu"
                      value={clientEmail}
                      onChangeText={setClientEmail}
                      keyboardType="email-address"
                    />
                  </Input>
                  <Text size="xs" className="mt-1 text-muted-foreground">
                    Ide küldjük a bizonylatot
                  </Text>
                </FormControl>
              </VStack>
            </Card>

            <Card className="flex-1 p-4">
              <VStack space="md">
                <Heading size="md">{t("invoices.sections.datesPayment")}</Heading>

                <HStack space="sm">
                  <FormControl className="flex-1">
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.fulfillmentDate")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder="ÉÉÉÉ-HH-NN"
                        value={fulfillmentDate}
                        onChangeText={setFulfillmentDate}
                      />
                    </Input>
                  </FormControl>
                  <FormControl className="flex-1">
                    <FormControlLabel>
                      <FormControlLabelText>Kiállítás dátuma</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder="ÉÉÉÉ-HH-NN"
                        value={issueDate}
                        onChangeText={setIssueDate}
                      />
                    </Input>
                  </FormControl>
                </HStack>

                <HStack className="items-center justify-between">
                  <Text size="sm">{t("invoices.fields.continuousPerformance")}</Text>
                  <Switch
                    value={continuousPerformance}
                    onValueChange={setContinuousPerformance}
                  />
                </HStack>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.paymentMethod")}</FormControlLabelText>
                  </FormControlLabel>
                  <HStack space="sm" className="flex-wrap">
                    {PAYMENT_METHOD_I18N.map((pm) => (
                      <Pressable
                        key={pm.value}
                        onPress={() => setPaymentMethod(pm.value)}
                        className={`rounded-md border px-4 py-2 ${
                          paymentMethod === pm.value
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <Text size="sm">{t(pm.i18nKey)}</Text>
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
                        onPress={() => setCurrency(value)}
                        className={`rounded-md border px-4 py-2 ${
                          currency === value
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <Text size="sm">{value}</Text>
                      </Pressable>
                    ))}
                  </HStack>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.paymentDeadline")}</FormControlLabelText>
                  </FormControlLabel>
                  <HStack space="sm" className="items-center">
                    <Input className="w-[70px]">
                      <InputField
                        keyboardType="number-pad"
                        value={String(deadlineDays)}
                        onChangeText={(v) => setDeadlineDays(Math.max(1, Number(v) || 1))}
                      />
                    </Input>
                    <Text size="sm" className="text-muted-foreground">{t("invoices.fields.days")}</Text>
                    {DEADLINE_QUICK_DAYS.map((d) => (
                      <Pressable
                        key={d}
                        onPress={() => setDeadlineDays(d)}
                        className={`rounded-md border px-3 py-1 ${
                          deadlineDays === d
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <Text size="xs">{d}</Text>
                      </Pressable>
                    ))}
                  </HStack>
                </FormControl>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>Bankszámla</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder={t("invoices.placeholders.selectBankAccount")}
                      value={bankAccount}
                      onChangeText={setBankAccount}
                    />
                  </Input>
                </FormControl>
              </VStack>
            </Card>
          </Box>

          <Card className="p-4">
            <VStack space="md">
              <Heading size="md">{t("invoices.sections.lineItems")}</Heading>
              <LineItemEditor
                lineItems={lineItems}
                currency={currency}
                onChange={setLineItems}
              />
            </VStack>
          </Card>

          <Pressable
            onPress={() => setShowAdvanced(!showAdvanced)}
            className="flex-row items-center gap-2 rounded-lg border border-border p-3"
          >
            <Text size="sm" className="flex-1 font-medium">{t("invoices.sections.additionalSettings")}</Text>
            {showAdvanced ? (
              <ChevronUp size={16} color={icons.muted} />
            ) : (
              <ChevronDown size={16} color={icons.muted} />
            )}
          </Pressable>

          {showAdvanced && (
            <Card className="p-4">
              <VStack space="md">
                <HStack className="items-center justify-between">
                  <VStack>
                    <Text size="sm" className="font-medium">{t("invoices.fields.navSubmit")}</Text>
                    <Text size="xs" className="text-muted-foreground">
                      Automatikus beküldés a NAV rendszerébe
                    </Text>
                  </VStack>
                  <Switch value={navEnabled} onValueChange={setNavEnabled} />
                </HStack>

                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.fields.notes")}</FormControlLabelText>
                  </FormControlLabel>
                  <Textarea>
                    <TextareaInput
                      placeholder={t("invoices.placeholders.notes")}
                      value={notes}
                      onChangeText={setNotes}
                    />
                  </Textarea>
                </FormControl>
              </VStack>
            </Card>
          )}

          {error ? (
            <Text size="sm" className="text-destructive">
              {error}
            </Text>
          ) : null}

          <Card className="sticky bottom-0 p-4">
            <HStack className="items-center justify-between">
              <VStack>
                <HStack space="md">
                  <Text size="sm" className="text-muted-foreground">
                    Nettó: {formatCurrency(totals.subtotal, currency)}
                  </Text>
                  <Text size="sm" className="font-semibold">
                    {t("invoices.totals.grossTotal")}: {formatCurrency(totals.totalAmount, currency)}
                  </Text>
                </HStack>
              </VStack>
              <HStack space="sm">
                <Button
                  variant="outline"
                  onPress={() => handleSave("draft")}
                  disabled={saving}
                >
                  <ButtonText>{t("invoices.actions.saveDraft")}</ButtonText>
                </Button>
                <Button
                  onPress={() => handleSave(documentType === "proforma" ? "proforma" : "sent")}
                  disabled={saving}
                >
                  <ButtonText>
                    {t("invoices.actions.createInvoice")}
                  </ButtonText>
                </Button>
              </HStack>
            </HStack>
          </Card>
        </>
      )}
    </ScrollView>
  );
}
