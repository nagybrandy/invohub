// app/(app)/settings/reminders.tsx
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";

type Schedule = {
  id: string;
  intervalDays: number;
  maxReminders: number;
  enabled: boolean;
};

export default function RemindersSettingsScreen() {
  const { t } = useTranslation();
  const [schedule, setSchedule] = React.useState<Schedule | null>(null);
  const [intervalDays, setIntervalDays] = React.useState("7");
  const [maxReminders, setMaxReminders] = React.useState("3");
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

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

  async function handleSave() {
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
    setMessage(t("reminders.scheduleSaved"));
  }

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ sent: number; processed: number; errors: string[] }>(
        "/api/reminders/run",
        { method: "POST" }
      );
      setMessage(t("reminders.runResult", { processed: result.processed, sent: result.sent }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("reminders.runFailed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <ScreenLayout header={<Heading size="2xl">{t("reminders.title")}</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          {t("reminders.subtitle")}
        </Text>
        {loading ? (
          <Text>{t("common.loading")}</Text>
        ) : (
          <Card className="p-4">
            <VStack space="md">
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("reminders.intervalDays")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    keyboardType="number-pad"
                  />
                </Input>
              </FormControl>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("reminders.maxReminders")}</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={maxReminders}
                    onChangeText={setMaxReminders}
                    keyboardType="number-pad"
                  />
                </Input>
              </FormControl>
              <Button onPress={handleSave}>
                <ButtonText>{t("reminders.saveSchedule")}</ButtonText>
              </Button>
              <Button variant="outline" onPress={handleRunNow} disabled={running}>
                <ButtonText>{t("reminders.runNow")}</ButtonText>
              </Button>
            </VStack>
          </Card>
        )}
        {message ? <Text size="sm">{message}</Text> : null}
      </VStack>
    </ScreenLayout>
  );
}
