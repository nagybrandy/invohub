// components/settings/TaxAuditExportCard.tsx
// "Adóhatósági ellenőrzési adatszolgáltatás" — the built-in audit export
// function 23/2014. NGM rendelet 11/A. § requires: pick a date range or an
// invoice-number range, download the NAV-schema XML
// (GET /api/invoices/tax-audit-export).
import * as React from "react";
import { useTranslation } from "react-i18next";
import { FileDown } from "lucide-react-native";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoicePill, ChoicePillGroup } from "@/components/ui/choice-pill";
import { DateField } from "@/components/ui/date-field";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { saveDownload } from "@/components/settings/save-download";
import { getAuthBaseUrl } from "@/lib/auth-url";
import { budapestDateKey } from "@/lib/dates/budapest";
import { useIconColors } from "@/lib/theme/icon-colors";

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
  const icons = useIconColors();
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
    <Card className="p-4">
      <VStack space="md">
        <HStack space="sm" className="items-start">
          <FileDown size={20} color={icons.accent} />
          <VStack className="flex-1" space="xs">
            <Text className="font-semibold text-foreground">{t("settings.taxAudit.title")}</Text>
            <Text size="xs" className="text-muted-foreground">
              {t("settings.taxAudit.hint")}
            </Text>
          </VStack>
        </HStack>

        <ChoicePillGroup accessibilityLabel={t("settings.taxAudit.modeLabel")}>
          <ChoicePill
            testID="tax-audit-mode-date"
            selected={mode === "date"}
            onPress={() => setMode("date")}
          >
            <Text size="sm">{t("settings.taxAudit.modeDate")}</Text>
          </ChoicePill>
          <ChoicePill
            testID="tax-audit-mode-number"
            selected={mode === "number"}
            onPress={() => setMode("number")}
          >
            <Text size="sm">{t("settings.taxAudit.modeNumber")}</Text>
          </ChoicePill>
        </ChoicePillGroup>

        {mode === "date" ? (
          <HStack space="sm" className="flex-wrap">
            <VStack space="xs" className="min-w-[140px] flex-1">
              <Text size="xs" className="text-muted-foreground">
                {t("settings.taxAudit.from")}
              </Text>
              <DateField
                testID="tax-audit-from"
                value={from}
                onChange={setFrom}
                max={to || undefined}
                accessibilityLabel={t("settings.taxAudit.from")}
              />
            </VStack>
            <VStack space="xs" className="min-w-[140px] flex-1">
              <Text size="xs" className="text-muted-foreground">
                {t("settings.taxAudit.to")}
              </Text>
              <DateField
                testID="tax-audit-to"
                value={to}
                onChange={setTo}
                min={from || undefined}
                accessibilityLabel={t("settings.taxAudit.to")}
              />
            </VStack>
          </HStack>
        ) : (
          <HStack space="sm" className="flex-wrap">
            <VStack space="xs" className="min-w-[140px] flex-1">
              <Text size="xs" className="text-muted-foreground">
                {t("settings.taxAudit.fromNumber")}
              </Text>
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
            </VStack>
            <VStack space="xs" className="min-w-[140px] flex-1">
              <Text size="xs" className="text-muted-foreground">
                {t("settings.taxAudit.toNumber")}
              </Text>
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
            </VStack>
          </HStack>
        )}

        <Button testID="tax-audit-download" onPress={() => void handleDownload()} disabled={loading}>
          {loading ? <ButtonSpinner /> : <ButtonText>{t("settings.taxAudit.download")}</ButtonText>}
        </Button>

        {error ? (
          <VStack space="xs" accessibilityRole="alert">
            <Text size="sm" className="text-destructive">
              {t(`settings.taxAudit.errors.${error.code}`, {
                defaultValue: t("settings.taxAudit.errors.exportFailed"),
                ...(error.limit ? { limit: error.limit } : {}),
              })}
            </Text>
            {error.problems?.map((problem) => (
              <Text key={`${problem.invoiceNumber}-${problem.field}`} size="xs" className="text-destructive">
                {`${problem.invoiceNumber}: ${t(`settings.taxAudit.fields.${problem.field}`)}`}
              </Text>
            ))}
          </VStack>
        ) : null}

        {notice ? (
          <Text size="sm" className="text-muted-foreground">
            {notice}
          </Text>
        ) : null}
      </VStack>
    </Card>
  );
}
