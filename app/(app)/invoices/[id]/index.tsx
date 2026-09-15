// app/(app)/invoices/[id]/index.tsx
// Invoice detail: a money header that says the money (D2/D3), a status
// timeline + NAV state above the document preview (D6), exactly one solid
// action chosen by status with secondaries in a "Továbbiak" menu, and
// Sztornó/Törlés collapsed in a DangerZone (D1) — replacing the previous
// row of 11 identical outline buttons.
import * as React from "react";
import { ActivityIndicator, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Copy, Download, FileEdit, Mail, Wallet, CheckCircle2 } from "lucide-react-native";
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
import { InvoiceMoneyHeader } from "@/components/invoices/InvoiceMoneyHeader";
import { InvoiceTimeline, type NavTimelineState } from "@/components/invoices/InvoiceTimeline";
import { DangerZone } from "@/components/layout/DangerZone";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { apiFetch, ApiError, invoicePdfUrl } from "@/lib/api/client";
import { formatCurrency } from "@/lib/invoices/calculations";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import { isOverdue } from "@/lib/invoices/status-visuals";
import type { Invoice, PaymentMethod } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useRouteParam } from "@/lib/routing/route-param";
import { useIconColors } from "@/lib/theme/icon-colors";
import { confirmAsync } from "@/lib/ui/confirm";

type InvoiceLinks = {
  originalInvoice: Invoice | null;
  modifiesInvoice: Invoice | null;
  stornoDocuments: Invoice[];
  correctionDocuments: Invoice[];
  convertedFromInvoice: Invoice | null;
  convertedToInvoices: Invoice[];
};

type NavSubmissionRow = {
  status: string;
  transactionId: string | null;
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

// Maps a `code` an API route sends on a 400/409 (see convert+api.ts,
// storno+api.ts, modify+api.ts) to the i18n key with the matching Hungarian/
// English copy — otherwise those routes' error bodies never reach the user
// (apiFetch/ApiError only surface `error`/`statusText` unless a caller
// reads `code`).
const ERROR_CODE_I18N_KEY: Record<string, string> = {
  notProforma: "invoices.convert.notProforma",
  cancelled: "invoices.convert.cancelledSource",
  proformaNotStornoable: "invoices.errors.proformaNotStornoable",
};

export default function InvoiceDetailScreen() {
  const id = useRouteParam("id");
  const navError = useRouteParam("navError");
  const { t } = useTranslation();
  const icons = useIconColors();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [links, setLinks] = React.useState<InvoiceLinks | null>(null);
  const [navSubmission, setNavSubmission] = React.useState<NavSubmissionRow | null>(null);
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
      const [invoiceData, linksData, navData] = await Promise.all([
        apiFetch<{ invoice: Invoice }>(`/api/invoices/${id}`),
        apiFetch<InvoiceLinks>(`/api/invoices/${id}/links`),
        apiFetch<{ submissions: NavSubmissionRow[] }>(
          `/api/nav/status?invoiceId=${encodeURIComponent(id)}`
        ).catch(() => ({ submissions: [] })),
      ]);
      setInvoice(invoiceData.invoice);
      setLinks(linksData);
      setNavSubmission(navData.submissions[0] ?? null);
      const totalAmount = invoiceData.invoice.lineItems.reduce(
        (sum, li) => sum + li.quantity * li.unitPrice * (1 + li.vatRate / 100),
        0
      );
      const alreadyPaid = invoiceData.invoice.paidAmount ?? 0;
      const outstanding = Math.max(0, totalAmount - alreadyPaid);
      setPaidAmount(String(outstanding));
    } catch (e) {
      setInvoice(null);
      setLoadError(e instanceof Error ? e.message : "Failed to load invoice.");
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    void reload().finally(() => setLoading(false));
  }, [id, reload]);

  // Surfaces a NAV submission failure carried forward via ?navError= from
  // invoices/new.tsx — that screen navigates away immediately after a
  // failed submit, so a local error there is never seen.
  React.useEffect(() => {
    if (navError) {
      setMessage(t("invoices.errors.navSubmitFailedWithReason", { reason: navError }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navError]);

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      const codeKey = e instanceof ApiError && e.code ? ERROR_CODE_I18N_KEY[e.code] : undefined;
      setMessage(
        codeKey
          ? t(codeKey)
          : e instanceof Error
            ? e.message
            : t("invoices.detail.actionFailed")
      );
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
    setMessage(t("invoices.detail.emailSent"));
    await reload();
  }

  async function handleDelete() {
    if (!id) return;
    const confirmed = await confirmAsync({
      title: t("invoices.detail.deleteTitle"),
      message: t("invoices.detail.deleteMessage", { number: invoice?.invoiceNumber }),
      confirmLabel: t("invoices.detail.deleteAction"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    await runAction("delete", async () => {
      await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
      router.replace(routes.invoices);
    });
  }

  async function handleStorno() {
    if (!id) return;
    const confirmed = await confirmAsync({
      title: t("invoices.detail.stornoTitle"),
      message: t("invoices.detail.stornoMessage"),
      confirmLabel: t("invoices.detail.stornoConfirm"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    await runAction("storno", async () => {
      const data = await apiFetch<{ invoice: Invoice }>(
        `/api/invoices/${id}/storno`,
        { method: "POST" }
      );
      setMessage(t("invoices.detail.stornoCreated", { number: data.invoice.invoiceNumber }));
      router.push(routes.invoiceDetail(data.invoice.id));
    });
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

  async function handleConvert() {
    if (!id) return;
    await runAction("convert", async () => {
      try {
        const data = await apiFetch<{ invoice: Invoice }>(
          `/api/invoices/${id}/convert`,
          { method: "POST" }
        );
        router.push(routes.invoiceEdit(data.invoice.id));
      } catch (e) {
        // A live conversion already exists (409) — this is not a failure,
        // it means someone else (or a previous click) already made the
        // invoice; go straight there, exactly like "Számla megnyitása".
        if (e instanceof ApiError && e.status === 409) {
          const existing = (e.body as { invoice?: Invoice } | undefined)?.invoice;
          if (existing?.id) {
            router.push(routes.invoiceDetail(existing.id));
            return;
          }
        }
        throw e;
      }
    });
  }

  async function handleCorrection() {
    if (!id) return;
    const confirmed = await confirmAsync({
      title: t("invoices.correction.confirmTitle"),
      message: t("invoices.correction.confirmMessage"),
      confirmLabel: t("invoices.correction.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!confirmed) return;
    await runAction("correction", async () => {
      const data = await apiFetch<{ invoice: Invoice }>(
        `/api/invoices/${id}/modify`,
        { method: "POST" }
      );
      router.push(routes.invoiceEdit(data.invoice.id));
    });
  }

  async function handleDownloadPdf() {
    if (!id) return;
    const url = invoicePdfUrl(id);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Linking.openURL(url);
  }

  async function handlePaymentLink(provider: "revolut" | "barion") {
    if (!id) return;
    await runAction(provider, async () => {
      const data = await apiFetch<{ payment: { url: string } }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ invoiceId: id, provider }),
      });
      setMessage(
        provider === "revolut"
          ? t("invoices.detail.revolutLink", { url: data.payment.url })
          : t("invoices.detail.barionLink", { url: data.payment.url })
      );
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
          <Text className="text-destructive">{loadError ?? t("invoices.detail.notFound")}</Text>
          <Button variant="outline" onPress={() => void reload()}>
            <ButtonText>{t("invoices.detail.retry")}</ButtonText>
          </Button>
        </VStack>
      </ScreenLayout>
    );
  }

  const overdue = isOverdue(invoice, new Date());
  const finalized = invoice.status !== "draft";
  const isProforma = invoice.documentType === "proforma";
  const liveConversion =
    links?.convertedToInvoices?.find((inv) => inv.status !== "cancelled") ?? null;

  // Exactly one solid primary action, chosen by status (D1, spec §3.2).
  let primaryLabel = t("invoices.detail.edit");
  let primaryOnPress = () => router.push(routes.invoiceEdit(id!));
  let primaryBusyKey: string | null = null;
  if (isProforma && liveConversion) {
    primaryLabel = t("invoices.convert.openExisting");
    primaryOnPress = () => router.push(routes.invoiceDetail(liveConversion.id));
  } else if (isProforma) {
    primaryLabel = t("invoices.convert.action");
    primaryOnPress = () => void runAction("convert", handleConvert);
    primaryBusyKey = "convert";
  } else if (invoice.status === "sent" || invoice.status === "unpaid" || invoice.status === "overdue") {
    primaryLabel = t("invoices.detail.emailReminder");
    primaryOnPress = () => void runAction("send", handleSend);
    primaryBusyKey = "send";
  } else if (invoice.status === "partially_paid") {
    primaryLabel = t("invoices.markPaid.action");
    primaryOnPress = () => setShowMarkPaid((v) => !v);
  } else if (invoice.status === "paid") {
    primaryLabel = t("invoices.list.pdfAction");
    primaryOnPress = () => void handleDownloadPdf();
  } else if (invoice.status === "cancelled") {
    primaryLabel = t("invoices.list.duplicateAction");
    primaryOnPress = () => void handleDuplicate();
  }

  const markPaidDisabled = invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "paid";

  const overflowItems: OverflowMenuItem[] = [
    { label: t("invoices.list.duplicateAction"), icon: Copy, onPress: () => void handleDuplicate() },
    {
      label: t("invoices.correction.action"),
      icon: FileEdit,
      disabled: invoice.status === "draft" || invoice.status === "cancelled" || isProforma,
      onPress: () => void handleCorrection(),
    },
    { label: t("invoices.list.pdfAction"), icon: Download, onPress: () => router.push(routes.invoiceDetail(id!)) },
    {
      label: t("invoices.detail.revolut"),
      icon: Wallet,
      onPress: () => void handlePaymentLink("revolut"),
    },
    {
      label: t("invoices.detail.barion"),
      icon: Wallet,
      onPress: () => void handlePaymentLink("barion"),
    },
  ];

  const nav: NavTimelineState | null = navSubmission
    ? {
        status: navSubmission.status,
        label: t(`invoices.nav.statusValues.${navSubmission.status.toLowerCase()}`, {
          defaultValue: navSubmission.status,
        }),
        transactionId: navSubmission.transactionId,
      }
    : null;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={invoice.invoiceNumber || t("invoices.status.draft")}
          breadcrumb={[{ label: t("invoices.title"), href: routes.invoices }, { label: invoice.invoiceNumber || t("invoices.status.draft") }]}
        />
      }
    >
      <VStack space="lg">
        <InvoiceMoneyHeader
          invoice={invoice}
          primaryAction={
            <Button
              variant="default"
              disabled={!!primaryBusyKey && busy === primaryBusyKey}
              onPress={primaryOnPress}
            >
              <ButtonText>{primaryLabel}</ButtonText>
            </Button>
          }
          secondaryAction={
            <HStack space="xs" className="items-center">
              <Button
                size="sm"
                variant="outline"
                disabled={markPaidDisabled}
                onPress={() => setShowMarkPaid((v) => !v)}
                testID="invoice-detail-mark-paid-toggle"
              >
                <CheckCircle2 size={14} color={icons.foreground} />
                <ButtonText>{t("invoices.markPaid.action")}</ButtonText>
              </Button>
              <OverflowMenu items={overflowItems} label={t("invoices.detail.overflowLabel")} />
            </HStack>
          }
        />

        <InvoiceTimeline invoice={invoice} nav={nav} />

        {links &&
        (links.originalInvoice ||
          links.modifiesInvoice ||
          links.convertedFromInvoice ||
          (links.stornoDocuments?.length ?? 0) > 0 ||
          (links.correctionDocuments?.length ?? 0) > 0 ||
          (links.convertedToInvoices?.length ?? 0) > 0) ? (
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
              {links.convertedFromInvoice ? (
                <Pressable onPress={() => router.push(routes.invoiceDetail(links.convertedFromInvoice!.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.convertedFrom", { number: links.convertedFromInvoice.invoiceNumber })}
                  </Text>
                </Pressable>
              ) : null}
              {(links.convertedToInvoices ?? []).map((doc) => (
                <Pressable key={doc.id} onPress={() => router.push(routes.invoiceDetail(doc.id))}>
                  <Text size="sm" className="text-primary">
                    {t("invoices.links.convertedTo", { number: doc.invoiceNumber || t("invoices.status.draft") })}
                  </Text>
                </Pressable>
              ))}
            </VStack>
          </Card>
        ) : null}

        <InvoiceDocumentPreview invoice={invoice} invoiceId={id} layout="single" />

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
                  {(invoice.paidAmount ?? 0) > 0 ? (
                    <Text size="xs" className="mt-1 text-muted-foreground">
                      {t("invoices.markPaid.paidAmountHint", {
                        amount: formatCurrency(invoice.paidAmount ?? 0, invoice.currency),
                      })}
                    </Text>
                  ) : null}
                </FormControl>
              </HStack>
              <HStack space="sm">
                <Button
                  disabled={busy === "markPaid"}
                  onPress={() => void handleMarkPaid()}
                  testID="invoice-detail-mark-paid-confirm"
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

        {finalized && !isProforma ? (
          <DangerZone title={t("invoices.detail.dangerZone")} description={t("invoices.detail.dangerZoneHint")}>
            <HStack space="sm" className="flex-wrap">
              <Button
                variant="outline"
                className="border-destructive/40"
                disabled={busy === "storno" || invoice.status === "cancelled"}
                onPress={() => void handleStorno()}
              >
                <ButtonText className="text-destructive">{t("invoices.storno")}</ButtonText>
              </Button>
              <Button
                variant="outline"
                className="border-destructive/40"
                disabled={busy === "delete"}
                onPress={() => void handleDelete()}
              >
                <ButtonText className="text-destructive">{t("invoices.detail.deleteAction")}</ButtonText>
              </Button>
            </HStack>
          </DangerZone>
        ) : (
          <DangerZone title={t("invoices.detail.dangerZone")} description={t("invoices.detail.dangerZoneHint")}>
            <Button
              variant="outline"
              className="border-destructive/40 self-start"
              disabled={busy === "delete"}
              onPress={() => void handleDelete()}
            >
              <ButtonText className="text-destructive">{t("invoices.detail.deleteAction")}</ButtonText>
            </Button>
          </DangerZone>
        )}
      </VStack>
    </ScreenLayout>
  );
}
