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
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { PartnerPicker } from "@/components/invoices/composer/PartnerPicker";
import { DEADLINE_QUICK_DAYS } from "@/components/invoices/composer/useInvoiceComposer";
import type { Client } from "@/lib/clients/service";
import type { InvoiceComposerState } from "@/components/invoices/composer/useInvoiceComposer";
import { formatDateOnly } from "@/lib/dates/format";
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
    exchangeRateSource,
    exchangeRateLoading,
    exchangeRateFetchError,
    exchangeRateAsOf,
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
  // `as never` at the ref site below matches PartnerPicker's own inputRef
  // pattern — Gluestack's InputField forwards a ref typed against its own
  // props instead of the underlying TextInput instance, so a plain
  // { focus } ref type doesn't structurally match without the cast.
  const exchangeRateInputRef = React.useRef<{ focus: () => void } | null>(null);
  const clientZipInputRef = React.useRef<{ focus: () => void } | null>(null);

  React.useEffect(() => {
    if (focusField === "clientName") {
      nameInputRef.current?.focus?.();
      clearFocusField();
      return;
    }
    if (focusField === "exchangeRate") {
      // The field lives inside the collapsed-by-default "Dates/Payment"
      // section — expand it first and wait for the re-render that mounts
      // the input (this effect re-runs on the showDatesPayment dependency
      // below) before trying to focus it, otherwise the ref is still null.
      if (!showDatesPayment) {
        setShowDatesPayment(true);
        return;
      }
      exchangeRateInputRef.current?.focus?.();
      clearFocusField();
    }
    if (focusField === "clientZip") {
      // The buyer-address panel is collapsed by default — same
      // expand-then-focus pattern as exchangeRate above
      // (validateBuyerAddressStep, Áfa tv. 169. § e).
      if (!showClientDetails) {
        setShowClientDetails(true);
        return;
      }
      clientZipInputRef.current?.focus?.();
      clearFocusField();
    }
  }, [
    focusField,
    clearFocusField,
    showDatesPayment,
    setShowDatesPayment,
    showClientDetails,
    setShowClientDetails,
  ]);

  async function handleCreateNewClient(input: {
    name: string;
    email: string;
    taxNumber: string;
    zip: string;
    city: string;
    address: string;
  }) {
    // Composer-local partner: not persisted to /api/clients from here —
    // keeps the composer independent of the clients CRUD surface. The
    // invoice still carries the typed name/e-mail/tax number/address as its
    // own buyer-address snapshot (Áfa tv. 169. § e — required to finalize).
    setClientName(input.name);
    setClientEmail(input.email);
    setClientTaxNumber(input.taxNumber);
    setClientZip(input.zip);
    setClientCity(input.city);
    setClientAddress(input.address);
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
            // Once a name has been typed, a lingering errors.partner can
            // only be the exchange-rate error (see the dedicated block
            // below) — never the "client name required" message this
            // picker renders itself, so don't show it twice.
            error={clientName.trim() ? undefined : errors.partner}
            t={t}
          />
          {clientName.trim() && !showClientDetails ? (
            // Also the only way to reach the address fields for a buyer
            // that isn't a linked saved client (typed freehand, or added
            // via PartnerPicker's inline "+ Új partner") — required to
            // finalize (Áfa tv. 169. § e), see validateBuyerAddressStep.
            <Pressable onPress={() => setShowClientDetails(true)} className="self-start">
              <Text size="sm" className="font-medium text-primary">
                {t("invoices.composer.editPartnerDetails")}
              </Text>
            </Pressable>
          ) : null}
        </VStack>
      )}

      {showClientDetails && clientName.trim() ? (
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
                <LabeledInput
                  label={t("invoices.fields.zipCode")}
                  value={clientZip}
                  onChangeText={setClientZip}
                  testID="composer-client-zip"
                  required
                  inputRef={clientZipInputRef}
                />
              </VStack>
              <VStack className="flex-1">
                <LabeledInput
                  label={t("invoices.fields.city")}
                  value={clientCity}
                  onChangeText={setClientCity}
                  testID="composer-client-city"
                  required
                />
              </VStack>
            </HStack>
            <LabeledInput
              label={t("invoices.fields.address")}
              value={clientAddress}
              onChangeText={setClientAddress}
              testID="composer-client-address"
              required
            />
            {errors.buyerAddress ? (
              <Text size="xs" className="text-destructive">{errors.buyerAddress}</Text>
            ) : null}
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
              <Text size="xs" className="mt-1 text-muted-foreground">
                {t("invoices.fields.fulfillmentDateHint")}
              </Text>
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

          <VStack space="xs">
            <Text size="xs" className="text-muted-foreground">{t("invoices.composer.deadlineQuickPick")}</Text>
            <ChoicePillGroup>
              {DEADLINE_QUICK_DAYS.map((d) => (
                <ChoicePill key={d} selected={deadlineDays === d} onPress={() => setDeadlineDays(d)}>
                  <Text size="xs" className={deadlineDays === d ? "font-medium text-primary" : "text-foreground"}>
                    {d} {t("invoices.fields.days")}
                  </Text>
                </ChoicePill>
              ))}
            </ChoicePillGroup>
          </VStack>

          <HStack className="items-center justify-between">
            <Text size="sm" className="font-light text-foreground">{t("invoices.fields.continuousPerformance")}</Text>
            <Switch value={continuousPerformance} onValueChange={setContinuousPerformance} />
          </HStack>

          <VStack space="xs">
            <Text size="xs" className="text-muted-foreground">{t("invoices.fields.paymentMethod")}</Text>
            <ChoicePillGroup>
              {PAYMENT_METHOD_I18N.map((pm) => (
                <ChoicePill key={pm.value} selected={paymentMethod === pm.value} onPress={() => setPaymentMethod(pm.value)}>
                  <Text size="sm" className={paymentMethod === pm.value ? "font-medium text-primary" : "text-foreground"}>
                    {t(pm.i18nKey)}
                  </Text>
                </ChoicePill>
              ))}
            </ChoicePillGroup>
          </VStack>

          <HStack space="sm" className="flex-wrap items-end">
            <VStack space="xs">
              <Text size="xs" className="text-muted-foreground">{t("invoices.fields.currency")}</Text>
              <ChoicePillGroup>
                {(["HUF", "EUR"] as InvoiceCurrency[]).map((value) => (
                  <ChoicePill key={value} selected={currency === value} onPress={() => setCurrency(value)}>
                    <Text size="sm" className={currency === value ? "font-medium text-primary" : "text-foreground"}>
                      {value}
                    </Text>
                  </ChoicePill>
                ))}
              </ChoicePillGroup>
            </VStack>
            {currency !== "HUF" ? (
              <VStack className="min-w-[140px]">
                <Text size="xs" className="text-muted-foreground">
                  {t("invoices.fields.exchangeRate")} <Text className="text-destructive">*</Text>
                </Text>
                <Input>
                  <InputField
                    ref={exchangeRateInputRef as never}
                    value={exchangeRate}
                    onChangeText={setExchangeRate}
                    keyboardType="decimal-pad"
                    testID="composer-exchange-rate"
                  />
                </Input>
                {exchangeRateLoading ? (
                  <Text size="xs" className="mt-1 text-muted-foreground" testID="composer-exchange-rate-loading">
                    {t("invoices.fields.exchangeRateLoading")}
                  </Text>
                ) : exchangeRateFetchError ? (
                  <Text size="xs" className="mt-1 text-destructive" testID="composer-exchange-rate-fetch-error">
                    {exchangeRateFetchError}
                  </Text>
                ) : exchangeRateSource === "mnb" && exchangeRateAsOf ? (
                  <Text size="xs" className="mt-1 text-muted-foreground" testID="composer-exchange-rate-caption">
                    {t("invoices.fields.exchangeRateSourceMnb", { date: formatDateOnly(exchangeRateAsOf) })}
                  </Text>
                ) : exchangeRateSource === "manual" ? (
                  <Text size="xs" className="mt-1 text-muted-foreground" testID="composer-exchange-rate-caption">
                    {t("invoices.fields.exchangeRateSourceManual")}
                  </Text>
                ) : null}
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
  testID,
  required,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad" | "email-address";
  testID?: string;
  required?: boolean;
  inputRef?: React.RefObject<{ focus: () => void } | null>;
}) {
  return (
    <VStack space="xs">
      <Text size="xs" className="text-muted-foreground">
        {label} {required ? <Text className="text-destructive">*</Text> : null}
      </Text>
      <Input>
        <InputField
          ref={inputRef as never}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          testID={testID}
        />
      </Input>
      {hint ? (
        <Text size="xs" className="text-muted-foreground">{hint}</Text>
      ) : null}
    </VStack>
  );
}
