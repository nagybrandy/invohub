// app/(app)/invoices/[id]/edit.tsx
// Edit an existing invoice.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { LineItemEditor } from "@/components/invoices/LineItemEditor";
import { apiFetch } from "@/lib/api/client";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";

export default function EditInvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addOrUpdate } = useInvoices();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    void apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`)
      .then((data) => setInvoice(data.invoice))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!invoice) return;
    setSaving(true);
    try {
      await addOrUpdate({ ...invoice, updatedAt: new Date().toISOString() });
      router.replace(routes.invoiceDetail(id!));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !invoice) {
    return (
      <FormScreen>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  const totals = calculateInvoiceTotals(invoice.lineItems);

  return (
    <FormScreen header={<Heading size="2xl">Edit invoice</Heading>}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Client name</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              value={invoice.clientName}
              onChangeText={(v) => setInvoice({ ...invoice, clientName: v })}
            />
          </Input>
        </FormControl>
        <Card className="p-4">
          <LineItemEditor
            lineItems={invoice.lineItems}
            currency={invoice.currency}
            onChange={(lineItems) => setInvoice({ ...invoice, lineItems })}
          />
        </Card>
        <Text className="font-semibold">
          Total: {formatCurrency(totals.totalAmount, invoice.currency)}
        </Text>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>Save changes</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
