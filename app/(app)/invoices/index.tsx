// app/(app)/invoices/index.tsx
// Invoice list — a desktop table (L1: the dashboard already knew how to
// render one; the list gets the same visual language), a mobile card list.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Download, Mail, Copy, CheckCircle2, Eye, FileEdit, Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ExchangeRateFixBanner } from "@/components/invoices/ExchangeRateFixBanner";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceFilterChips, isKnownInvoiceFilter } from "@/components/invoices/InvoiceFilterChips";
import { InvoiceMonthStepper } from "@/components/invoices/InvoiceMonthStepper";
import { InvoiceListTable, type InvoiceListSort, type InvoiceSortKey } from "@/components/invoices/InvoiceListTable";
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { StatCard } from "@/components/layout/StatCard";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStatusCounts } from "@/hooks/useInvoiceStatusCounts";
import { useNavFailedCount } from "@/hooks/useNavFailedCount";
import { useMissingExchangeRateCount } from "@/hooks/useMissingExchangeRateCount";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { useRouteParam } from "@/lib/routing/route-param";
import { apiFetch, ApiError } from "@/lib/api/client";
import { confirmAsync } from "@/lib/ui/confirm";
import { isDevSeedButtonVisible } from "@/lib/dev/seed-visible";
import { CSV_COLUMNS, csvExportFilename, invoiceListToCsv, type CsvLabels } from "@/lib/invoices/export-csv";
import { EXPORT_ROW_CAP, fetchAllInvoicesForExport } from "@/lib/invoices/export-fetch";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import { saveDownload } from "@/components/settings/save-download";

// Same code→i18n mapping as the detail screen (app/(app)/invoices/[id]/index.tsx)
// — the convert route's 400 bodies only carry a `code`, not a translated
// `error`, so a caller has to map it itself or the string never surfaces.
const CONVERT_ERROR_I18N_KEY: Record<string, string> = {
  notProforma: "invoices.convert.notProforma",
  cancelled: "invoices.convert.cancelledSource",
};

export default function InvoiceListScreen() {
  const { t, i18n } = useTranslation();
  const isDesktop = useIsDesktop();
  const statusParam = useRouteParam("status");
  // /invoices?search=… — the partner screens' "Számlái" link lands here pre-searched.
  const searchParam = useRouteParam("search");
  const [filter, setFilter] = React.useState<InvoiceStatus | "all">(
    isKnownInvoiceFilter(statusParam) ? statusParam : "all"
  );
  const [searchInput, setSearchInput] = React.useState(searchParam ?? "");
  const [search, setSearch] = React.useState(searchParam?.trim() ?? "");
  const [sort, setSort] = React.useState<InvoiceListSort>({ key: "issued", direction: "desc" });
  const [needsExchangeRate, setNeedsExchangeRate] = React.useState(false);
  // "NAV-hiba" is a NAV outcome, not a status: the dashboard's next-actions row
  // arrives as ?status=navFailed and lands on this chip with the status cleared.
  const [navFailed, setNavFailed] = React.useState(statusParam === "navFailed");
  const { count: navFailedCount } = useNavFailedCount();
  const [month, setMonth] = React.useState<string | undefined>(undefined);
  const {
    invoices,
    loading,
    stats,
    total,
    refresh,
    remove,
    hasMore,
    loadMore,
    loadingMore,
    convertedProformaIds = {},
  } = useInvoices({
    status: filter,
    search,
    needsExchangeRate,
    month,
    navFailed,
  });
  const { counts, allCount, other: otherCount } = useInvoiceStatusCounts();
  const { count: missingExchangeRateCount } = useMissingExchangeRateCount();

  function handleShowAffectedInvoices() {
    setFilter("all");
    setNeedsExchangeRate(true);
  }

  function handleShowAllInvoices() {
    setNeedsExchangeRate(false);
  }
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
  const [exporting, setExporting] = React.useState(false);

  // The whole filtered list (not just the loaded pages), in the table's
  // current order, as a CSV for the könyvelő. Web only: there is no file
  // system to save into on native, and saveDownload says so.
  async function handleExportCsv() {
    setExporting(true);
    try {
      const { invoices: all, truncated } = await fetchAllInvoicesForExport({
        status: filter,
        search,
        needsExchangeRate,
        month,
        navFailed,
      });
      if (all.length === 0) {
        setToastMessage(t("invoices.list.exportCsvEmpty"));
        return;
      }
      const direction = sort.direction === "asc" ? 1 : -1;
      const sortValue = (inv: Invoice) =>
        sort.key === "issued"
          ? inv.issueDate
          : sort.key === "due"
            ? inv.dueDate
            : calculateInvoiceTotals(inv.lineItems).totalAmount;
      all.sort((a, b) => {
        const va = sortValue(a);
        const vb = sortValue(b);
        const diff = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
        return diff * direction;
      });
      const labels: CsvLabels = {
        header: Object.fromEntries(
          CSV_COLUMNS.map((column) => [column, t(`invoices.list.exportColumns.${column}`)]),
        ) as CsvLabels["header"],
        status: (inv) => t(STATUS_I18N_KEY[inv.status]),
        documentType: (inv) => t(`invoices.documentTypes.${inv.documentType}`),
        paymentMethod: (method) => t(`invoices.paymentMethods.${method}`),
        draftNumber: t("invoices.list.exportDraftNumber"),
      };
      const csv = invoiceListToCsv(all, labels, i18n.language);
      const saved = saveDownload(
        csvExportFilename({ month, status: filter }, new Date()),
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      if (!saved) {
        setToastMessage(t("invoices.list.exportCsvWebOnly"));
      } else if (truncated) {
        setToastMessage(t("invoices.list.exportCsvTruncated", { cap: EXPORT_ROW_CAP }));
      }
    } catch {
      setToastMessage(t("invoices.list.exportCsvFailed"));
    } finally {
      setExporting(false);
    }
  }

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
      <ExchangeRateFixBanner
        count={missingExchangeRateCount}
        active={needsExchangeRate}
        onShowAffected={handleShowAffectedInvoices}
        onShowAll={handleShowAllInvoices}
      />
      <Input>
        <InputField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder={t("invoices.list.searchPlaceholder")}
          testID="invoice-list-search"
        />
      </Input>
      <InvoiceFilterChips
        filter={filter}
        onSelect={(next) => {
          setNavFailed(false);
          setFilter(next);
        }}
        navFailedCount={navFailedCount}
        navFailedSelected={navFailed}
        onSelectNavFailed={() => {
          setFilter("all");
          setNavFailed((current) => !current);
        }}
        counts={counts}
        allCount={allCount}
        otherCount={otherCount}
        t={t}
      />
      <HStack space="sm" className="flex-wrap items-center justify-between">
        <InvoiceMonthStepper month={month} onChange={setMonth} />
        <Button
          size="sm"
          variant="outline"
          onPress={() => void handleExportCsv()}
          disabled={exporting}
          testID="invoice-list-export"
        >
          {exporting ? <ButtonSpinner /> : null}
          <ButtonText>{t("invoices.list.exportCsv")}</ButtonText>
        </Button>
      </HStack>
    </VStack>
  );

  // Below whichever list rendered: how far the page reaches, and a way on.
  const loadMoreFooter =
    !loading && invoices.length > 0 ? (
      <HStack space="md" className="items-center justify-center py-3" testID="invoice-list-footer">
        <Text size="sm" className="text-muted-foreground">
          {t("invoices.list.showingOf", { shown: invoices.length, total })}
        </Text>
        {hasMore ? (
          <Button size="sm" variant="outline" onPress={() => void loadMore()} disabled={loadingMore} testID="invoice-list-load-more">
            <ButtonText>{t("invoices.list.loadMore")}</ButtonText>
          </Button>
        ) : null}
      </HStack>
    ) : null;

  const emptyState = needsExchangeRate ? (
    <StateView kind="empty" title={t("invoices.exchangeRateFix.emptyAffected")} />
  ) : (
    <StateView
      kind="empty"
      title={t("invoices.empty")}
      description={t(isDevSeedButtonVisible() ? "invoices.list.emptyDescription" : "invoices.list.emptyDescriptionNoDemo")}
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
      {loadMoreFooter}
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
