// app/(app)/import/index.tsx
// Bulk invoice import from Excel/CSV spreadsheet.
import * as React from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";

export default function ImportScreen() {
  const { t } = useTranslation();
  const [message, setMessage] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function uploadFile(file: File) {
    setImporting(true);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      const result = await apiFetch<{ count: number }>("/api/import/invoices", {
        method: "POST",
        body: JSON.stringify({ base64 }),
      });
      setMessage(t("import.importedCount", { count: result.count }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("import.importFailed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <ScreenLayout header={<Heading size="2xl">{t("import.title")}</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          {t("import.description")}
        </Text>
        <Card className="p-4">
          <VStack space="md">
            {Platform.OS === "web" ? (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
              </>
            ) : (
              <Text size="sm">{t("import.nativeHint")}</Text>
            )}
            <Button disabled={importing}>
              <ButtonText>{importing ? t("import.importing") : t("import.selectFile")}</ButtonText>
            </Button>
          </VStack>
        </Card>
        {message ? <Text>{message}</Text> : null}
      </VStack>
    </ScreenLayout>
  );
}
