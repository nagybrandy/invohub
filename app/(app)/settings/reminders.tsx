// app/(app)/settings/reminders.tsx
// Payment reminder schedule settings.
import * as React from "react";
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
    setMessage("Schedule saved.");
  }

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ sent: number; processed: number; errors: string[] }>(
        "/api/reminders/run",
        { method: "POST" }
      );
      setMessage(`Processed ${result.processed}, sent ${result.sent}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <ScreenLayout header={<Heading size="2xl">Payment reminders</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          Automatic reminders are sent via SMTP for overdue invoices.
        </Text>
        {loading ? (
          <Text>Loading…</Text>
        ) : (
          <Card className="p-4">
            <VStack space="md">
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Interval (days)</FormControlLabelText>
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
                  <FormControlLabelText>Max reminders</FormControlLabelText>
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
                <ButtonText>Save schedule</ButtonText>
              </Button>
              <Button variant="outline" onPress={handleRunNow} disabled={running}>
                <ButtonText>Run reminders now</ButtonText>
              </Button>
            </VStack>
          </Card>
        )}
        {message ? <Text size="sm">{message}</Text> : null}
      </VStack>
    </ScreenLayout>
  );
}
