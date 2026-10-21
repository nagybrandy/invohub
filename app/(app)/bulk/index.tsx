// app/(app)/bulk/index.tsx
// Tömeges feltöltés: many invoices / proformas / advance invoices / receipts
// from ONE simple file (one row = one document). Download the example, fill
// it in, upload, check the preview, create. Drafts by default.
import * as React from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { OptionChips } from "@/components/settings/OptionChips";
import { saveDownload } from "@/components/settings/save-download";
import { useClients } from "@/hooks/useClients";
import { useCompany } from "@/hooks/useCompany";
import { apiFetch } from "@/lib/api/client";
import { BULK_COLUMNS, BULK_MAX_ROWS } from "@/lib/bulk/columns";
import { parseBulkFile } from "@/lib/bulk/parse";
import { runBulk, type BulkRunOutcome } from "@/lib/bulk/run";
import { BULK_TEMPLATE_FILENAME, bulkTemplateCsv } from "@/lib/bulk/template";
import { validateBulkRows, type BulkRowResult } from "@/lib/bulk/validate";
import type { Client } from "@/lib/clients/service";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { confirmAsync } from "@/lib/ui/confirm";

type Mode = "draft" | "issue";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BulkUploadScreen() {
  const { t } = useTranslation();
  const { company } = useCompany();
  const { clients, refresh: refreshClients } = useClients();

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<BulkRowResult[]>([]);
  const [tooMany, setTooMany] = React.useState(false);
  const [parseError, setParseError] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("draft");
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<[number, number] | null>(null);
  const [outcomes, setOutcomes] = React.useState<BulkRunOutcome[] | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const issueNow = mode === "issue";

  // Issuing right away needs a complete buyer address (Áfa tv. 169. § e) —
  // a draft does not. A row that cannot be issued is shown as an error, not skipped silently.
  const checked: BulkRowResult[] = React.useMemo(
    () =>
      results.map((r) =>
        issueNow && r.invoice && r.invoice.kind !== "proforma" && !r.invoice.addressComplete
          ? { ...r, errors: [...r.errors, { field: "partner_address", code: "addressRequiredToIssue" }] }
          : r,
      ),
    [results, issueNow],
  );
  const validCount = checked.filter((r) => r.errors.length === 0).length;
  const errorCount = checked.length - validCount;

  async function onFile(file: File) {
    setFileName(file.name);
    setOutcomes(null);
    setParseError(false);
    try {
      const rows = await parseBulkFile(file);
      const { results: validated, tooMany: capped } = validateBulkRows(rows, {
        today: todayIso(),
        defaultCurrency: company?.defaultCurrency,
        defaultPaymentMethod: company?.defaultPaymentMethod,
        defaultPaymentTermDays: company?.defaultPaymentTermDays,
        defaultVatRate: company?.defaultVatRate,
        defaultLanguage: company?.defaultLanguage,
        vatExempt: company?.vatExempt,
      });
      setResults(validated);
      setTooMany(capped);
    } catch {
      setResults([]);
      setParseError(true);
    }
  }

  async function handleCreate() {
    if (issueNow) {
      const ok = await confirmAsync({
        title: t("bulk.confirmIssueTitle"),
        message: t("bulk.confirmIssueMessage", { count: validCount }),
        confirmLabel: t("bulk.confirmIssue"),
        cancelLabel: t("common.cancel"),
      });
      if (!ok) return;
    }
    setRunning(true);
    setProgress([0, validCount]);
    try {
      const out = await runBulk(
        checked,
        { issueNow },
        {
          existingClients: clients,
          createClient: async (input) => (await apiFetch<{ client: Client }>("/api/clients", { method: "POST", body: JSON.stringify(input) })).client,
          createInvoice: async (invoice) => (await apiFetch<{ invoice: Invoice }>("/api/invoices", { method: "POST", body: JSON.stringify(invoice) })).invoice,
          createReceipt: async (body) => (await apiFetch<{ receipt: { receiptNumber: string } }>("/api/receipts", { method: "POST", body: JSON.stringify(body) })).receipt,
        },
        (done, total) => setProgress([done, total]),
      );
      setOutcomes(out);
      void refreshClients();
    } finally {
      setRunning(false);
    }
  }

  const failed = outcomes?.filter((o) => !o.ok) ?? [];
  const created = outcomes?.filter((o) => o.ok) ?? [];

  return (
    <ScreenLayout header={<PageHeader title={t("bulk.title")} subtitle={t("bulk.subtitle")} />}>
      <VStack space="lg">
        <Card className="p-4">
          <VStack space="sm">
            <Heading size="md">{t("bulk.step1")}</Heading>
            <Text size="sm" className="text-muted-foreground">{t("bulk.format")}</Text>
            <Text size="xs" className="font-mono text-muted-foreground">{BULK_COLUMNS.join(", ")}</Text>
            <Text size="xs" className="text-muted-foreground">{t("bulk.formatHint", { max: BULK_MAX_ROWS })}</Text>
            <Button
              variant="outline"
              testID="bulk-template"
              onPress={() => saveDownload(BULK_TEMPLATE_FILENAME, new Blob([bulkTemplateCsv()], { type: "text/csv;charset=utf-8" }))}
            >
              <ButtonText>{t("bulk.downloadTemplate")}</ButtonText>
            </Button>
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="sm">
            <Heading size="md">{t("bulk.step2")}</Heading>
            {Platform.OS === "web" ? (
              <input
                ref={inputRef}
                data-testid="bulk-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
            ) : (
              <Text size="sm">{t("bulk.nativeHint")}</Text>
            )}
            {parseError ? <Text size="sm" className="text-destructive">{t("bulk.parseError")}</Text> : null}
            {tooMany ? <Text size="sm" className="text-destructive">{t("bulk.tooMany", { max: BULK_MAX_ROWS })}</Text> : null}
          </VStack>
        </Card>

        {checked.length > 0 ? (
          <Card className="p-4" testID="bulk-preview">
            <VStack space="md">
              <Heading size="md">{t("bulk.step3")}</Heading>
              <Text size="sm" className="text-foreground">
                {fileName} — {t("bulk.summary", { total: checked.length, valid: validCount, errors: errorCount })}
              </Text>
              <VStack space="xs">
                {checked.map((r) => {
                  const doc = r.invoice ?? r.receipt;
                  return (
                    <HStack key={r.row} space="sm" className="items-start border-b border-subtle pb-2">
                      <Text size="xs" className="w-10 text-muted-foreground">#{r.row}</Text>
                      <VStack className="flex-1">
                        <Text size="sm" className="text-foreground">
                          {doc ? `${t(`bulk.kinds.${doc.kind}`)} · ${r.invoice ? r.invoice.partner.name : t("bulk.noPartner")} · ${doc.lineItem.description}` : "—"}
                        </Text>
                        {r.errors.map((e) => (
                          <Text key={`${e.field}-${e.code}`} size="xs" className="text-destructive">
                            {e.field}: {t(`bulk.errors.${e.code}`)}
                          </Text>
                        ))}
                      </VStack>
                      <Text size="xs" className={r.errors.length === 0 ? "text-green-600" : "text-destructive"}>
                        {r.errors.length === 0 ? t("bulk.rowOk") : t("bulk.rowError")}
                      </Text>
                    </HStack>
                  );
                })}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium text-foreground">{t("bulk.modeTitle")}</Text>
                <OptionChips
                  testIDPrefix="bulk-mode"
                  value={mode}
                  onChange={(m) => m && setMode(m)}
                  options={[
                    { value: "draft" as Mode, label: t("bulk.modeDraft") },
                    { value: "issue" as Mode, label: t("bulk.modeIssue") },
                  ]}
                />
                <Text size="xs" className="text-muted-foreground">{issueNow ? t("bulk.modeIssueHint") : t("bulk.modeDraftHint")}</Text>
              </VStack>

              <Button onPress={() => void handleCreate()} disabled={running || validCount === 0} testID="bulk-create">
                <ButtonText>
                  {running && progress ? t("bulk.creating", { done: progress[0], total: progress[1] }) : t("bulk.create", { count: validCount })}
                </ButtonText>
              </Button>
            </VStack>
          </Card>
        ) : null}

        {outcomes ? (
          <Card className="p-4" testID="bulk-result">
            <VStack space="sm">
              <Heading size="md">{t("bulk.result")}</Heading>
              <Text size="sm" className="text-foreground">{t("bulk.resultSummary", { ok: created.length, failed: failed.length })}</Text>
              {failed.map((o) => (
                <Text key={o.row} size="xs" className="text-destructive">#{o.row}: {o.error}</Text>
              ))}
              <HStack space="sm" className="flex-wrap">
                <Button variant="outline" onPress={() => router.push(routes.invoices)}>
                  <ButtonText>{t("bulk.openInvoices")}</ButtonText>
                </Button>
                <Button variant="outline" onPress={() => router.push(routes.receipts)}>
                  <ButtonText>{t("bulk.openReceipts")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
