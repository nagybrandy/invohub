// app/(app)/import/index.tsx
// Bulk invoice import from Excel/CSV spreadsheet.
import * as React from "react";
import { Platform } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";

export default function ImportScreen() {
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
      setMessage(`Imported ${result.count} draft invoice(s).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <ScreenLayout header={<Heading size="2xl">Bulk import</Heading>}>
      <VStack space="md">
        <Text size="sm" className="text-muted-foreground">
          Upload an Excel or CSV file with columns: client_name, description, quantity, unit_price, vat_rate.
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
              <Text size="sm">
                File picker on native: use web for bulk import or add document picker later.
              </Text>
            )}
            <Button disabled={importing}>
              <ButtonText>{importing ? "Importing…" : "Select file (web)"}</ButtonText>
            </Button>
          </VStack>
        </Card>
        {message ? <Text>{message}</Text> : null}
      </VStack>
    </ScreenLayout>
  );
}
