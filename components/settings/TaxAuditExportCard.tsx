// components/settings/TaxAuditExportCard.tsx
// "Adóhatósági ellenőrzési adatszolgáltatás" — the built-in audit export
// function 23/2014. NGM rendelet 11/A. § requires: pick a date range or an
// invoice-number range, download the NAV-schema XML
// (GET /api/invoices/tax-audit-export). Rendered inside the "NAV: adatok
// letöltése" section of Settings > NAV (the section carries the hint).
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input, InputField } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { saveDownload } from "@/components/settings/save-download";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { budapestDateKey } from "@/lib/dates/budapest";
import { type } from "@/lib/ui/type";

type Mode = "date" | "number";

type Problem = { invoiceNumber: string; field: string };

type ErrorState = { code: string; problems?: Problem[]; limit?: number };

const DEFAULT_FILENAME = "adohatosagi-ellenorzesi-adatszolgaltatas.xml";

function filenameFrom(disposition: string | null): string {
  const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
  return match?.[1] ?? DEFAULT_FILENAME;
}

export function TaxAuditExportCard({ now = new Date() }: { now?: Date }) {
  const { t } = useTranslation();
  const today = budapestDateKey(now);

  const [mode, setMode] = React.useState<Mode>("date");
  const [from, setFrom] = React.useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = React.useState(today);
  const [fromNumber, setFromNumber] = React.useState("");
  const [toNumber, setToNumber] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ErrorState | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const query =
      mode === "date"
        ? new URLSearchParams({ from, to })
        : new URLSearchParams({ fromNumber: fromNumber.trim(), toNumber: toNumber.trim() });
    try {
      const response = await fetch(
        `${getAuthBaseUrl()}/api/invoices/tax-audit-export?${query.toString()}`,
        { credentials: "include" }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Partial<ErrorState>;
        setError({ code: body.code ?? "exportFailed", problems: body.problems, limit: body.limit });
        return;
      }
      const blob = await response.blob();
      if (saveDownload(filenameFrom(response.headers.get("Content-Disposition")), blob) === false) {
        setNotice(t("settings.taxAudit.webOnly"));
      }
    } catch {
      setError({ code: "exportFailed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="gap-4" testID="tax-audit-export">
      <Text className={type.itemTitle}>{t("settings.taxAudit.title")}</Text>

      <SegmentedControl<Mode>
        outlined
        fullWidth
        accessibilityLabel={t("settings.taxAudit.modeLabel")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "date", label: t("settings.taxAudit.modeDate"), testID: "tax-audit-mode-date" },
          { value: "number", label: t("settings.taxAudit.modeNumber"), testID: "tax-audit-mode-number" },
        ]}
      />

      {mode === "date" ? (
        <Box className="flex-row flex-wrap gap-3">
          <FormField label={t("settings.taxAudit.from")} className="min-w-[140px] flex-1">
            <DateField
              testID="tax-audit-from"
              value={from}
              onChange={setFrom}
              max={to || undefined}
              accessibilityLabel={t("settings.taxAudit.from")}
            />
          </FormField>
          <FormField label={t("settings.taxAudit.to")} className="min-w-[140px] flex-1">
            <DateField
              testID="tax-audit-to"
              value={to}
              onChange={setTo}
              min={from || undefined}
              accessibilityLabel={t("settings.taxAudit.to")}
            />
          </FormField>
        </Box>
      ) : (
        <Box className="flex-row flex-wrap gap-3">
          <FormField label={t("settings.taxAudit.fromNumber")} className="min-w-[140px] flex-1">
            <Input>
              <InputField
                testID="tax-audit-from-number"
                value={fromNumber}
                onChangeText={setFromNumber}
                placeholder="INV-2026-00001"
                autoCapitalize="characters"
                accessibilityLabel={t("settings.taxAudit.fromNumber")}
              />
            </Input>
          </FormField>
          <FormField label={t("settings.taxAudit.toNumber")} className="min-w-[140px] flex-1">
            <Input>
              <InputField
                testID="tax-audit-to-number"
                value={toNumber}
                onChangeText={setToNumber}
                placeholder="INV-2026-00050"
                autoCapitalize="characters"
                accessibilityLabel={t("settings.taxAudit.toNumber")}
              />
            </Input>
          </FormField>
        </Box>
      )}

      <Box className="flex-row">
        <Button
          testID="tax-audit-download"
          variant="primary"
          onPress={() => void handleDownload()}
          disabled={loading}
        >
          {loading ? <ButtonSpinner /> : <ButtonText>{t("settings.taxAudit.download")}</ButtonText>}
        </Button>
      </Box>

      {error ? (
        <Box className="gap-1" accessibilityRole="alert">
          <Text className="text-sm text-err">
            {t(`settings.taxAudit.errors.${error.code}`, {
              defaultValue: t("settings.taxAudit.errors.exportFailed"),
              ...(error.limit ? { limit: error.limit } : {}),
            })}
          </Text>
          {error.problems?.map((problem) => (
            <Text key={`${problem.invoiceNumber}-${problem.field}`} className="text-xs text-err">
              {`${problem.invoiceNumber}: ${t(`settings.taxAudit.fields.${problem.field}`)}`}
            </Text>
          ))}
        </Box>
      ) : null}

      {notice ? <Text className={type.meta}>{notice}</Text> : null}
    </Box>
  );
}
