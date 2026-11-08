// components/recurring/RecurringScheduleForm.tsx
// Shared form for "Mentés ismétlődőként" (create from an invoice) and "Ütemezés
// szerkesztése". Validation is the same pure maths the server uses
// (lib/recurring/form.ts). It only ever configures DRAFT generation.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DateInput } from "@/components/invoices/composer/DateInput";
import {
  parseFormValues,
  type ParsedForm,
  type RecurringFormValues,
} from "@/lib/recurring/form";
import { RECURRENCE_FREQUENCIES } from "@/lib/recurring/schedule";

export type RecurringScheduleFormProps = {
  mode: "create" | "edit";
  initialValues: RecurringFormValues;
  submitting?: boolean;
  /** Server/transport error to show above the buttons. */
  error?: string | null;
  onSubmit: (parsed: Extract<ParsedForm, { ok: true }>) => void | Promise<void>;
  onCancel: () => void;
};

export function RecurringScheduleForm({
  mode,
  initialValues,
  submitting,
  error,
  onSubmit,
  onCancel,
}: RecurringScheduleFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = React.useState<RecurringFormValues>(initialValues);
  const [invalid, setInvalid] = React.useState(false);

  function set<K extends keyof RecurringFormValues>(key: K, value: RecurringFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setInvalid(false);
  }

  function handleSubmit() {
    const parsed = parseFormValues(values);
    if (!parsed.ok) {
      setInvalid(true);
      return;
    }
    void onSubmit(parsed);
  }

  const shownError = invalid ? t("recurring.form.invalidSchedule") : error;

  return (
    <VStack space="lg" testID="recurring-form">
      <Box className="rounded-card bg-surface p-4 shadow-card">
        <VStack space="md">
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("recurring.form.name")}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                testID="recurring-name"
                value={values.name}
                onChangeText={(v: string) => set("name", v)}
                placeholder={t("recurring.form.namePlaceholder")}
              />
            </Input>
          </FormControl>

          <VStack space="xs">
            <Text className="text-sm font-medium text-ink">{t("recurring.form.frequency")}</Text>
            <SegmentedControl
              testID="recurring-frequency"
              accessibilityLabel={t("recurring.form.frequency")}
              value={values.frequency}
              onChange={(v) => set("frequency", v)}
              options={RECURRENCE_FREQUENCIES.map((f) => ({
                value: f,
                label: t(`recurring.frequency.${f}`),
                testID: `recurring-frequency-${f}`,
              }))}
              fullWidth
              outlined
            />
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-ink">{t("recurring.form.startDate")}</Text>
            <DateInput
              testID="recurring-start-date"
              accessibilityLabel={t("recurring.form.startDate")}
              value={values.startDate}
              onChangeText={(v) => set("startDate", v)}
              invalid={invalid}
            />
            <Text className="text-[13px] text-muted-ink">{t("recurring.form.startDateHint")}</Text>
          </VStack>

          <VStack space="xs">
            <Text className="text-sm font-medium text-ink">{t("recurring.form.endDate")}</Text>
            <DateInput
              testID="recurring-end-date"
              accessibilityLabel={t("recurring.form.endDate")}
              value={values.endDate}
              onChangeText={(v) => set("endDate", v)}
            />
            <Text className="text-[13px] text-muted-ink">{t("recurring.form.endDateHint")}</Text>
          </VStack>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t("recurring.form.maxOccurrences")}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                testID="recurring-max-occurrences"
                value={values.maxOccurrences}
                onChangeText={(v: string) => set("maxOccurrences", v)}
                keyboardType="number-pad"
                placeholder={t("recurring.form.maxOccurrencesPlaceholder")}
              />
            </Input>
          </FormControl>

          {mode === "edit" ? (
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t("recurring.form.paymentTermDays")}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  testID="recurring-payment-term"
                  value={values.paymentTermDays}
                  onChangeText={(v: string) => set("paymentTermDays", v)}
                  keyboardType="number-pad"
                />
              </Input>
            </FormControl>
          ) : null}
        </VStack>
      </Box>

      <Text className="text-[13px] text-muted-ink">{t("recurring.draftOnlyNote")}</Text>
      {mode === "create" ? (
        <Text className="text-[13px] text-muted-ink">{t("recurring.form.creditNote")}</Text>
      ) : null}

      {shownError ? (
        <Text testID="recurring-form-error" className="text-sm text-err">
          {shownError}
        </Text>
      ) : null}

      <HStack space="sm">
        <Button testID="recurring-submit" onPress={handleSubmit} disabled={submitting}>
          <ButtonText>{t(mode === "create" ? "recurring.form.submitCreate" : "recurring.form.submitEdit")}</ButtonText>
        </Button>
        <Button testID="recurring-cancel" variant="secondary" onPress={onCancel}>
          <ButtonText>{t("common.cancel")}</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );
}
