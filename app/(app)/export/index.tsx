// app/(app)/export/index.tsx
// Adatexport: pick a dataset (invoices / receipts / partners / products),
// narrow it with filters, see how many rows that is, download a CSV.
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { OptionChips } from "@/components/settings/OptionChips";
import { saveDownload } from "@/components/settings/save-download";
import { useClients } from "@/hooks/useClients";
import { useProducts } from "@/hooks/useProducts";
import { useReceipts } from "@/hooks/useReceipts";
import {
  EXPORT_DATASETS,
  clientsToCsv,
  exportFilename,
  filterClients,
  filterInvoices,
  filterProducts,
  filterReceipts,
  invoiceGrossByCurrency,
  invoiceListToCsv,
  productsToCsv,
  receiptsToCsv,
  type ExportDataset,
  type ExportFilters,
} from "@/lib/export/datasets";
import { CSV_COLUMNS, type CsvLabels } from "@/lib/invoices/export-csv";
import { EXPORT_ROW_CAP, fetchAllInvoicesForExport } from "@/lib/invoices/export-fetch";
import { INVOICE_LIST_STATUSES } from "@/lib/invoices/list-query";
import { formatCurrency } from "@/lib/invoices/calculations";
import { STATUS_I18N_KEY } from "@/lib/invoices/status-i18n";
import type { Invoice } from "@/lib/invoices/types";

export default function DataExportScreen() {
  const { t, i18n } = useTranslation();
  const [dataset, setDataset] = React.useState<ExportDataset>("invoices");
  const [filters, setFilters] = React.useState<ExportFilters>({ status: "all" });
  const [message, setMessage] = React.useState<string | null>(null);

  const { clients } = useClients();
  const { products } = useProducts();
  const { receipts } = useReceipts();

  // Invoices come from the paged list API; load them once, when first needed.
  const [invoices, setInvoices] = React.useState<Invoice[] | null>(null);
  const [invoicesTruncated, setInvoicesTruncated] = React.useState(false);
  const [invoicesError, setInvoicesError] = React.useState(false);
  React.useEffect(() => {
    if (dataset !== "invoices" || invoices !== null) return;
    let cancelled = false;
    fetchAllInvoicesForExport({ status: "all" })
      .then(({ invoices: all, truncated }) => {
        if (cancelled) return;
        setInvoices(all);
        setInvoicesTruncated(truncated);
      })
      .catch(() => {
        if (!cancelled) setInvoicesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dataset, invoices]);

  const set = (patch: Partial<ExportFilters>) => setFilters((prev) => ({ ...prev, ...patch }));
  const pickDataset = (next: ExportDataset | undefined) => {
    if (!next) return;
    setDataset(next);
    setMessage(null);
  };

  const rows = React.useMemo(() => {
    switch (dataset) {
      case "invoices":
        return invoices ? filterInvoices(invoices, filters) : [];
      case "receipts":
        return filterReceipts(receipts, filters);
      case "clients":
        return filterClients(clients, filters);
      case "products":
        return filterProducts(products, filters);
    }
  }, [dataset, filters, invoices, receipts, clients, products]);

  const loading = dataset === "invoices" && invoices === null && !invoicesError;
  const hasDateFilter = dataset === "invoices" || dataset === "receipts";

  const grossText =
    dataset === "invoices"
      ? Object.entries(invoiceGrossByCurrency(rows as Invoice[]))
          .map(([currency, amount]) => formatCurrency(amount, currency as Invoice["currency"]))
          .join(" + ")
      : "";

  function handleDownload() {
    if (rows.length === 0) {
      setMessage(t("exportData.empty"));
      return;
    }
    const language = i18n.language;
    let csv = "";
    if (dataset === "invoices") {
      const labels: CsvLabels = {
        header: Object.fromEntries(
          CSV_COLUMNS.map((column) => [column, t(`invoices.list.exportColumns.${column}`)]),
        ) as CsvLabels["header"],
        status: (inv) => t(STATUS_I18N_KEY[inv.status]),
        documentType: (inv) => t(`invoices.documentTypes.${inv.documentType}`),
        paymentMethod: (method) => t(`invoices.paymentMethods.${method}`),
        draftNumber: t("invoices.list.exportDraftNumber"),
      };
      csv = invoiceListToCsv(rows as Invoice[], labels, language);
    } else if (dataset === "receipts") {
      csv = receiptsToCsv(
        rows as typeof receipts,
        {
          header: {
            number: t("exportData.columns.receiptNumber"),
            issuedAt: t("exportData.columns.issuedAt"),
            total: t("exportData.columns.total"),
            currency: t("exportData.columns.currency"),
            paymentMethod: t("exportData.columns.paymentMethod"),
            nav: t("exportData.columns.nav"),
          },
          paymentMethod: (m) => t(`receipts.paymentMethods.${m}`, { defaultValue: m }),
          navSubmitted: t("receipts.navSubmitted"),
          navPending: t("receipts.navPending"),
        },
        language,
      );
    } else if (dataset === "clients") {
      csv = clientsToCsv(rows as typeof clients, {
        header: {
          name: t("exportData.columns.name"),
          taxNumber: t("exportData.columns.taxNumber"),
          email: t("exportData.columns.email"),
          zip: t("exportData.columns.zip"),
          city: t("exportData.columns.city"),
          address: t("exportData.columns.address"),
          country: t("exportData.columns.country"),
        },
      });
    } else {
      csv = productsToCsv(
        rows as typeof products,
        {
          header: {
            name: t("exportData.columns.name"),
            description: t("exportData.columns.description"),
            unitPrice: t("exportData.columns.unitPrice"),
            vatRate: t("exportData.columns.vatRate"),
            unit: t("exportData.columns.unit"),
            currency: t("exportData.columns.currency"),
          },
        },
        language,
      );
    }
    const saved = saveDownload(exportFilename(dataset, filters, new Date()), new Blob([csv], { type: "text/csv;charset=utf-8" }));
    setMessage(saved ? t("exportData.downloaded", { count: rows.length }) : t("invoices.list.exportCsvWebOnly"));
  }

  return (
    <ScreenLayout
      header={<PageHeader title={t("exportData.title")} subtitle={t("exportData.subtitle")} />}
    >
      <VStack space="lg">
        <Card className="p-4">
          <VStack space="sm">
            <Heading size="md">{t("exportData.dataset")}</Heading>
            <OptionChips
              testIDPrefix="export-dataset"
              value={dataset}
              onChange={pickDataset}
              options={EXPORT_DATASETS.map((value) => ({ value, label: t(`exportData.datasets.${value}`) }))}
            />
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="md">
            <Heading size="md">{t("exportData.filters")}</Heading>
            <VStack space="xs">
              <Text size="sm" className="font-medium text-foreground">{t("exportData.search")}</Text>
              <Input>
                <InputField
                  testID="export-search"
                  value={filters.search ?? ""}
                  onChangeText={(search) => set({ search })}
                  placeholder={t("exportData.searchPlaceholder")}
                />
              </Input>
            </VStack>
            {hasDateFilter ? (
              <HStack space="md" className="flex-wrap">
                <VStack className="min-w-[160px] flex-1" space="xs">
                  <Text size="sm" className="font-medium text-foreground">{t("exportData.from")}</Text>
                  <DateInput value={filters.from ?? ""} onChangeText={(from) => set({ from })} testID="export-from" />
                </VStack>
                <VStack className="min-w-[160px] flex-1" space="xs">
                  <Text size="sm" className="font-medium text-foreground">{t("exportData.to")}</Text>
                  <DateInput value={filters.to ?? ""} onChangeText={(to) => set({ to })} testID="export-to" />
                </VStack>
              </HStack>
            ) : null}
            {dataset === "invoices" ? (
              <VStack space="xs">
                <Text size="sm" className="font-medium text-foreground">{t("exportData.status")}</Text>
                <OptionChips
                  testIDPrefix="export-status"
                  value={filters.status ?? "all"}
                  onChange={(status) => set({ status: status ?? "all" })}
                  options={[
                    { value: "all", label: t("invoices.list.filterAll") },
                    ...INVOICE_LIST_STATUSES.map((s) => ({ value: s as string, label: t(STATUS_I18N_KEY[s]) })),
                  ]}
                />
              </VStack>
            ) : null}
          </VStack>
        </Card>

        <Card className="p-4">
          <VStack space="sm">
            <Text className="font-semibold text-foreground" testID="export-count">
              {loading ? t("common.loading") : t("exportData.rows", { count: rows.length })}
            </Text>
            {grossText ? (
              <Text size="sm" className="text-muted-foreground">
                {t("exportData.grossTotal")}: {grossText}
              </Text>
            ) : null}
            {invoicesTruncated && dataset === "invoices" ? (
              <Text size="xs" className="text-muted-foreground">{t("invoices.list.exportCsvTruncated", { cap: EXPORT_ROW_CAP })}</Text>
            ) : null}
            {invoicesError && dataset === "invoices" ? (
              <Text size="sm" className="text-destructive">{t("invoices.list.exportCsvFailed")}</Text>
            ) : null}
            <Button onPress={handleDownload} disabled={loading} testID="export-download">
              <ButtonText>{t("exportData.download")}</ButtonText>
            </Button>
            {message ? (
              <Text size="sm" className="text-muted-foreground" testID="export-message">
                {message}
              </Text>
            ) : null}
          </VStack>
        </Card>
      </VStack>
    </ScreenLayout>
  );
}
