// app/(app)/invoices/index.tsx
// Invoice list — a desktop table (L1: the dashboard already knew how to
// render one; the list gets the same visual language), a mobile card list.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Download, Mail, Copy, CheckCircle2, Eye, FileEdit, Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceListTable, type InvoiceListSort, type InvoiceSortKey } from "@/components/invoices/InvoiceListTable";
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { StatCard } from "@/components/layout/StatCard";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStatusCounts } from "@/hooks/useInvoiceStatusCounts";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useRouteParam } from "@/lib/routing/route-param";
import { apiFetch, ApiError } from "@/lib/api/client";
import { confirmAsync } from "@/lib/ui/confirm";

// Same code→i18n mapping as the detail screen (app/(app)/invoices/[id]/index.tsx)
// — the convert route's 400 bodies only carry a `code`, not a translated
// `error`, so a caller has to map it itself or the string never surfaces.
const CONVERT_ERROR_I18N_KEY: Record<string, string> = {
  notProforma: "invoices.convert.notProforma",
  cancelled: "invoices.convert.cancelledSource",
};

const FILTERS: Array<InvoiceStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "unpaid",
  "overdue",
  "paid",
];

function isKnownFilter(value: string | undefined): value is InvoiceStatus | "all" {
  return !!value && (FILTERS as string[]).includes(value);
}

export default function InvoiceListScreen() {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const statusParam = useRouteParam("status");
  const [filter, setFilter] = React.useState<InvoiceStatus | "all">(
    isKnownFilter(statusParam) ? statusParam : "all"
  );
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<InvoiceListSort>({ key: "issued", direction: "desc" });
  const {
    invoices,
    loading,
    stats,
    total,
    refresh,
    remove,
    convertedProformaIds = {},
  } = useInvoices({
    status: filter,
    search,
  });
  const { counts, allCount, other: otherCount } = useInvoiceStatusCounts();
  // Matches the dashboard's default currency (HUF) — invoices don't share a
  // single currency, so this is only a label for the primary total, never a
  // sum across currencies (L6).
  const primaryCurrency = "HUF";
  const otherCurrencyTotal = React.useMemo(() => {
    const foreign = invoices.filter((inv) => inv.currency !== primaryCurrency);
    if (foreign.length === 0) return null;
    const byCurrency = new Map<string, number>();
    for (const inv of foreign) {
      const gross = calculateInvoiceTotals(inv.lineItems).totalAmount;
      byCurrency.set(inv.currency, (byCurrency.get(inv.currency) ?? 0) + gross);
    }
    const [currency, amount] = [...byCurrency.entries()][0];
    return { currency, amount, kinds: byCurrency.size };
  }, [invoices]);
  const [previewInvoice, setPreviewInvoice] = React.useState<Invoice | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // A minimal local toast for the row-menu convert action's errors — see
  // InvoiceComposer's identical pattern for why this isn't components/ui/toast.
  React.useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const sortedInvoices = React.useMemo(() => {
    const copy = [...invoices];
    copy.sort((a, b) => {
      let diff = 0;
      if (sort.key === "issued") {
        diff = a.issueDate.localeCompare(b.issueDate);
      } else if (sort.key === "due") {
        diff = a.dueDate.localeCompare(b.dueDate);
      } else {
        diff =
          calculateInvoiceTotals(a.lineItems).totalAmount -
          calculateInvoiceTotals(b.lineItems).totalAmount;
      }
      return sort.direction === "asc" ? diff : -diff;
    });
    return copy;
  }, [invoices, sort]);

  function handleSortChange(key: InvoiceSortKey) {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  }

  async function handleDelete(invoice: Invoice) {
    const confirmed = await confirmAsync({
      title: t("invoices.card.deleteTitle"),
      message: t("invoices.card.deleteMessage", { number: invoice.invoiceNumber }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (confirmed) {
      await remove(invoice.id);
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    await apiFetch(`/api/invoices/${invoice.id}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "transfer", paidAt: new Date().toISOString() }),
    });
    await refresh();
  }

  async function handleDuplicate(invoice: Invoice) {
    const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/duplicate`, {
      method: "POST",
    });
    router.push(routes.invoiceEdit(data.invoice.id));
  }

  function handleOpenExisting(invoice: Invoice) {
    const existingId = convertedProformaIds[invoice.id];
    if (existingId) {
      router.push(routes.invoiceDetail(existingId));
    }
  }

  async function handleConvert(invoice: Invoice) {
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/convert`, {
        method: "POST",
      });
      router.push(routes.invoiceEdit(data.invoice.id));
    } catch (e) {
      // A live conversion already exists (409) — not a failure, go straight
      // to it, matching the detail screen's "Számla megnyitása" behavior.
      if (e instanceof ApiError && e.status === 409) {
        const existing = (e.body as { invoice?: Invoice } | undefined)?.invoice;
        if (existing?.id) {
          router.push(routes.invoiceDetail(existing.id));
          return;
        }
      }
      const codeKey = e instanceof ApiError && e.code ? CONVERT_ERROR_I18N_KEY[e.code] : undefined;
      setToastMessage(
        codeKey ? t(codeKey) : e instanceof Error ? e.message : t("invoices.detail.actionFailed")
      );
    }
  }

  function menuItemsFor(invoice: Invoice): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [
      { label: t("invoices.list.previewAction"), icon: Eye, onPress: () => setPreviewInvoice(invoice) },
      {
        label: t("invoices.list.pdfAction"),
        icon: Download,
        onPress: () => router.push(routes.invoiceDetail(invoice.id)),
      },
      {
        label: t("invoices.list.emailAction"),
        icon: Mail,
        onPress: () => router.push(routes.invoiceDetail(invoice.id)),
      },
      {
        label: t("invoices.list.markPaidAction"),
        icon: CheckCircle2,
        disabled: invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "draft",
        onPress: () => void handleMarkPaid(invoice),
      },
      { label: t("invoices.list.duplicateAction"), icon: Copy, onPress: () => void handleDuplicate(invoice) },
    ];
    if (invoice.documentType === "proforma" && convertedProformaIds[invoice.id]) {
      items.push({
        label: t("invoices.convert.openExisting"),
        icon: FileEdit,
        onPress: () => handleOpenExisting(invoice),
      });
    } else if (invoice.documentType === "proforma") {
      items.push({
        label: t("invoices.convert.action"),
        icon: FileEdit,
        onPress: () => void handleConvert(invoice),
      });
    }
    items.push({
      label: t("invoices.list.deleteAction"),
      icon: Trash2,
      destructive: true,
      onPress: () => void handleDelete(invoice),
    });
    return items;
  }

  const filterLabel = (f: InvoiceStatus | "all") => (f === "all" ? t("invoices.list.filterAll") : t(STATUS_I18N_KEY[f]));
  const filterCount = (f: InvoiceStatus | "all") => (f === "all" ? allCount : counts[f] ?? 0);

  const header = (
    <VStack space="md" className="pb-4">
      <PageHeader
        title={t("invoices.title")}
        primaryAction={
          <Button size="sm" onPress={() => router.push(routes.newInvoice)}>
            <ButtonText>{t("nav.newInvoice")}</ButtonText>
          </Button>
        }
      />
      <HStack space="md" className="flex-wrap">
        <StatCard label={t("invoices.list.total")} value={stats.count} />
        <StatCard label={t("invoices.list.thisMonth")} value={stats.thisMonthCount} />
        <StatCard
          label={t("invoices.list.monthlyTotal")}
          value={formatCurrency(stats.monthlyTotal, primaryCurrency)}
          hint={
            otherCurrencyTotal
              ? t("invoices.list.mixedCurrencyNote", {
                  amount: formatCurrency(
                    otherCurrencyTotal.amount,
                    otherCurrencyTotal.currency as Invoice["currency"]
                  ),
                })
              : undefined
          }
        />
      </HStack>
      <Input>
        <InputField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t("invoices.list.searchPlaceholder")}
          testID="invoice-list-search"
        />
      </Input>
      <HStack space="xs" className="flex-wrap">
        {FILTERS.map((f) => {
          const selected = filter === f;
          return (
            <Pressable
              key={f}
              testID={`invoice-filter-${f}`}
              onPress={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 ${
                selected ? "border-primary bg-primary" : "border-border bg-transparent"
              }`}
            >
              <Text size="xs" className={selected ? "font-medium text-primary-foreground" : "text-foreground"}>
                {t("invoices.list.filterCount", { label: filterLabel(f), count: filterCount(f) })}
              </Text>
            </Pressable>
          );
        })}
        {otherCount > 0 ? (
          <Pressable className="rounded-full border border-border bg-transparent px-3 py-1.5">
            <Text size="xs" className="text-foreground">
              {t("invoices.list.filterCount", { label: t("invoices.list.filterOther"), count: otherCount })}
            </Text>
          </Pressable>
        ) : null}
      </HStack>
    </VStack>
  );

  const emptyState = (
    <StateView
      kind="empty"
      title={t("invoices.empty")}
      description={t("invoices.list.emptyDescription")}
      action={
        <Button onPress={() => router.push(routes.newInvoice)}>
          <ButtonText>{t("nav.newInvoice")}</ButtonText>
        </Button>
      }
    />
  );

  return (
    <ScreenLayout header={header}>
      {isDesktop ? (
        <InvoiceListTable
          invoices={sortedInvoices}
          loading={loading}
          sort={sort}
          onSortChange={handleSortChange}
          onRowPress={(inv) => router.push(routes.invoiceDetail(inv.id))}
          menuItemsFor={menuItemsFor}
          empty={emptyState}
          convertedIds={convertedProformaIds}
        />
      ) : loading && invoices.length === 0 ? (
        <StateView kind="loading" title="" />
      ) : invoices.length === 0 ? (
        emptyState
      ) : (
        <VStack space="sm">
          {sortedInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onDelete={(id) => void remove(id)}
              onPress={(inv) => router.push(routes.invoiceDetail(inv.id))}
              onPreview={(inv) => setPreviewInvoice(inv)}
              onConvert={(inv) => void handleConvert(inv)}
              converted={!!convertedProformaIds[invoice.id]}
              onOpenExisting={(inv) => handleOpenExisting(inv)}
            />
          ))}
        </VStack>
      )}
      <InvoicePreviewModal
        invoice={previewInvoice}
        open={previewInvoice !== null}
        onClose={() => setPreviewInvoice(null)}
      />
      {toastMessage ? (
        <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="invoice-list-toast">
          <Box className="rounded-lg bg-foreground px-4 py-2.5 shadow-lg">
            <Text className="text-sm font-medium text-background">{toastMessage}</Text>
          </Box>
        </Box>
      ) : null}
    </ScreenLayout>
  );
}
