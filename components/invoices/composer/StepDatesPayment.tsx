// components/invoices/composer/StepDatesPayment.tsx
// "Dátumok és fizetés" (redesign 2026-11, SPEC §8.4): a one-line summary card
// (Teljesítés, Fizetési határidő + (N nap), Fizetési mód, Pénznem) whose
// "Módosítás" link opens the edit grid — two columns, one on phones — with the
// existing date inputs, the quick chips (Ma / Előző hó vége for the fulfilment
// date, the existing DEADLINE_QUICK_DAYS for the deadline), the payment method
// and the currency picker with the MNB exchange-rate behaviour unchanged. All
// the VAT-date and exchange-rate texts are the existing ones, verbatim.
import * as React from "react";
import { CurrencyPicker } from "@/components/settings/CurrencyPicker";
import { Box } from "@/components/ui/box";
import { ChoicePill, choicePillTextClass } from "@/components/ui/choice-pill";
import { Input, InputField } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { ComposerSection } from "@/components/invoices/composer/ComposerSection";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { TermsSummaryCard, type TermsCell } from "@/components/invoices/composer/TermsSummaryCard";
import { daysBetween, previousMonthEndIso } from "@/components/invoices/composer/composer-view";
import {
  DEADLINE_QUICK_DAYS,
  todayIso,
  type InvoiceComposerState,
} from "@/components/invoices/composer/useInvoiceComposer";
import { formatDateOnly } from "@/lib/dates/format";
import type { PaymentMethod } from "@/lib/invoices/types";

const PAYMENT_METHOD_I18N: { value: PaymentMethod; i18nKey: string }[] = [
  { value: "transfer", i18nKey: "invoices.paymentMethods.transfer" },
  { value: "cash", i18nKey: "invoices.paymentMethods.cash" },
  { value: "card", i18nKey: "invoices.paymentMethods.card" },
  { value: "other", i18nKey: "invoices.paymentMethods.other" },
];

export function StepDatesPayment(composer: InvoiceComposerState) {
  const {
    t,
    mode,
    fulfillmentDate,
    setFulfillmentDate,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
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
    clientName,
    errors,
    focusField,
    clearFocusField,
  } = composer;

  const [expanded, setExpanded] = React.useState(false);
  // `as never` matches the other InputField refs (Gluestack types the ref against its own props).
  const exchangeRateInputRef = React.useRef<{ focus: () => void } | null>(null);

  // A failed save reports the field to fix through focusField. The edit grid is
  // closed by default, so open it first and focus once the field is mounted.
  React.useEffect(() => {
    if (focusField !== "exchangeRate" && focusField !== "dueDate") return;
    if (!expanded) {
      setExpanded(true);
      return;
    }
    if (focusField === "exchangeRate") exchangeRateInputRef.current?.focus?.();
    clearFocusField();
  }, [focusField, expanded, clearFocusField]);

  const today = todayIso();
  const prevMonthEnd = previousMonthEndIso(today);
  const days = daysBetween(issueDate, dueDate);

  const cells: TermsCell[] = [
    { key: "fulfillment", label: t("composer.termsFulfillment"), value: formatDateOnly(fulfillmentDate || issueDate) },
    {
      key: "deadline",
      label: t("invoices.fields.paymentDeadline"),
      value: `${formatDateOnly(dueDate)}${days != null ? ` (${t("composer.termsDays", { count: days })})` : ""}`,
    },
    { key: "method", label: t("invoices.fields.paymentMethod"), value: t(`invoices.paymentMethods.${paymentMethod}`) },
    {
      key: "currency",
      label: t("invoices.fields.currency"),
      value: currency !== "HUF" && exchangeRate ? `${currency} · ${exchangeRate}` : currency,
    },
  ];

  const exchangeRateError =
    currency !== "HUF" && errors.partner && clientName.trim() ? errors.partner : undefined;

  return (
    <ComposerSection title={t("invoices.sections.datesPayment")} testID="composer-section-dates">
      <TermsSummaryCard
        cells={cells}
        footer={mode === "edit" ? t("composer.termsSavedNote") : t("composer.termsDefaultNote")}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        editLabel={t("composer.termsEdit")}
        doneLabel={t("composer.termsDone")}
      >
        <Box className="flex-row flex-wrap gap-x-4 gap-y-5">
          <Box className="min-w-[260px] flex-1 gap-2">
            <FormField label={t("invoices.fields.fulfillmentDate")} hint={t("invoices.fields.fulfillmentDateHint")}>
              <DateInput
                value={fulfillmentDate}
                onChangeText={setFulfillmentDate}
                testID="composer-fulfillment-date"
                accessibilityLabel={t("invoices.fields.fulfillmentDate")}
              />
            </FormField>
            <Box className="flex-row flex-wrap items-center gap-2" testID="composer-fulfillment-chips">
              <Text className="text-[13px] text-muted-ink">{t("composer.termsFulfillment")}</Text>
              <ChoicePill
                variant="quick"
                selected={fulfillmentDate === today}
                onPress={() => setFulfillmentDate(today)}
                accessibilityRole="button"
                testID="composer-chip-today"
              >
                <Text className={choicePillTextClass("quick", fulfillmentDate === today)}>{t("composer.chipToday")}</Text>
              </ChoicePill>
              <ChoicePill
                variant="quick"
                selected={fulfillmentDate === prevMonthEnd}
                onPress={() => setFulfillmentDate(prevMonthEnd)}
                accessibilityRole="button"
                testID="composer-chip-prev-month-end"
              >
                <Text className={choicePillTextClass("quick", fulfillmentDate === prevMonthEnd)}>
                  {t("composer.chipPrevMonthEnd")}
                </Text>
              </ChoicePill>
            </Box>
          </Box>

          <FormField label={t("invoices.fields.issueDate")} className="min-w-[260px] flex-1">
            <DateInput
              value={issueDate}
              onChangeText={setIssueDate}
              testID="composer-issue-date"
              accessibilityLabel={t("invoices.fields.issueDate")}
            />
          </FormField>

          <Box className="min-w-[260px] flex-1 gap-2">
            <FormField label={t("invoices.fields.paymentDeadline")} error={errors.dueDate}>
              <DateInput
                value={dueDate}
                onChangeText={setDueDate}
                invalid={Boolean(errors.dueDate)}
                testID="composer-due-date"
                accessibilityLabel={t("invoices.fields.paymentDeadline")}
              />
            </FormField>
            <Box className="flex-row flex-wrap items-center gap-2" testID="composer-deadline-chips">
              <Text className="text-[13px] text-muted-ink">{t("invoices.composer.deadlineQuickPick")}</Text>
              {DEADLINE_QUICK_DAYS.map((d) => (
                <ChoicePill
                  key={d}
                  variant="quick"
                  selected={deadlineDays === d}
                  onPress={() => setDeadlineDays(d)}
                  accessibilityRole="button"
                  testID={`composer-deadline-${d}`}
                >
                  <Text className={choicePillTextClass("quick", deadlineDays === d)}>
                    {d} {t("invoices.fields.days")}
                  </Text>
                </ChoicePill>
              ))}
            </Box>
          </Box>

          <FormField label={t("invoices.fields.paymentMethod")} className="min-w-[260px] flex-1">
            <Select
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as PaymentMethod)}
              options={PAYMENT_METHOD_I18N.map((pm) => ({ value: pm.value, label: t(pm.i18nKey) }))}
              accessibilityLabel={t("invoices.fields.paymentMethod")}
              testID="composer-payment-method"
            />
          </FormField>

          <Box className="w-full gap-3">
            <FormField label={t("invoices.fields.currency")}>
              <CurrencyPicker value={currency} onChange={(value) => value && setCurrency(value)} testIDPrefix="composer-currency" />
            </FormField>
            {currency !== "HUF" ? (
              <Box className="max-w-[260px]">
                <FormField
                  label={t("invoices.fields.exchangeRate")}
                  required
                  error={exchangeRateError}
                >
                  <Input>
                    <InputField
                      ref={exchangeRateInputRef as never}
                      value={exchangeRate}
                      onChangeText={setExchangeRate}
                      keyboardType="decimal-pad"
                      testID="composer-exchange-rate"
                      accessibilityLabel={t("invoices.fields.exchangeRate")}
                    />
                  </Input>
                </FormField>
                {exchangeRateLoading ? (
                  <Text className="mt-1 text-[13px] text-muted-ink" testID="composer-exchange-rate-loading">
                    {t("invoices.fields.exchangeRateLoading")}
                  </Text>
                ) : exchangeRateFetchError ? (
                  <Text className="mt-1 text-[13px] text-err" testID="composer-exchange-rate-fetch-error">
                    {exchangeRateFetchError}
                  </Text>
                ) : exchangeRateSource === "mnb" && exchangeRateAsOf ? (
                  <Text className="mt-1 text-[13px] text-muted-ink" testID="composer-exchange-rate-caption">
                    {t("invoices.fields.exchangeRateSourceMnb", { date: formatDateOnly(exchangeRateAsOf) })}
                  </Text>
                ) : exchangeRateSource === "manual" ? (
                  <Text className="mt-1 text-[13px] text-muted-ink" testID="composer-exchange-rate-caption">
                    {t("invoices.fields.exchangeRateSourceManual")}
                  </Text>
                ) : null}
              </Box>
            ) : null}
          </Box>
        </Box>
      </TermsSummaryCard>
    </ComposerSection>
  );
}
