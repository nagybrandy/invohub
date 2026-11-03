// app/(app)/invoices/index.tsx
// Számlák (redesign 2026-11, SPEC §6): header with "Új számla", the KPI strip,
// the NAV alert, a toolbar (search; period + CSV on wide containers, the
// "Szűrés és rendezés" sheet on narrow ones), status tabs and one list card
// that is a table above 820px and cards below. Row menus offer at most five
// existing actions and never send / storno / NAV.
import * as React from "react";
import { Linking, Platform, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileEdit,
  FileText,
  SlidersHorizontal,
  Trash2,
} from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ExchangeRateFixBanner } from "@/components/invoices/ExchangeRateFixBanner";
import { isKnownInvoiceFilter } from "@/components/invoices/InvoiceFilterChips";
import { InvoiceFilterSheet } from "@/components/lists/InvoiceFilterSheet";
import { InvoiceList } from "@/components/lists/InvoiceList";
import { KpiStrip, type KpiCell } from "@/components/lists/KpiStrip";
import { ListFooterBar } from "@/components/lists/ListFooterBar";
import { ListSearchField } from "@/components/lists/ListSearchField";
import { NavAlertBanner } from "@/components/lists/NavAlertBanner";
import { StatusTabs, type StatusTab } from "@/components/lists/StatusTabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";
import { useInvoiceStatusCounts } from "@/hooks/useInvoiceStatusCounts";
import { useNavFailedCount } from "@/hooks/useNavFailedCount";
import { useMissingExchangeRateCount } from "@/hooks/useMissingExchangeRateCount";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { useRouteParam } from "@/lib/routing/route-param";
import { apiFetch, ApiError, invoicePdfUrl } from "@/lib/api/client";
import { confirmAsync } from "@/lib/ui/confirm";
import { isDevSeedButtonVisible } from "@/lib/dev/seed-visible";
import { CSV_COLUMNS, csvExportFilename, invoiceListToCsv, type CsvLabels } from "@/lib/invoices/export-csv";
import { EXPORT_ROW_CAP, fetchAllInvoicesForExport } from "@/lib/invoices/export-fetch";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import { currentMonth, formatMonthLabel } from "@/lib/invoices/list-query";
import { formatVatPeriodLabel } from "@/lib/dashboard/vat-period";
import { summarizeInvoices } from "@/lib/lists/footer-stats";
import { activeFilterCount, buildPeriodOptions } from "@/lib/lists/filter-state";
import { invoiceMenuActions } from "@/lib/lists/invoice-menu";
import { DEFAULT_INVOICE_SORT, nextSort, sortInvoices, type InvoiceListSort, type InvoiceSortKey } from "@/lib/lists/invoice-sort";
import { LAYOUT } from "@/lib/theme/layout";
import { useIconColors } from "@/lib/theme/icon-colors";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";
import { saveDownload } from "@/components/settings/save-download";

// The convert route's 400 bodies only carry a `code`, so the caller maps it
// itself or the translated message never surfaces (same map as the detail screen).
const CONVERT_ERROR_I18N_KEY: Record<string, string> = {
  notProforma: "invoices.convert.notProforma",
  cancelled: "invoices.convert.cancelledSource",
};

const PRIMARY_CURRENCY = "HUF";

type TabKey = InvoiceStatus | "all" | "navFailed" | "other";

export default function InvoiceListScreen() {
  const { t, i18n } = useTranslation();
  const icons = useIconColors();
  const statusParam = useRouteParam("status");
  // /invoices?search=… — the partner screens' "Számlái" link lands here pre-searched.
  const searchParam = useRouteParam("search");
  const [filter, setFilter] = React.useState<InvoiceStatus | "all">(
    isKnownInvoiceFilter(statusParam) ? statusParam : "all",
  );
  const [searchInput, setSearchInput] = React.useState(searchParam ?? "");
  const [search, setSearch] = React.useState(searchParam?.trim() ?? "");
  const [sort, setSort] = React.useState<InvoiceListSort>(DEFAULT_INVOICE_SORT);
  const [needsExchangeRate, setNeedsExchangeRate] = React.useState(false);
  // "NAV-hiba" is a NAV outcome, not a status: the dashboard's next-actions row
  // arrives as ?status=navFailed and lands on this filter with the status cleared.
  const [navFailed, setNavFailed] = React.useState(statusParam === "navFailed");
  const [month, setMonth] = React.useState<string | undefined>(undefined);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const { count: navFailedCount } = useNavFailedCount();
  const { counts, allCount, other: otherCount } = useInvoiceStatusCounts();
  const { count: missingExchangeRateCount } = useMissingExchangeRateCount();
  const dashboard = useDashboardSummary();
  const {
    invoices,
    loading,
    error,
    total,
    refresh,
    remove,
    hasMore,
    loadMore,
    loadingMore,
    convertedProformaIds = {},
  } = useInvoices({ status: filter, search, needsExchangeRate, month, navFailed });

  // The list's own width (not the window's) decides table vs cards and where
  // the period / CSV controls live.
  const { width: containerWidth, measured, onLayout } = useMeasuredWidth();
  const windowWidth = useWindowDimensions().width;
  const wide = (measured ? containerWidth : windowWidth) > LAYOUT.listCardsMax;

  React.useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // A minimal local toast for row-menu action errors (InvoiceComposer's
  // identical pattern; components/ui/toast is not used here).
  React.useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const sortedInvoices = React.useMemo(() => sortInvoices(invoices, sort), [invoices, sort]);
  const footerSummary = React.useMemo(() => summarizeInvoices(invoices), [invoices]);
  const periodOptions = React.useMemo(
    () => buildPeriodOptions({ allLabel: t("lists.filter.allPeriods"), language: i18n.language, selected: month }),
    [t, i18n.language, month],
  );
  const filterCount = activeFilterCount({ filter, navFailed, month, sort });
  const filtering = filter !== "all" || navFailed || !!month || search.length > 0;

  function selectStatus(next: InvoiceStatus | "all") {
    setNavFailed(false);
    setFilter(next);
  }

  function selectNavFailed() {
    setFilter("all");
    setNavFailed(true);
  }

  function toggleNavFailed() {
    setFilter("all");
    setNavFailed((current) => !current);
  }

  function resetFilters() {
    setFilter("all");
    setNavFailed(false);
    setMonth(undefined);
    setSort(DEFAULT_INVOICE_SORT);
  }

  // The whole filtered list (not just the loaded pages), in the table's
  // current order, as a CSV. Web only: native has no file system to save into.
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
      const ordered = sortInvoices(all, sort);
      const labels: CsvLabels = {
        header: Object.fromEntries(
          CSV_COLUMNS.map((column) => [column, t(`invoices.list.exportColumns.${column}`)]),
        ) as CsvLabels["header"],
        status: (inv) => t(STATUS_I18N_KEY[inv.status]),
        documentType: (inv) => t(`invoices.documentTypes.${inv.documentType}`),
        paymentMethod: (method) => t(`invoices.paymentMethods.${method}`),
        draftNumber: t("invoices.list.exportDraftNumber"),
      };
      const csv = invoiceListToCsv(ordered, labels, i18n.language);
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

  function failureMessage(e: unknown) {
    return e instanceof Error ? e.message : t("invoices.detail.actionFailed");
  }

  async function handleDelete(invoice: Invoice) {
    const confirmed = await confirmAsync({
      title: t("invoices.card.deleteTitle"),
      message: t("invoices.card.deleteMessage", { number: invoice.invoiceNumber }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove(invoice.id);
    } catch (e) {
      setToastMessage(failureMessage(e));
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    try {
      await apiFetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: "transfer", paidAt: new Date().toISOString() }),
      });
      await refresh();
    } catch (e) {
      setToastMessage(failureMessage(e));
    }
  }

  async function handleDuplicate(invoice: Invoice) {
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/duplicate`, { method: "POST" });
      router.push(routes.invoiceEdit(data.invoice.id));
    } catch (e) {
      setToastMessage(failureMessage(e));
    }
  }

  async function handleDownloadPdf(invoice: Invoice) {
    const url = invoicePdfUrl(invoice.id);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    await Linking.openURL(url);
  }

  function handleOpenExisting(invoice: Invoice) {
    const existingId = convertedProformaIds[invoice.id];
    if (existingId) router.push(routes.invoiceDetail(existingId));
  }

  async function handleConvert(invoice: Invoice) {
    try {
      const data = await apiFetch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/convert`, { method: "POST" });
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
      setToastMessage(codeKey ? t(codeKey) : failureMessage(e));
    }
  }

  function menuItemsFor(invoice: Invoice): OverflowMenuItem[] {
    const actions = invoiceMenuActions(invoice, { convertedExists: !!convertedProformaIds[invoice.id] });
    return actions.map((action): OverflowMenuItem => {
      switch (action) {
        case "open":
          return {
            label: t("lists.menu.open"),
            icon: ExternalLink,
            onPress: () => router.push(routes.invoiceDetail(invoice.id)),
          };
        case "pdf":
          return { label: t("invoices.list.pdfAction"), icon: Download, onPress: () => void handleDownloadPdf(invoice) };
        case "duplicate":
          return { label: t("invoices.list.duplicateAction"), icon: Copy, onPress: () => void handleDuplicate(invoice) };
        case "markPaid":
          return { label: t("invoices.list.markPaidAction"), icon: CheckCircle2, onPress: () => void handleMarkPaid(invoice) };
        case "convert":
          return { label: t("invoices.convert.action"), icon: FileEdit, onPress: () => void handleConvert(invoice) };
        case "openConverted":
          return { label: t("invoices.convert.openExisting"), icon: FileText, onPress: () => handleOpenExisting(invoice) };
        case "delete":
          return {
            label: t("invoices.list.deleteAction"),
            icon: Trash2,
            destructive: true,
            onPress: () => void handleDelete(invoice),
          };
      }
    });
  }

  // --- KPI strip: the dashboard summary's real numbers -------------------
  const { summary } = dashboard;
  const summaryLoading = dashboard.loading;
  const money = (amount: number) => (dashboard.error ? "—" : formatCurrency(amount, PRIMARY_CURRENCY));
  const count = (n: number) => t("lists.kpi.invoiceCount", { count: n });
  const kpiCells: KpiCell[] = [
    // Outstanding spans four statuses (sent, unpaid, overdue, partly paid) and
    // the API filters by one status: a click target would lie, so it is a plain cell.
    {
      key: "outstanding",
      label: t("lists.kpi.outstanding"),
      value: money(summary.outstanding),
      sub: dashboard.error ? undefined : count(dashboard.outstandingCount),
    },
    {
      key: "overdue",
      label: t("lists.kpi.overdue"),
      value: money(summary.overdueTotal),
      sub: dashboard.error ? undefined : count(summary.overdueCount),
      tone: "err",
      onPress: () => selectStatus("overdue"),
    },
    {
      key: "paid",
      label: t("lists.kpi.paid"),
      value: money(summary.revenue),
      sub: formatMonthLabel(currentMonth(), i18n.language),
      tone: "ok",
      onPress: () => selectStatus("paid"),
    },
    {
      key: "vat",
      label: t("lists.kpi.vat"),
      value: money(summary.estimatedVat),
      sub: formatVatPeriodLabel(new Date(), i18n.language),
    },
  ];

  // --- Status tabs / header popover: the same single-choice options -------
  const statusLabel = (key: InvoiceStatus | "all") =>
    key === "all" ? t("invoices.list.filterAll") : t(STATUS_I18N_KEY[key]);
  const statusKeys: Array<InvoiceStatus | "all"> = ["all", "draft", "sent", "unpaid", "overdue", "paid"];
  const statusCount = (key: InvoiceStatus | "all") => (key === "all" ? allCount : (counts[key] ?? 0));
  const tabs: StatusTab<TabKey>[] = [
    ...statusKeys.map((key) => ({
      key: key as TabKey,
      label: statusLabel(key),
      count: statusCount(key),
      critical: key === "overdue",
    })),
    ...(navFailedCount > 0 || navFailed
      ? [{ key: "navFailed" as TabKey, label: t("invoices.list.filterNavFailed"), count: navFailedCount, critical: true }]
      : []),
    ...(otherCount > 0
      ? [{ key: "other" as TabKey, label: t("invoices.list.filterOther"), count: otherCount, disabled: true }]
      : []),
  ];
  const tabValue: TabKey = navFailed ? "navFailed" : filter;
  const statusFilterProps = {
    value: filter,
    options: statusKeys.map((key) => ({ key, label: statusLabel(key), count: statusCount(key) })),
    onChange: selectStatus,
  };

  const exchangeRateEmpty = needsExchangeRate;
  const emptyState = (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      {exchangeRateEmpty ? (
        <StateView kind="empty" title={t("invoices.exchangeRateFix.emptyAffected")} />
      ) : filtering ? (
        <StateView
          kind="empty"
          title={t("lists.noResults")}
          description={t("lists.noResultsHint")}
          action={
            <Button
              variant="secondary"
              testID="invoice-list-clear-filters"
              onPress={() => {
                resetFilters();
                setSearchInput("");
              }}
            >
              <ButtonText>{t("lists.clearFilters")}</ButtonText>
            </Button>
          }
        />
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
      )}
    </Box>
  );

  const totalsText = footerSummary.byCurrency
    .map((row) => formatCurrency(row.gross, row.currency as Invoice["currency"]))
    .join(" + ");
  const footer =
    !loading && invoices.length > 0 ? (
      <ListFooterBar
        testID="invoice-list-stats"
        countLabel={
          total > invoices.length
            ? t("lists.footer.invoicesPartial", { shown: invoices.length, total })
            : t("lists.footer.invoices", { count: invoices.length })
        }
        totalsLabel={t("lists.footer.grossTotal")}
        totals={totalsText}
      />
    ) : null;

  const loadMoreFooter =
    !loading && hasMore ? (
      <Box testID="invoice-list-footer" className="items-center py-3">
        <Button
          size="sm"
          variant="secondary"
          onPress={() => void loadMore()}
          disabled={loadingMore}
          testID="invoice-list-load-more"
        >
          <ButtonText>{t("invoices.list.loadMore")}</ButtonText>
        </Button>
      </Box>
    ) : null;

  const header = (
    <PageHeader
      title={t("invoices.title")}
      actions={
        <Button testID="invoice-list-new" onPress={() => router.push(routes.newInvoice)}>
          <ButtonText>{t("nav.newInvoice")}</ButtonText>
        </Button>
      }
    />
  );

  const listArea =
    error && invoices.length === 0 && !loading ? (
      <Box className="overflow-hidden rounded-card bg-surface shadow-card">
        <StateView kind="error" title={t("states.errorTitle")} description={error} onRetry={() => void refresh()} />
      </Box>
    ) : (
      <InvoiceList
        invoices={sortedInvoices}
        loading={loading}
        sort={sort}
        onSortChange={(key: InvoiceSortKey) => setSort((prev) => nextSort(prev, key))}
        onRowPress={(invoice) => router.push(routes.invoiceDetail(invoice.id))}
        menuItemsFor={menuItemsFor}
        empty={emptyState}
        convertedIds={convertedProformaIds}
        statusFilter={wide ? statusFilterProps : undefined}
        footer={footer}
        attachedToTabs={wide}
      />
    );

  return (
    <ScreenLayout header={header}>
      <VStack space="md" onLayout={onLayout} testID="invoice-list-screen">
        <KpiStrip cells={kpiCells} loading={summaryLoading} layout={wide ? "wide" : "narrow"} />
        <NavAlertBanner count={navFailedCount} onShow={() => selectNavFailed()} />
        <ExchangeRateFixBanner
          count={missingExchangeRateCount}
          active={needsExchangeRate}
          onShowAffected={() => {
            setFilter("all");
            setNeedsExchangeRate(true);
          }}
          onShowAll={() => setNeedsExchangeRate(false)}
        />

        <Box className="flex-row items-center gap-2.5">
          <ListSearchField
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={t("invoices.list.searchPlaceholder")}
            testID="invoice-list-search"
            className="min-w-0 flex-1"
          />
          {wide ? (
            <>
              <Box className="w-[170px] shrink-0">
                <Select
                  value={month ?? ""}
                  onChange={(value) => setMonth(value === "" ? undefined : value)}
                  options={periodOptions}
                  accessibilityLabel={t("lists.filter.period")}
                  testID="invoice-list-period"
                  className="h-10"
                />
              </Box>
              <Button
                variant="secondary"
                testID="invoice-list-export"
                onPress={() => void handleExportCsv()}
                disabled={exporting}
              >
                {exporting ? <ButtonSpinner /> : null}
                <ButtonText>{t("invoices.list.exportCsv")}</ButtonText>
              </Button>
            </>
          ) : null}
        </Box>

        {wide ? null : (
          <Button
            variant="secondary"
            className="self-start"
            testID="invoice-list-filter-button"
            accessibilityLabel={t("lists.filter.title")}
            onPress={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={18} color={icons.foreground} />
            <ButtonText>{t("lists.filter.title")}</ButtonText>
            {filterCount > 0 ? (
              <Box
                testID="invoice-list-filter-count"
                className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1"
              >
                <Text numeric className="text-[11px] font-bold text-white">
                  {filterCount}
                </Text>
              </Box>
            ) : null}
          </Button>
        )}

        <Box>
          {wide ? (
            <StatusTabs
              tabs={tabs}
              value={tabValue}
              accessibilityLabel={t("invoices.list.columnStatus")}
              onChange={(key) => (key === "navFailed" ? selectNavFailed() : selectStatus(key as InvoiceStatus | "all"))}
            />
          ) : null}
          {listArea}
        </Box>
        {loadMoreFooter}
      </VStack>

      <InvoiceFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filter={filter}
        onSelectFilter={selectStatus}
        counts={counts}
        allCount={allCount}
        otherCount={otherCount}
        navFailedCount={navFailedCount}
        navFailedSelected={navFailed}
        onSelectNavFailed={toggleNavFailed}
        periodOptions={periodOptions}
        month={month}
        onMonthChange={setMonth}
        sort={sort}
        onSortChange={setSort}
        onExportCsv={() => void handleExportCsv()}
        exporting={exporting}
        onReset={resetFilters}
        resultCount={total}
      />

      {toastMessage ? (
        <Box className="absolute left-0 right-0 top-4 z-50 items-center px-4" testID="invoice-list-toast">
          <Box className="rounded-control bg-ink px-4 py-2.5 shadow-menu">
            <Text className="text-sm font-medium text-canvas">{toastMessage}</Text>
          </Box>
        </Box>
      ) : null}
    </ScreenLayout>
  );
}
