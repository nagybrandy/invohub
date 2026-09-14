// app/(app)/invoices/[id]/index.tsx
// Invoice detail with inline HTML/PDF preview and actions.
import * as React from "react";
import { ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
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
import type { Invoice, PaymentMethod } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useRouteParam } from "@/lib/routing/route-param";
import {
  formatInvoiceDueDate,
  formatInvoiceIssueDateTime,
} from "@/lib/dates/format";

type InvoiceLinks = {
  originalInvoice: Invoice | null;
  modifiesInvoice: Invoice | null;
  stornoDocuments: Invoice[];
  correctionDocuments: Invoice[];
};

const MARK_PAID_METHODS: { value: PaymentMethod; i18nKey: string }[] = [
  { value: "transfer", i18nKey: "invoices.paymentMethods.transfer" },
  { value: "cash", i18nKey: "invoices.paymentMethods.cash" },
  { value: "card", i18nKey: "invoices.paymentMethods.card" },
  { value: "other", i18nKey: "invoices.paymentMethods.other" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_I18N_KEY: Record<Invoice["status"], string> = {
  draft: "invoices.status.draft",
  proforma: "invoices.proforma",
  sent: "invoices.status.sent",
  paid: "invoices.status.paid",
  partially_paid: "invoices.status.partiallyPaid",
  unpaid: "invoices.status.unpaid",
  overdue: "invoices.status.overdue",
  cancelled: "invoices.status.cancelled",
};

export default function InvoiceDetailScreen() {
  const id = useRouteParam("id");
  const { t } = useTranslation();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [links, setLinks] = React.useState<InvoiceLinks | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const [showMarkPaid, setShowMarkPaid] = React.useState(false);
  const [paidMethod, setPaidMethod] = React.useState<PaymentMethod>("transfer");
  const [paidAt, setPaidAt] = React.useState(todayIso());
  const [paidAmount, setPaidAmount] = React.useState("");

  const reload = React.useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const [invoiceData, linksData] = await Promise.all([
        apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`),
        apiFetch<InvoiceLinks>(`/api/invoices/${id}/links`),
      ]);
      setInvoice(invoiceData.invoice);
      setLinks(linksData);
      setPaidAmount(String(calculateInvoiceTotals(invoiceData.invoice.lineItems).totalAmount));
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

  async function handleMarkPaid() {
    if (!id) return;
    await runAction("markPaid", async () => {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: paidMethod,
          paidAt: new Date(paidAt).toISOString(),
          paidAmount: Number(paidAmount) || 0,
        }),
      });
      setInvoice(data.invoice);
      setMessage(
        t("invoices.markPaid.success", { status: t(STATUS_I18N_KEY[data.invoice.status]) })
      );
      setShowMarkPaid(false);
    });
  }

  async function handleCorrection() {
    if (!id) return;
    Alert.alert(
      t("invoices.correction.confirmTitle"),
      t("invoices.correction.confirmMessage"),
      [
        { text: t("invoices.markPaid.cancel"), style: "cancel" },
        {
          text: t("invoices.correction.confirm"),
          onPress: () =>
            void runAction("correction", async () => {
              const data = await apiFetch<{ invoice: Invoice }>(
                `/api/invoices/${id}/modify`,
                { method: "POST" }
              );
              router.push(routes.invoiceEdit(data.invoice.id));
            }),
        },
      ]
    );
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
          title={invoice.invoiceNumber || t("invoices.status.draft")}
          subtitle={invoice.clientName}
          actions={
            <Badge variant={invoice.status === "overdue" ? "destructive" : "outline"}>
              <BadgeText>{t(STATUS_I18N_KEY[invoice.status])}</BadgeText>
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
              <Text>{formatInvoiceIssueDateTime(invoice)}</Text>
            </HStack>
            <HStack className="justify-between">
              <Text size="sm" className="text-muted-foreground">
                Due date
              </Text>
              <Text>{formatInvoiceDueDate(invoice)}</Text>
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

        {links &&
        (links.originalInvoice ||
          links.modifiesInvoice ||
          (links.stornoDocuments?.length ?? 0) > 0 ||
          (links.correctionDocuments?.length ?? 0) > 0) ? (
          <Card className="p-4">
            <VStack space="xs">
              <Text className="font-semibold">{t("invoices.links.title")}</Text>
              {links.originalInvoice ? (
                <Pressable onPress={() => router.push(routes.invoiceDetail(links.originalInvoice!.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.stornoOf", { number: links.originalInvoice.invoiceNumber })}
                  </Text>
                </Pressable>
              ) : null}
              {links.modifiesInvoice ? (
                <Pressable onPress={() => router.push(routes.invoiceDetail(links.modifiesInvoice!.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.modifiesOf", { number: links.modifiesInvoice.invoiceNumber })}
                  </Text>
                </Pressable>
              ) : null}
              {(links.stornoDocuments ?? []).map((doc) => (
                <Pressable key={doc.id} onPress={() => router.push(routes.invoiceDetail(doc.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.stornoDocument")}: {doc.invoiceNumber}
                  </Text>
                </Pressable>
              ))}
              {(links.correctionDocuments ?? []).map((doc) => (
                <Pressable key={doc.id} onPress={() => router.push(routes.invoiceDetail(doc.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.modifiedBy")}: {doc.invoiceNumber || t("invoices.status.draft")}
                  </Text>
                </Pressable>
              ))}
            </VStack>
          </Card>
        ) : null}

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
            <Button
              variant="outline"
              disabled={busy === "correction" || invoice.status === "draft" || invoice.status === "cancelled"}
              onPress={() => void handleCorrection()}
            >
              <ButtonText>{t("invoices.correction.action")}</ButtonText>
            </Button>
          </HStack>
          <HStack space="sm" className="flex-wrap">
            <Button
              variant="outline"
              disabled={invoice.status === "draft" || invoice.status === "cancelled"}
              onPress={() => setShowMarkPaid((v) => !v)}
            >
              <ButtonText>{t("invoices.markPaid.action")}</ButtonText>
            </Button>
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

        {showMarkPaid ? (
          <Card className="p-4">
            <VStack space="md">
              <Text className="font-semibold">{t("invoices.markPaid.title")}</Text>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t("invoices.fields.paymentMethod")}</FormControlLabelText>
                </FormControlLabel>
                <HStack space="sm" className="flex-wrap">
                  {MARK_PAID_METHODS.map((pm) => (
                    <Pressable
                      key={pm.value}
                      onPress={() => setPaidMethod(pm.value)}
                      className={`rounded-lg border px-4 py-2 ${
                        paidMethod === pm.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <Text size="sm" className="font-light">{t(pm.i18nKey)}</Text>
                    </Pressable>
                  ))}
                </HStack>
              </FormControl>
              <HStack space="sm">
                <FormControl className="flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.markPaid.paidAt")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={paidAt} onChangeText={setPaidAt} placeholder="ÉÉÉÉ-HH-NN" />
                  </Input>
                </FormControl>
                <FormControl className="flex-1">
                  <FormControlLabel>
                    <FormControlLabelText>{t("invoices.markPaid.paidAmount")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField
                      keyboardType="decimal-pad"
                      value={paidAmount}
                      onChangeText={setPaidAmount}
                    />
                  </Input>
                </FormControl>
              </HStack>
              <HStack space="sm">
                <Button
                  disabled={busy === "markPaid"}
                  onPress={() => void handleMarkPaid()}
                >
                  <ButtonText>{t("invoices.markPaid.confirm")}</ButtonText>
                </Button>
                <Button variant="outline" onPress={() => setShowMarkPaid(false)}>
                  <ButtonText>{t("invoices.markPaid.cancel")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>
        ) : null}

        {message ? (
          <Card className="border-primary/30 bg-accent p-3">
            <Text size="sm">{message}</Text>
          </Card>
        ) : null}
      </VStack>
    </ScreenLayout>
  );
}
