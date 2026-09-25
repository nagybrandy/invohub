// components/invoices/NavStatusCard.tsx
// NAV Online Számla status for an invoice (detail screen): "Beküldés" when
// nothing was submitted yet (finalization normally submits automatically),
// "Újrapróbálás" after a failed/aborted submission, "Státusz frissítése"
// otherwise — plus automatic status polling while NAV is still processing.
// Shows submitted/processing/done/aborted/error + validation messages and a
// demo-mode badge so nobody mistakes the demo simulator for a real NAV report.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { apiFetch, ApiError } from "@/lib/api/client";
import { navResultI18nKey } from "@/lib/nav/nav-error-i18n";

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

/** Statuses after which a new submission is allowed (see lib/nav/submission-guard.ts). */
function isFailedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "error" || s === "aborted";
}

/** NAV hasn't decided yet — worth polling. `pending` is our own in-flight claim. */
function isInProgressStatus(status: string): boolean {
  return ["pending", "sent", "received", "processing", "saved"].includes(status.toLowerCase());
}

const DEFAULT_POLL_INTERVAL_MS = 5000;
const MAX_AUTO_POLLS = 6;

function statusTone(status: string): string {
  switch (status.toLowerCase()) {
    case "done":
      return "text-green-600";
    case "aborted":
    case "error":
      return "text-destructive";
    case "pending":
    case "processing":
    case "received":
    case "saved":
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}

export function NavStatusCard({
  invoiceId,
  onChanged,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  invoiceId: string;
  /** Called after a submit/retry/refresh so the parent (timeline chip) can reload. */
  onChanged?: () => void;
  /** Auto-poll interval while NAV is processing; 0 disables polling. */
  pollIntervalMs?: number;
}) {
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
  const onChangedRef = React.useRef(onChanged);
  onChangedRef.current = onChanged;
  const pollCountRef = React.useRef(0);

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
    } catch (e) {
      // The route answers with a machine-readable `code`; its English
      // `error` string is for logs and the public API, never for this card —
      // it can't follow the user's language (lib/nav/nav-error-i18n.ts).
      setError(t(navResultI18nKey(e instanceof ApiError ? e.code : undefined)));
    } finally {
      // A failed submit is recorded server-side (status "error") — reload
      // either way so the card shows it and offers "Újrapróbálás".
      pollCountRef.current = 0;
      await load();
      onChangedRef.current?.();
      setSubmitting(false);
    }
  }

  const refreshStatus = React.useCallback(
    async (silent: boolean) => {
      if (!silent) {
        setRefreshing(true);
        setError(null);
      }
      try {
        await apiFetch("/api/nav/status", {
          method: "POST",
          body: JSON.stringify({ invoiceId }),
        });
        await load();
        onChangedRef.current?.();
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : tRef.current("invoices.nav.refreshFailed"));
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [invoiceId, load]
  );

  // Auto-poll while NAV is still processing (bounded, so a stuck transaction
  // doesn't poll forever — the manual refresh stays available).
  const pollStatus = submission?.transactionId && isInProgressStatus(submission.status) ? submission.status : null;
  React.useEffect(() => {
    if (!pollStatus || pollIntervalMs <= 0 || pollCountRef.current >= MAX_AUTO_POLLS) return;
    const timer = setTimeout(() => {
      pollCountRef.current += 1;
      void refreshStatus(true);
    }, pollIntervalMs);
    return () => clearTimeout(timer);
  }, [pollStatus, submission?.id, pollIntervalMs, refreshStatus]);

  if (loading) return null;

  const messages = submission ? parseMessages(submission.messages) : [];
  const isDemo = submission?.mode === "demo";
  const failed = submission ? isFailedStatus(submission.status) : false;

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

          {!submission ? (
            <Button size="sm" variant="outline" onPress={handleSubmit} disabled={submitting} testID="nav-status-submit">
              <ButtonText>{submitting ? t("invoices.nav.submitting") : t("invoices.nav.submit")}</ButtonText>
            </Button>
          ) : failed ? (
            <Button size="sm" variant="outline" onPress={handleSubmit} disabled={submitting} testID="nav-status-retry">
              <ButtonText>{submitting ? t("invoices.nav.submitting") : t("invoices.nav.retry")}</ButtonText>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onPress={() => void refreshStatus(false)}
              disabled={refreshing || !submission.transactionId}
              testID="nav-status-refresh"
            >
              <ButtonText>{refreshing ? t("invoices.nav.refreshing") : t("invoices.nav.refresh")}</ButtonText>
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
            {submission.errorMessage ? (
              <Text size="xs" className="text-destructive" testID="nav-status-error-message">
                {submission.errorMessage}
              </Text>
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
