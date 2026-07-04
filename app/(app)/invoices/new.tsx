// app/(app)/invoices/new.tsx
// Form to create a new invoice with Edit / Preview tabs.
import * as React from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { LineItemEditor } from "@/components/invoices/LineItemEditor";
import { ScreenModeTabs, type ScreenMode } from "@/components/invoices/ScreenModeTabs";
import { useInvoices } from "@/hooks/useInvoices";
import {
  buildDraftInvoice,
  ensureDraftLineItems,
} from "@/lib/invoices/build-draft-invoice";
import {
  calculateInvoiceTotals,
  createEmptyLineItem,
  createId,
  formatCurrency,
  generateInvoiceNumber,
} from "@/lib/invoices/calculations";
import type { Invoice, InvoiceCurrency, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dueDateIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export default function NewInvoiceScreen() {
  const { invoices, addOrUpdate } = useInvoices();
  const [screenMode, setScreenMode] = React.useState<ScreenMode>("edit");
  const [clientName, setClientName] = React.useState("");
  const [clientTaxNumber, setClientTaxNumber] = React.useState("");
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(todayIso());
  const [dueDate, setDueDate] = React.useState(dueDateIso());
  const [currency, setCurrency] = React.useState<InvoiceCurrency>("EUR");
  const [notes, setNotes] = React.useState("");
  const [lineItems, setLineItems] = React.useState([createEmptyLineItem()]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(generateInvoiceNumber(invoices));
    }
  }, [invoiceNumber, invoices]);

  const totals = calculateInvoiceTotals(lineItems);

  const draftInvoice = React.useMemo(
    () =>
      buildDraftInvoice({
        invoiceNumber,
        clientName,
        clientTaxNumber,
        issueDate,
        dueDate,
        currency,
        notes,
        lineItems: ensureDraftLineItems(
          lineItems.filter((item) => item.description.trim())
        ),
      }),
    [
      invoiceNumber,
      clientName,
      clientTaxNumber,
      issueDate,
      dueDate,
      currency,
      notes,
      lineItems,
    ]
  );

  async function handleSave(status: InvoiceStatus) {
    setError(null);

    if (!clientName.trim()) {
      setError("Client name is required.");
      setScreenMode("edit");
      return;
    }
    if (!lineItems.some((item) => item.description.trim())) {
      setError("Add at least one line item with a description.");
      setScreenMode("edit");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const invoice: Invoice = {
        id: createId(),
        invoiceNumber: invoiceNumber.trim() || generateInvoiceNumber(invoices),
        clientName: clientName.trim(),
        clientTaxNumber: clientTaxNumber.trim() || undefined,
        issueDate,
        dueDate,
        status,
        currency,
        lineItems: lineItems.filter((item) => item.description.trim()),
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      await addOrUpdate(invoice);
      router.replace(routes.invoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <VStack space="md">
        <Heading size="2xl">New invoice</Heading>
        <ScreenModeTabs mode={screenMode} onChange={setScreenMode} />
      </VStack>

      {screenMode === "preview" ? (
        <VStack space="md">
          <Text size="sm" className="text-muted-foreground">
            Live preview of how the invoice will look as HTML and PDF. Updates as you edit the form.
          </Text>
          <InvoiceDocumentPreview invoice={draftInvoice} />
          <Button variant="outline" onPress={() => setScreenMode("edit")}>
            <ButtonText>Back to edit</ButtonText>
          </Button>
        </VStack>
      ) : (
        <>
          <Text size="sm" className="text-muted-foreground">
            Fill in client details and line items. Switch to Preview to see the document layout.
          </Text>

          <Card className="p-4">
            <VStack space="md">
              <Heading size="md">Client</Heading>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Client name</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="Acme Kft."
                    value={clientName}
                    onChangeText={setClientName}
                  />
                </Input>
              </FormControl>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Tax number (optional)</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    placeholder="12345678-1-23"
                    value={clientTaxNumber}
                    onChangeText={setClientTaxNumber}
                  />
                </Input>
              </FormControl>
            </VStack>
          </Card>

          <Card className="p-4">
            <VStack space="md">
              <Heading size="md">Invoice details</Heading>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Invoice number</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField value={invoiceNumber} onChangeText={setInvoiceNumber} />
                </Input>
              </FormControl>

              <HStack space="sm" className="flex-wrap">
                <FormControl className="min-w-[140px] flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>Issue date</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder="YYYY-MM-DD"
                      value={issueDate}
                      onChangeText={setIssueDate}
                    />
                  </Input>
                </FormControl>

                <FormControl className="min-w-[140px] flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>Due date</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      placeholder="YYYY-MM-DD"
                      value={dueDate}
                      onChangeText={setDueDate}
                    />
                  </Input>
                </FormControl>
              </HStack>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Currency</FormControlLabelText>
                </FormControlLabel>
                <HStack space="sm">
                  {(["EUR", "HUF"] as InvoiceCurrency[]).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setCurrency(value)}
                      className={`rounded-md border px-4 py-2 ${
                        currency === value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Text size="sm">{value}</Text>
                    </Pressable>
                  ))}
                </HStack>
              </FormControl>
            </VStack>
          </Card>

          <Card className="p-4">
            <VStack space="md">
              <Heading size="md">Line items</Heading>
              <LineItemEditor
                lineItems={lineItems}
                currency={currency}
                onChange={setLineItems}
              />
            </VStack>
          </Card>

          <Card className="p-4">
            <VStack space="sm">
              <Heading size="md">Totals</Heading>
              <HStack className="justify-between">
                <Text className="text-muted-foreground">Subtotal</Text>
                <Text>{formatCurrency(totals.subtotal, currency)}</Text>
              </HStack>
              <HStack className="justify-between">
                <Text className="text-muted-foreground">VAT</Text>
                <Text>{formatCurrency(totals.vatTotal, currency)}</Text>
              </HStack>
              <HStack className="justify-between border-t border-border pt-2">
                <Text className="font-semibold">Total</Text>
                <Text className="font-semibold">
                  {formatCurrency(totals.totalAmount, currency)}
                </Text>
              </HStack>
            </VStack>
          </Card>

          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>Notes (optional)</FormControlLabelText>
            </FormControlLabel>
            <Textarea>
              <TextareaInput
                placeholder="Payment terms, bank details..."
                value={notes}
                onChangeText={setNotes}
              />
            </Textarea>
          </FormControl>

          {error ? (
            <Text size="sm" className="text-destructive">
              {error}
            </Text>
          ) : null}

          <HStack space="sm" className="flex-wrap">
            <Box className="min-w-[140px] flex-1">
              <Button
                variant="outline"
                onPress={() => handleSave("draft")}
                disabled={saving}
              >
                <ButtonText>Save as draft</ButtonText>
              </Button>
            </Box>
            <Box className="min-w-[140px] flex-1">
              <Button onPress={() => handleSave("sent")} disabled={saving}>
                <ButtonText>Issue invoice</ButtonText>
              </Button>
            </Box>
          </HStack>
        </>
      )}
    </ScrollView>
  );
}
