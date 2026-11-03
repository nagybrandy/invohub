// app/(app)/settings/reminders.tsx
// Kiküldés és emlékeztetők: who an invoice e-mail goes to by default (the
// company's invoiceEmailTo / invoiceEmailCc, moved here from the company page)
// and the overdue-invoice reminder schedule (GET/POST /api/reminders).
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { SaveBar } from "@/components/settings/SaveBar";
import {
  SettingsNote,
  SettingsPage,
  SettingsSection,
  SettingsSheet,
} from "@/components/settings/SettingsSheet";
import { useCompany } from "@/hooks/useCompany";
import { apiFetch } from "@/lib/api/client";
import { settingsItemKeys } from "@/lib/settings-navigation";
import { type } from "@/lib/ui/type";

type Schedule = {
  id: string;
  intervalDays: number;
  maxReminders: number;
  enabled: boolean;
};

export default function RemindersSettingsScreen() {
  const { t } = useTranslation();
  const { company, save: saveCompany } = useCompany();
  const keys = settingsItemKeys("reminders");
  const [schedule, setSchedule] = React.useState<Schedule | null>(null);
  const [intervalDays, setIntervalDays] = React.useState("7");
  const [maxReminders, setMaxReminders] = React.useState("3");
  const [invoiceEmailTo, setInvoiceEmailTo] = React.useState("");
  const [invoiceEmailCc, setInvoiceEmailCc] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    void apiFetch<{ schedules: Schedule[] }>("/api/reminders")
      .then((data) => {
        const global = data.schedules.find((s) => !("invoiceId" in s)) ?? data.schedules[0];
        if (global) {
          setSchedule(global);
          setIntervalDays(String(global.intervalDays));
          setMaxReminders(String(global.maxReminders));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const savedTo = company?.invoiceEmailTo ?? "";
  const savedCc = company?.invoiceEmailCc ?? "";
  React.useEffect(() => {
    if (company) {
      setInvoiceEmailTo(company.invoiceEmailTo ?? "");
      setInvoiceEmailCc(company.invoiceEmailCc ?? "");
    }
  }, [company]);

  const savedInterval = String(schedule?.intervalDays ?? 7);
  const savedMax = String(schedule?.maxReminders ?? 3);
  const scheduleDirty = intervalDays !== savedInterval || maxReminders !== savedMax;
  const emailsDirty = Boolean(company) && (invoiceEmailTo !== savedTo || invoiceEmailCc !== savedCc);
  const dirty = scheduleDirty || emailsDirty;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      if (emailsDirty && company) {
        await saveCompany({
          name: company.name,
          invoiceEmailTo: invoiceEmailTo.trim() || undefined,
          invoiceEmailCc: invoiceEmailCc.trim() || undefined,
        });
      }
      if (scheduleDirty) {
        const data = await apiFetch<{ schedule: Schedule }>("/api/reminders", {
          method: "POST",
          body: JSON.stringify({
            id: schedule?.id,
            intervalDays: Number(intervalDays) || 7,
            maxReminders: Number(maxReminders) || 3,
            enabled: true,
          }),
        });
        setSchedule(data.schedule);
        setIntervalDays(String(data.schedule.intervalDays));
        setMaxReminders(String(data.schedule.maxReminders));
      }
      setMessage({ kind: "ok", text: t(scheduleDirty ? "reminders.scheduleSaved" : "settingsPages.reminders.saved") });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error && e.message ? e.message : t("settingsPages.reminders.saveFailed") });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setIntervalDays(savedInterval);
    setMaxReminders(savedMax);
    setInvoiceEmailTo(savedTo);
    setInvoiceEmailCc(savedCc);
    setMessage(null);
  }

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ sent: number; processed: number; errors: string[] }>(
        "/api/reminders/run",
        { method: "POST" }
      );
      setMessage({ kind: "ok", text: t("reminders.runResult", { processed: result.processed, sent: result.sent }) });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t("reminders.runFailed") });
    } finally {
      setRunning(false);
    }
  }

  const days = Number(intervalDays) || 7;
  const max = Number(maxReminders) || 3;

  return (
    <SettingsPage title={t(keys.title)} lead={t(keys.lead)} testID="settings-reminders">
      {loading ? (
        <Text className={type.meta}>{t("common.loading")}</Text>
      ) : (
        <SettingsSheet>
          <SettingsSection
            title={t("settingsPages.reminders.recipientsTitle")}
            hint={t("settingsPages.reminders.recipientsHint")}
            testID="reminders-recipients"
          >
            <FormField label={t("settings.companySettings.sendTo")}>
              <Input>
                <InputField
                  testID="reminders-email-to"
                  accessibilityLabel={t("settings.companySettings.sendTo")}
                  value={invoiceEmailTo}
                  onChangeText={setInvoiceEmailTo}
                  placeholder="billing@client.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </Input>
            </FormField>
            <FormField label={t("settings.companySettings.cc")} hint={t("settingsPages.reminders.ccHint")}>
              <Input>
                <InputField
                  testID="reminders-email-cc"
                  accessibilityLabel={t("settings.companySettings.cc")}
                  value={invoiceEmailCc}
                  onChangeText={setInvoiceEmailCc}
                  placeholder="accounting@client.com, ceo@client.com"
                  autoCapitalize="none"
                />
              </Input>
            </FormField>
          </SettingsSection>

          <SettingsSection
            title={t("settingsPages.reminders.scheduleTitle")}
            hint={t("settingsPages.reminders.scheduleHint")}
            testID="reminders-schedule"
          >
            <SettingsNote tone="info" testID="reminders-summary">
              {t("settingsPages.reminders.summary", { days, max })}
            </SettingsNote>
            <FormField label={t("reminders.intervalDays")} hint={t("settingsPages.reminders.intervalHint")}>
              <Input>
                <InputField
                  testID="reminders-interval"
                  accessibilityLabel={t("reminders.intervalDays")}
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                  keyboardType="number-pad"
                />
              </Input>
            </FormField>
            <FormField label={t("reminders.maxReminders")} hint={t("settingsPages.reminders.maxHint")}>
              <Input>
                <InputField
                  testID="reminders-max"
                  accessibilityLabel={t("reminders.maxReminders")}
                  value={maxReminders}
                  onChangeText={setMaxReminders}
                  keyboardType="number-pad"
                />
              </Input>
            </FormField>
            <Button
              variant="secondary"
              onPress={() => void handleRunNow()}
              disabled={running}
              testID="reminders-run-now"
              className="self-start"
            >
              <ButtonText>{t("reminders.runNow")}</ButtonText>
            </Button>
          </SettingsSection>
        </SettingsSheet>
      )}

      {message ? (
        <SettingsNote tone={message.kind === "ok" ? "ok" : "err"} testID="reminders-message">
          {message.text}
        </SettingsNote>
      ) : null}

      <SaveBar
        visible={dirty || saving}
        saving={saving}
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        saveLabel={t("reminders.saveSchedule")}
        saveTestID="reminders-save"
      />
    </SettingsPage>
  );
}
