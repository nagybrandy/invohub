// components/invoices/NavStatusCard.tsx
// NAV Online Számla status timeline for an invoice: submit, poll status
// ("Státusz frissítése"), and show submitted/processing/done/aborted +
// validation messages. Shows a demo-mode badge so nobody mistakes the demo
// simulator for a real NAV report.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { apiFetch } from "@/lib/api/client";

type NavSubmissionRow = {
  id: string;
  status: string;
  mode: "demo" | "test" | "production";
  transactionId: string | null;
  messages: string | null;
  errorMessage: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  createdAt: string;
};

function parseMessages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === "string") : [];
  } catch {
    return [];
  }
}

function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case "done":
      return "text-green-600";
    case "aborted":
      return "text-destructive";
    case "processing":
    case "received":
    case "saved":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}

export function NavStatusCard({ invoiceId }: { invoiceId: string }) {
  const { t } = useTranslation();
  const [submission, setSubmission] = React.useState<NavSubmissionRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // `t` is captured via ref (not a dependency) so an unstable `t` identity
  // (as in some test i18n mocks) can't turn this into a reload loop.
  const tRef = React.useRef(t);
  tRef.current = t;

  const load = React.useCallback(async () => {
    try {
      const data = await apiFetch<{ submissions: NavSubmissionRow[] }>(
        `/api/nav/status?invoiceId=${encodeURIComponent(invoiceId)}`
      );
      setSubmission(data.submissions[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tRef.current("invoices.nav.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/nav/submit", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoices.nav.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefreshStatus() {
    setRefreshing(true);
    setError(null);
    try {
      await apiFetch("/api/nav/status", {
        method: "POST",
        body: JSON.stringify({ invoiceId }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invoices.nav.refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return null;

  const messages = submission ? parseMessages(submission.messages) : [];
  const isDemo = submission?.mode === "demo";

  return (
    <Card className="p-4">
      <VStack space="sm">
        <HStack className="items-center justify-between">
          <HStack space="xs" className="items-center flex-wrap">
            <Text className="font-semibold text-foreground">{t("invoices.nav.title")}</Text>
            {isDemo ? (
              <Badge variant="outline" className="border-primary/40">
                <BadgeText className="text-[10px] text-primary">{t("invoices.nav.demoBadge")}</BadgeText>
              </Badge>
            ) : null}
          </HStack>

          {submission ? (
            <Button size="sm" variant="outline" onPress={handleRefreshStatus} disabled={refreshing}>
              <ButtonText>{refreshing ? t("invoices.nav.refreshing") : t("invoices.nav.refresh")}</ButtonText>
            </Button>
          ) : (
            <Button size="sm" onPress={handleSubmit} disabled={submitting}>
              <ButtonText>{submitting ? t("invoices.nav.submitting") : t("invoices.nav.submit")}</ButtonText>
            </Button>
          )}
        </HStack>

        {!submission ? (
          <Text size="sm" className="text-muted-foreground">
            {t("invoices.nav.notSubmitted")}
          </Text>
        ) : (
          <VStack space="xs">
            <HStack className="items-center justify-between">
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.nav.status")}
              </Text>
              <Text size="sm" className={`font-medium ${statusTone(submission.status)}`}>
                {t(`invoices.nav.statusValues.${submission.status.toLowerCase()}`, {
                  defaultValue: submission.status,
                })}
              </Text>
            </HStack>
            {submission.transactionId ? (
              <HStack className="items-center justify-between">
                <Text size="sm" className="text-muted-foreground">
                  {t("invoices.nav.transactionId")}
                </Text>
                <Text size="sm">{submission.transactionId}</Text>
              </HStack>
            ) : null}
            {messages.length > 0 ? (
              <VStack space="xs" className="rounded-md bg-muted/50 p-2">
                {messages.map((m, i) => (
                  <Text key={i} size="xs" className="text-muted-foreground">
                    {m}
                  </Text>
                ))}
              </VStack>
            ) : null}
          </VStack>
        )}

        {error ? (
          <Text size="sm" className="text-destructive">
            {error}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
