// app/(app)/invoices/new.tsx
import * as React from "react";
import { ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Settings,
  ShoppingCart,
  User,
} from "lucide-react-native";
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
import { useClients } from "@/hooks/useClients";
import { useCompany } from "@/hooks/useCompany";
import { useInvoices } from "@/hooks/useInvoices";
import { apiFetch } from "@/lib/api/client";
import {
  applyClientToFormFields,
  composeInvoiceNotes,
  formatClientBillToLines,
} from "@/lib/invoices/client-form-fields";
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

function currentTime(): string {
  return new Date().toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionHeader({
  icon: Icon,
  title,
  iconColor,
}: {
  icon: typeof User;
  title: string;
  iconColor: string;
}) {
  return (
    <HStack space="sm" className="items-center pb-1">
      <Icon size={18} color={iconColor} />
      <Text className="text-base font-semibold text-foreground">{title}</Text>
    </HStack>
  );
}

export default function NewInvoiceScreen() {
  const { t } = useTranslation();
  const { invoices, addOrUpdate } = useInvoices();
  const { clients } = useClients();
  const { company } = useCompany();
  const icons = useIconColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [documentType, setDocumentType] = React.useState<DocumentType>("invoice");
  const [showPreview, setShowPreview] = React.useState(false);

  const [clientId, setClientId] = React.useState<string | null>(null);
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
  const [navEnabled, setNavEnabled] = React.useState(false);
  const [emailOnSend, setEmailOnSend] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [lineItems, setLineItems] = React.useState([createEmptyLineItem()]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(generateInvoiceNumber(invoices));
    }
  }, [invoiceNumber, invoices]);

  React.useEffect(() => {
    setDueDate(addDaysIso(deadlineDays));
  }, [deadlineDays]);

  React.useEffect(() => {
    if (!bankAccount && company?.bankAccount) {
      setBankAccount(company.bankAccount);
    }
  }, [bankAccount, company?.bankAccount]);

  React.useEffect(() => {
    setSavedAt(currentTime());
  }, [clientName, lineItems, notes, paymentMethod, currency, deadlineDays]);

  function handleDocumentTypeChange(type: DocumentType) {
    if (type === "receipt") {
      router.replace(routes.newReceipt);
      return;
    }
    setDocumentType(type);
  }

  function handleSelectClient(id: string) {
    const selected = clients.find((entry) => entry.id === id);
    if (!selected) {
      return;
    }
    const fields = applyClientToFormFields(selected);
    setClientId(fields.clientId);
    setClientName(fields.clientName);
    setClientTaxNumber(fields.clientTaxNumber);
    setClientEmail(fields.clientEmail);
    setClientCountry(fields.clientCountry);
    setClientZip(fields.clientZip);
    setClientCity(fields.clientCity);
    setClientAddress(fields.clientAddress);
    if (fields.clientEmail) {
      setEmailOnSend(true);
    }
  }

  const totals = calculateInvoiceTotals(lineItems);

  const composedNotes = React.useMemo(
    () =>
      composeInvoiceNotes({
        userNotes: notes,
        paymentMethod: t(
          PAYMENT_METHOD_I18N.find((entry) => entry.value === paymentMethod)?.i18nKey ??
            "invoices.paymentMethods.transfer",
        ),
        bankAccount,
        fulfillmentDate,
        billToLines: formatClientBillToLines({
          clientId,
          clientName,
          clientTaxNumber,
          clientEmail,
          clientCountry,
          clientZip,
          clientCity,
          clientAddress,
        }),
      }),
    [
      notes,
      paymentMethod,
      bankAccount,
      fulfillmentDate,
      clientId,
      clientName,
      clientTaxNumber,
      clientEmail,
      clientCountry,
      clientZip,
      clientCity,
      clientAddress,
      t,
    ],
  );

  const draftInvoice = React.useMemo(
    () =>
      buildDraftInvoice({
        invoiceNumber,
        clientName,
        clientTaxNumber,
        issueDate,
        dueDate,
        currency,
        notes: composedNotes,
        lineItems: ensureDraftLineItems(
          lineItems.filter((item) => item.description.trim()),
        ),
      }),
    [
      invoiceNumber,
      clientName,
      clientTaxNumber,
      issueDate,
      dueDate,
      currency,
      composedNotes,
      lineItems,
    ],
  );

  async function handleSave(status: InvoiceStatus) {
    setError(null);

    if (!clientName.trim()) {
      setError(t("invoices.errors.clientRequired"));
      setShowPreview(false);
      return;
    }
    if (!lineItems.some((item) => item.description.trim())) {
      setError(t("invoices.errors.lineItemRequired"));
      setShowPreview(false);
      return;
    }
    if (emailOnSend && status === "sent" && !clientEmail.trim()) {
      setError(t("invoices.errors.clientEmailRequired", {
        defaultValue: "Email küldéshez add meg a partner email címét.",
      }));
      setShowAdvanced(true);
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
        clientId: clientId ?? undefined,
        issueDate,
        dueDate,
        status: resolvedStatus,
        currency,
        lineItems: lineItems.filter((item) => item.description.trim()),
        notes: composedNotes,
        createdAt: now,
        updatedAt: now,
      };
      const saved = await addOrUpdate(invoice);

      if (resolvedStatus === "sent" && emailOnSend) {
        await apiFetch(`/api/invoices/${saved.id}/send`, {
          method: "POST",
          body: JSON.stringify({
            to: clientEmail.trim() || undefined,
          }),
        });
      }

      if (resolvedStatus === "sent" && navEnabled) {
        try {
          await apiFetch("/api/nav/submit", {
            method: "POST",
            body: JSON.stringify({ invoiceId: saved.id }),
          });
        } catch (navError) {
          // Keep the invoice saved; NAV may be unconfigured in local/dev.
          setError(
            navError instanceof Error
              ? `${t("invoices.errors.navSubmitFailed", {
                  defaultValue: "A számla mentve, de a NAV beküldés sikertelen:",
                })} ${navError.message}`
              : t("invoices.errors.navSubmitFailed", {
                  defaultValue: "A számla mentve, de a NAV beküldés sikertelen.",
                }),
          );
          router.replace(routes.invoiceDetail(saved.id));
          return;
        }
      }

      router.replace(routes.invoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoices.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-[1280px] gap-5 p-4 pb-52 md:gap-6 md:px-10 md:py-6 md:pb-36"
        keyboardShouldPersistTaps="handled"
      >
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: t("invoices.breadcrumbs.home"), href: routes.dashboard },
            { label: t("invoices.breadcrumbs.invoices"), href: routes.invoices },
          ]}
        />

        {/* Title + auto-save indicator */}
        <Box className="gap-2 md:flex-row md:items-center md:justify-between">
          <Heading size="2xl" className="text-foreground">
            {t("invoices.newDocument")}
          </Heading>
          {savedAt ? (
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.autoSavedAt", { time: savedAt })}
            </Text>
          ) : null}
        </Box>

        {/* Document type tabs */}
        <DocumentTypeTabs selected={documentType} onChange={handleDocumentTypeChange} />

        {showPreview ? (
          <VStack space="md">
            <InvoiceDocumentPreview invoice={draftInvoice} />
            <Button variant="outline" onPress={() => setShowPreview(false)}>
              <ButtonText>{t("invoices.actions.backToEdit")}</ButtonText>
            </Button>
          </VStack>
        ) : (
          <>
            {/* Two-column form sections */}
            <Box className={isDesktop ? "flex-row gap-6" : "gap-6"}>
              {/* Left: Recipient */}
              <Card className="flex-1 p-4 md:p-5">
                <VStack space="md">
                  <SectionHeader
                    icon={User}
                    title={t("invoices.sections.recipient")}
                    iconColor={icons.primary}
                  />

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.partnerNameOrTax")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder={t("invoices.placeholders.searchPartner")}
                        value={clientName}
                        onChangeText={(value) => {
                          setClientName(value);
                          setClientId(null);
                        }}
                        className="font-light"
                      />
                    </Input>
                  </FormControl>

                  {clients.length > 0 ? (
                    <VStack space="xs">
                      <Text size="xs" className="font-light text-muted-foreground">
                        {t("invoices.fields.savedPartners", {
                          defaultValue: "Mentett partnerek",
                        })}
                      </Text>
                      <HStack space="xs" className="flex-wrap">
                        {clients.slice(0, 8).map((entry) => {
                          const selected = clientId === entry.id;
                          return (
                            <Pressable
                              key={entry.id}
                              onPress={() => handleSelectClient(entry.id)}
                              className={`rounded-md border px-3 py-1.5 ${
                                selected
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background"
                              }`}
                            >
                              <Text
                                size="xs"
                                className={
                                  selected
                                    ? "font-medium text-primary"
                                    : "font-light text-foreground"
                                }
                              >
                                {entry.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </HStack>
                    </VStack>
                  ) : null}

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.country")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        value={clientCountry}
                        onChangeText={setClientCountry}
                        className="font-light"
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
                        className="font-light"
                      />
                    </Input>
                  </FormControl>

                  <Box className="gap-3 md:flex-row">
                    <FormControl className="w-[100px]">
                      <FormControlLabel>
                        <FormControlLabelText>{t("invoices.fields.zipCode")}</FormControlLabelText>
                      </FormControlLabel>
                      <Input>
                        <InputField
                          placeholder="1011"
                          value={clientZip}
                          onChangeText={setClientZip}
                          className="font-light"
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
                          className="font-light"
                        />
                      </Input>
                    </FormControl>
                  </Box>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.address")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder={t("invoices.placeholders.address")}
                        value={clientAddress}
                        onChangeText={setClientAddress}
                        className="font-light"
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
                        className="font-light"
                      />
                    </Input>
                    <Text size="xs" className="mt-1 font-light text-muted-foreground">
                      {t("invoices.fields.emailHint")}
                    </Text>
                  </FormControl>
                </VStack>
              </Card>

              {/* Right: Dates & Payment */}
              <Card className="flex-1 p-4 md:p-5">
                <VStack space="md">
                  <SectionHeader
                    icon={Settings}
                    title={t("invoices.sections.datesPayment")}
                    iconColor={icons.primary}
                  />

                  <Box className="gap-3 md:flex-row">
                    <FormControl className="flex-1">
                      <FormControlLabel>
                        <FormControlLabelText>{t("invoices.fields.fulfillmentDate")}</FormControlLabelText>
                      </FormControlLabel>
                      <Input>
                        <InputField
                          placeholder="ÉÉÉÉ-HH-NN"
                          value={fulfillmentDate}
                          onChangeText={setFulfillmentDate}
                          className="font-light"
                        />
                      </Input>
                    </FormControl>
                    <FormControl className="flex-1">
                      <FormControlLabel>
                        <FormControlLabelText>{t("invoices.fields.issueDate")}</FormControlLabelText>
                      </FormControlLabel>
                      <Input>
                        <InputField
                          placeholder="ÉÉÉÉ-HH-NN"
                          value={issueDate}
                          onChangeText={setIssueDate}
                          className="font-light"
                        />
                      </Input>
                    </FormControl>
                  </Box>

                  <HStack className="items-center justify-between">
                    <Text size="sm" className="font-light">{t("invoices.fields.continuousPerformance")}</Text>
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
                          className={`rounded-lg border px-4 py-2 ${
                            paymentMethod === pm.value
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
                          onPress={() => setCurrency(value)}
                          className={`rounded-lg border px-4 py-2 ${
                            currency === value
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <Text size="sm" className="font-light">{value}</Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </FormControl>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.paymentDeadline")}</FormControlLabelText>
                    </FormControlLabel>
                    <HStack space="sm" className="flex-wrap items-center">
                      <Input className="w-[70px]">
                        <InputField
                          keyboardType="number-pad"
                          value={String(deadlineDays)}
                          onChangeText={(v) => setDeadlineDays(Math.max(1, Number(v) || 1))}
                          className="font-light"
                        />
                      </Input>
                      <Text size="sm" className="font-light text-muted-foreground">
                        {t("invoices.fields.days")}
                      </Text>
                      {DEADLINE_QUICK_DAYS.map((d) => (
                        <Pressable
                          key={d}
                          onPress={() => setDeadlineDays(d)}
                          className={`rounded-lg border px-3 py-1 ${
                            deadlineDays === d
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <Text size="xs" className="font-light">{d}</Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </FormControl>

                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>{t("invoices.fields.bankAccount")}</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        placeholder={t("invoices.placeholders.selectBankAccount")}
                        value={bankAccount}
                        onChangeText={setBankAccount}
                        className="font-light"
                      />
                    </Input>
                  </FormControl>
                </VStack>
              </Card>
            </Box>

            {/* Line items section */}
            <Card className="p-4 md:p-5">
              <VStack space="md">
                <SectionHeader
                  icon={ShoppingCart}
                  title={t("invoices.sections.lineItems")}
                  iconColor={icons.primary}
                />
                <LineItemEditor
                  lineItems={lineItems}
                  currency={currency}
                  onChange={setLineItems}
                />
              </VStack>
            </Card>

            {/* Additional settings (collapsible) */}
            <Pressable
              onPress={() => setShowAdvanced(!showAdvanced)}
              className="flex-row items-center gap-2 rounded-lg border border-border bg-card p-4"
            >
              <Settings size={16} color={icons.muted} />
              <Text size="sm" className="flex-1 font-medium">
                {t("invoices.sections.additionalSettings")}
              </Text>
              {showAdvanced ? (
                <ChevronUp size={16} color={icons.muted} />
              ) : (
                <ChevronDown size={16} color={icons.muted} />
              )}
            </Pressable>

            {showAdvanced ? (
              <Card className="p-5">
                <VStack space="lg">
                  <HStack className="items-center justify-between">
                    <VStack>
                      <Text size="sm" className="font-medium">{t("invoices.fields.navSubmit")}</Text>
                      <Text size="xs" className="font-light text-muted-foreground">
                        {t("invoices.fields.navSubmitHint")}
                      </Text>
                    </VStack>
                    <Switch value={navEnabled} onValueChange={setNavEnabled} />
                  </HStack>

                  <HStack className="items-center justify-between">
                    <VStack>
                      <Text size="sm" className="font-medium">{t("invoices.fields.sendEmail")}</Text>
                      <Text size="xs" className="font-light text-muted-foreground">
                        {t("invoices.fields.sendEmailHint")}
                      </Text>
                    </VStack>
                    <Switch value={emailOnSend} onValueChange={setEmailOnSend} />
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
                        className="font-light"
                      />
                    </Textarea>
                  </FormControl>
                </VStack>
              </Card>
            ) : null}

            {error ? (
              <Text size="sm" className="text-destructive">{error}</Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Sticky footer */}
      {!showPreview ? (
        <Box className="border-t border-border bg-card px-4 py-3 shadow-lg md:px-10">
          <Box className="mx-auto w-full max-w-[1200px] gap-3 md:flex-row md:items-center md:justify-between">
            <VStack>
              <Text size="xs" className="font-light text-muted-foreground">
                {t("invoices.totals.netTotal")}: {formatCurrency(totals.subtotal, currency)}
              </Text>
              <Text size="sm" className="font-semibold text-foreground">
                {t("invoices.totals.grossTotal")}: {formatCurrency(totals.totalAmount, currency)}
              </Text>
            </VStack>
            <Box className="gap-2 md:flex-row">
              <Button variant="outline" size="sm" onPress={() => setShowPreview(true)}>
                <Eye size={16} color={icons.foreground} />
                <ButtonText>{t("invoices.actions.preview")}</ButtonText>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={() => handleSave("draft")}
                disabled={saving}
              >
                <ButtonText>{t("invoices.actions.saveDraft")}</ButtonText>
              </Button>
              <Button
                size="sm"
                onPress={() => handleSave(documentType === "proforma" ? "proforma" : "sent")}
                disabled={saving}
              >
                <ButtonText>{t("invoices.actions.createInvoice")}</ButtonText>
              </Button>
            </Box>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
