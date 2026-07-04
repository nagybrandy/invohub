// app/(app)/invoices/[id]/index.tsx
// Invoice detail with inline HTML/PDF preview and actions.
import * as React from "react";
import { ActivityIndicator, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceDocumentPreview } from "@/components/invoices/InvoiceDocumentPreview";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch } from "@/lib/api/client";
import {
  calculateInvoiceTotals,
  formatCurrency,
} from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";

export default function InvoiceDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { t } = useTranslation();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`);
      setInvoice(data.invoice);
    } catch (e) {
      setInvoice(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load invoice.");
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    void reload().finally(() => setLoading(false));
  }, [id, reload]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!id) return;
    await apiFetch(`/api/invoices/${id}/send`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setMessage("Invoice email sent with PDF attachment.");
    await reload();
  }

  async function handleDelete() {
    if (!id) return;
    Alert.alert(
      "Delete invoice",
      `Permanently remove ${invoice?.invoiceNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void runAction("delete", async () => {
              await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
              router.replace(routes.invoices);
            }),
        },
      ]
    );
  }

  async function handleStorno() {
    if (!id) return;
    Alert.alert(
      "Create storno invoice",
      "This creates a cancellation invoice with negated line items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create storno",
          style: "destructive",
          onPress: () =>
            void runAction("storno", async () => {
              const data = await apiFetch<{ invoice: Invoice }>(
                `/api/invoices/${id}/storno`,
                { method: "POST" }
              );
              setMessage(`Storno created: ${data.invoice.invoiceNumber}`);
              router.push(routes.invoiceDetail(data.invoice.id));
            }),
        },
      ]
    );
  }

  async function handleDuplicate() {
    if (!id) return;
    await runAction("duplicate", async () => {
      const data = await apiFetch<{ invoice: Invoice }>(
        `/api/invoices/${id}/duplicate`,
        { method: "POST" }
      );
      router.push(routes.invoiceEdit(data.invoice.id));
    });
  }

  async function handlePaymentLink(provider: "revolut" | "barion") {
    if (!id) return;
    await runAction(provider, async () => {
      const data = await apiFetch<{ payment: { url: string } }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: id, provider }),
      });
      setMessage(`${provider} link: ${data.payment.url}`);
    });
  }

  if (loading) {
    return (
      <ScreenLayout>
        <ActivityIndicator />
      </ScreenLayout>
    );
  }

  if (loadError || !invoice) {
    return (
      <ScreenLayout>
        <VStack space="md">
          <Text className="text-destructive">{loadError ?? "Invoice not found."}</Text>
          <Button variant="outline" onPress={() => void reload()}>
            <ButtonText>Retry</ButtonText>
          </Button>
        </VStack>
      </ScreenLayout>
    );
  }

  const totals = calculateInvoiceTotals(invoice.lineItems);

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={invoice.invoiceNumber}
          subtitle={invoice.clientName}
          actions={
            <Badge variant={invoice.status === "overdue" ? "destructive" : "outline"}>
              <BadgeText>{invoice.status}</BadgeText>
            </Badge>
          }
        />
      }
    >
      <VStack space="lg">
        <Card className="p-4">
          <VStack space="sm">
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                Issue date
              </Text>
              <Text>{invoice.issueDate}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                Due date
              </Text>
              <Text>{invoice.dueDate}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                Total
              </Text>
              <Text className="text-lg font-bold">
                {formatCurrency(totals.totalAmount, invoice.currency)}
              </Text>
            </HStack>
          </VStack>
        </Card>

        <InvoiceDocumentPreview invoice={invoice} invoiceId={id} />

        <VStack space="sm">
          <Text className="font-semibold">Actions</Text>
          <HStack space="sm" className="flex-wrap">
            <Button variant="outline" onPress={() => router.push(routes.invoiceEdit(id!))}>
              <ButtonText>Edit</ButtonText>
            </Button>
            <Button
              variant="outline"
              disabled={busy === "send"}
              onPress={() => void runAction("send", handleSend)}
            >
              <ButtonText>Send email</ButtonText>
            </Button>
            <Button
              variant="outline"
              disabled={busy === "delete"}
              onPress={() => void handleDelete()}
            >
              <ButtonText>Delete</ButtonText>
            </Button>
          </HStack>
          <HStack space="sm" className="flex-wrap">
            <Button
              variant="outline"
              disabled={busy === "duplicate"}
              onPress={() => void handleDuplicate()}
            >
              <ButtonText>{t("invoices.duplicate")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              disabled={busy === "storno" || invoice.status === "cancelled"}
              onPress={() => void handleStorno()}
            >
              <ButtonText>{t("invoices.storno")}</ButtonText>
            </Button>
          </HStack>
          <HStack space="sm" className="flex-wrap">
            <Button
              variant="outline"
              disabled={busy === "revolut"}
              onPress={() => void handlePaymentLink("revolut")}
            >
              <ButtonText>Revolut</ButtonText>
            </Button>
            <Button
              variant="outline"
              disabled={busy === "barion"}
              onPress={() => void handlePaymentLink("barion")}
            >
              <ButtonText>Barion</ButtonText>
            </Button>
          </HStack>
        </VStack>

        {message ? (
          <Card className="border-primary/30 bg-accent p-3">
            <Text size="sm">{message}</Text>
          </Card>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
