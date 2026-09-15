// components/invoices/composer/StepPartner.tsx
// Step 1: exactly one required field (the partner). Everything else — the
// selected partner's details and the dates/payment defaults — starts
// collapsed (spec §2.3, fixing the 14-field wall of INV-1).
import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { PartnerPicker } from "@/components/invoices/composer/PartnerPicker";
import { DEADLINE_QUICK_DAYS } from "@/components/invoices/composer/useInvoiceComposer";
import type { Client } from "@/lib/clients/service";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";
import type { InvoiceCurrency, PaymentMethod } from "@/lib/invoices/types";
import { useIconColors } from "@/lib/theme/icon-colors";

const PAYMENT_METHOD_I18N: { value: PaymentMethod; i18nKey: string }[] = [
  { value: "transfer", i18nKey: "invoices.paymentMethods.transfer" },
  { value: "cash", i18nKey: "invoices.paymentMethods.cash" },
  { value: "card", i18nKey: "invoices.paymentMethods.card" },
  { value: "other", i18nKey: "invoices.paymentMethods.other" },
];

export function StepPartner(composer: InvoiceComposerState) {
  const icons = useIconColors();
  const {
    t,
    clients,
    clientId,
    clientName,
    clientTaxNumber,
    clientEmail,
    clientCountry,
    clientZip,
    clientCity,
    clientAddress,
    setClientName,
    setClientTaxNumber,
    setClientEmail,
    setClientCountry,
    setClientZip,
    setClientCity,
    setClientAddress,
    handleSelectClient,
    clearClient,
    showClientDetails,
    setShowClientDetails,
    showDatesPayment,
    setShowDatesPayment,
    fulfillmentDate,
    setFulfillmentDate,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    continuousPerformance,
    setContinuousPerformance,
    paymentMethod,
    setPaymentMethod,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    deadlineDays,
    setDeadlineDays,
    bankAccount,
    setBankAccount,
    errors,
    focusField,
    clearFocusField,
  } = composer;

  const selectedClient: Client | undefined = clients.find((c) => c.id === clientId);
  const recentClients = React.useMemo(() => clients.slice(0, 4), [clients]);
  const nameInputRef = React.useRef<{ focus: () => void } | null>(null);

  React.useEffect(() => {
    if (focusField === "clientName") {
      nameInputRef.current?.focus?.();
      clearFocusField();
    }
  }, [focusField, clearFocusField]);

  async function handleCreateNewClient(input: { name: string; email: string; taxNumber: string }) {
    // Composer-local partner: not persisted to /api/clients from here —
    // keeps the composer independent of the clients CRUD surface. The
    // invoice still carries the typed name/e-mail/tax number.
    setClientName(input.name);
    setClientEmail(input.email);
    setClientTaxNumber(input.taxNumber);
  }

  return (
    <VStack space="lg">
      {clientId && selectedClient && !showClientDetails ? (
        <VStack space="sm" className="rounded-lg border border-border bg-card p-4">
          <HStack className="items-center justify-between">
            <VStack>
              <Text className="font-semibold text-foreground">{selectedClient.name}</Text>
              {selectedClient.taxNumber ? (
                <Text size="sm" className="text-muted-foreground">
                  {selectedClient.taxNumber}
                </Text>
              ) : null}
              {selectedClient.address || selectedClient.city ? (
                <Text size="sm" className="text-muted-foreground">
                  {[selectedClient.zipCode, selectedClient.city, selectedClient.address]
                    .filter(Boolean)
                    .join(" ")}
                </Text>
              ) : null}
              {selectedClient.email ? (
                <Text size="sm" className="text-muted-foreground">
                  {selectedClient.email}
                </Text>
              ) : null}
            </VStack>
            <VStack space="xs">
              <Pressable onPress={() => setShowClientDetails(true)}>
                <Text size="sm" className="font-medium text-primary">
                  {t("invoices.composer.editPartnerDetails")}
                </Text>
              </Pressable>
              <Pressable onPress={clearClient}>
                <Text size="sm" className="text-muted-foreground">
                  {t("invoices.composer.changePartner")}
                </Text>
              </Pressable>
            </VStack>
          </HStack>
        </VStack>
      ) : (
        <VStack space="xs">
          <Text size="sm" className="font-medium text-foreground">
            {t("invoices.fields.partnerNameOrTax")} <Text className="text-destructive">*</Text>
          </Text>
          <PartnerPicker
            inputRef={nameInputRef}
            clients={clients}
            recentClients={recentClients}
            value={clientName}
            onChangeText={setClientName}
            onSelect={handleSelectClient}
            onCreateNew={handleCreateNewClient}
            error={errors.partner}
            t={t}
          />
        </VStack>
      )}

      {clientId && selectedClient && showClientDetails ? (
        <VStack space="sm" className="rounded-lg border border-border bg-card p-4">
          <HStack className="items-center justify-between">
            <Text className="font-medium text-foreground">{t("invoices.composer.editPartnerDetails")}</Text>
            <Pressable onPress={() => setShowClientDetails(false)}>
              <Text size="sm" className="text-primary">{t("invoices.actions.backToEdit")}</Text>
            </Pressable>
          </HStack>
          <VStack space="sm">
            <LabeledInput label={t("invoices.fields.taxNumber")} value={clientTaxNumber} onChangeText={setClientTaxNumber} />
            <HStack space="sm">
              <VStack className="w-[100px]">
                <LabeledInput label={t("invoices.fields.zipCode")} value={clientZip} onChangeText={setClientZip} />
              </VStack>
              <VStack className="flex-1">
                <LabeledInput label={t("invoices.fields.city")} value={clientCity} onChangeText={setClientCity} />
              </VStack>
            </HStack>
            <LabeledInput label={t("invoices.fields.address")} value={clientAddress} onChangeText={setClientAddress} />
            <LabeledInput label={t("invoices.fields.country")} value={clientCountry} onChangeText={setClientCountry} />
            <LabeledInput
              label={t("invoices.fields.email")}
              value={clientEmail}
              onChangeText={setClientEmail}
              hint={t("invoices.fields.emailHint")}
            />
          </VStack>
        </VStack>
      ) : null}

      <Pressable
        onPress={() => setShowDatesPayment(!showDatesPayment)}
        className="flex-row items-center gap-2 rounded-lg border border-border bg-card p-4"
        testID="composer-toggle-dates-payment"
      >
        <Text size="sm" className="flex-1 font-medium text-foreground">
          {t("invoices.sections.datesPayment")}
        </Text>
        {showDatesPayment ? (
          <ChevronUp size={16} color={icons.muted} />
        ) : (
          <ChevronDown size={16} color={icons.muted} />
        )}
      </Pressable>

      {showDatesPayment ? (
        <VStack space="md" className="rounded-lg border border-border bg-card p-4">
          <HStack space="sm" className="flex-wrap">
            <VStack className="min-w-[160px] flex-1">
              <Text size="xs" className="mb-1 text-muted-foreground">{t("invoices.fields.fulfillmentDate")}</Text>
              <DateInput value={fulfillmentDate} onChangeText={setFulfillmentDate} />
            </VStack>
            <VStack className="min-w-[160px] flex-1">
              <Text size="xs" className="mb-1 text-muted-foreground">{t("invoices.fields.issueDate")}</Text>
              <DateInput value={issueDate} onChangeText={setIssueDate} />
            </VStack>
            <VStack className="min-w-[160px] flex-1">
              <Text size="xs" className="mb-1 text-muted-foreground">{t("invoices.fields.paymentDeadline")}</Text>
              <DateInput value={dueDate} onChangeText={setDueDate} invalid={Boolean(errors.dueDate)} testID="composer-due-date" />
              {errors.dueDate ? (
                <Text size="xs" className="mt-1 text-destructive">{errors.dueDate}</Text>
              ) : null}
            </VStack>
          </HStack>

          <HStack space="xs" className="flex-wrap items-center">
            <Text size="xs" className="text-muted-foreground">{t("invoices.composer.deadlineQuickPick")}</Text>
            {DEADLINE_QUICK_DAYS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDeadlineDays(d)}
                className={`rounded-lg border px-3 py-1 ${
                  deadlineDays === d ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <Text size="xs">
                  {d} {t("invoices.fields.days")}
                </Text>
              </Pressable>
            ))}
          </HStack>

          <HStack className="items-center justify-between">
            <Text size="sm" className="font-light text-foreground">{t("invoices.fields.continuousPerformance")}</Text>
            <Switch value={continuousPerformance} onValueChange={setContinuousPerformance} />
          </HStack>

          <VStack space="xs">
            <Text size="xs" className="text-muted-foreground">{t("invoices.fields.paymentMethod")}</Text>
            <HStack space="sm" className="flex-wrap">
              {PAYMENT_METHOD_I18N.map((pm) => (
                <Pressable
                  key={pm.value}
                  onPress={() => setPaymentMethod(pm.value)}
                  className={`rounded-lg border px-3 py-1.5 ${
                    paymentMethod === pm.value ? "border-primary bg-primary/10" : "border-border bg-background"
                  }`}
                >
                  <Text size="sm">{t(pm.i18nKey)}</Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>

          <HStack space="sm" className="flex-wrap items-end">
            <VStack space="xs">
              <Text size="xs" className="text-muted-foreground">{t("invoices.fields.currency")}</Text>
              <HStack space="sm">
                {(["HUF", "EUR"] as InvoiceCurrency[]).map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => setCurrency(value)}
                    className={`rounded-lg border px-3 py-1.5 ${
                      currency === value ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                  >
                    <Text size="sm">{value}</Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>
            {currency !== "HUF" ? (
              <VStack className="min-w-[140px]">
                <Text size="xs" className="text-muted-foreground">
                  {t("invoices.fields.exchangeRate")} <Text className="text-destructive">*</Text>
                </Text>
                <Input>
                  <InputField
                    value={exchangeRate}
                    onChangeText={setExchangeRate}
                    keyboardType="decimal-pad"
                    testID="composer-exchange-rate"
                  />
                </Input>
              </VStack>
            ) : null}
          </HStack>
          {currency !== "HUF" && errors.partner && clientName.trim() ? (
            // clientName is non-blank here, so a still-set `errors.partner`
            // can only be the exchange-rate error (save() checks the
            // partner-name error first and returns before this one) — never
            // the "client name required" message shown above by PartnerPicker.
            <Text size="xs" className="w-full text-destructive">
              {errors.partner}
            </Text>
          ) : null}

          <LabeledInput
            label={t("invoices.fields.bankAccount")}
            value={bankAccount}
            onChangeText={setBankAccount}
            placeholder={t("invoices.placeholders.selectBankAccount")}
          />
        </VStack>
      ) : null}
    </VStack>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  hint,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "email-address";
}) {
  return (
    <VStack space="xs">
      <Text size="xs" className="text-muted-foreground">{label}</Text>
      <Input>
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
        />
      </Input>
      {hint ? (
        <Text size="xs" className="text-muted-foreground">{hint}</Text>
      ) : null}
    </VStack>
  );
}
