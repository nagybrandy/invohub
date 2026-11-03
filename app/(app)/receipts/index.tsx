// app/(app)/receipts/index.tsx
// Nyugták (redesign 2026-11, SPEC §6): the same list pattern as Számlák
// without KPI strip, alert or status tabs — header with "Új nyugta", search,
// one card that is a table (Sorszám, Vevő, Kelt, Összeg, NAV) above 820px and
// cards below, a row menu with the one existing action, a totals footer.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { NavStateIcon } from "@/components/invoices/NavStateIcon";
import { ListCardRow } from "@/components/lists/ListCardRow";
import { ListFooterBar } from "@/components/lists/ListFooterBar";
import { ListSearchField } from "@/components/lists/ListSearchField";
import { ListTable, type ListColumn } from "@/components/lists/ListTable";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { useReceipts } from "@/hooks/useReceipts";
import { formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly } from "@/lib/dates/format";
import { routes } from "@/lib/navigation";
import { summarizeReceipts } from "@/lib/lists/footer-stats";
import type { ReceiptRecord } from "@/lib/receipts/service";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const { receipts, loading, error, refresh } = useReceipts();
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) => r.receiptNumber.toLowerCase().includes(q) || (r.clientName ?? "").toLowerCase().includes(q),
    );
  }, [receipts, search]);

  const summary = React.useMemo(() => summarizeReceipts(filtered), [filtered]);

  function menuItemsFor(receipt: ReceiptRecord): OverflowMenuItem[] {
    return [
      { label: t("receipts.viewDetail"), icon: ExternalLink, onPress: () => router.push(routes.receiptDetail(receipt.id)) },
    ];
  }

  const navStatus = (r: ReceiptRecord) => (r.navSubmitted ? ("done" as const) : ("none" as const));

  const columns: ListColumn<ReceiptRecord>[] = [
    {
      key: "receiptNumber",
      header: t("receipts.columnNumber"),
      width: 170,
      render: (r) => (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {r.receiptNumber}
        </Text>
      ),
    },
    {
      key: "clientName",
      header: t("receipts.columnClient"),
      render: (r) => (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {r.clientName ?? "—"}
        </Text>
      ),
    },
    {
      key: "issuedAt",
      header: t("receipts.columnIssued"),
      width: 130,
      render: (r) => <Text className="text-sm text-ink">{formatDateOnly(r.issuedAt)}</Text>,
    },
    {
      key: "totalAmount",
      header: t("receipts.columnGross"),
      width: 150,
      align: "right",
      render: (r) => (
        <Text numeric className="whitespace-nowrap text-sm font-bold text-ink">
          {formatCurrency(r.totalAmount, r.currency)}
        </Text>
      ),
    },
    {
      key: "nav",
      header: "NAV",
      width: 56,
      align: "center",
      render: (r) => <NavStateIcon status={navStatus(r)} testID="receipt-row-nav" />,
    },
  ];

  const menu = (r: ReceiptRecord) => <OverflowMenu items={menuItemsFor(r)} label={t("receipts.rowMenuLabel")} />;

  const emptyState = (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      {search.trim() ? (
        <StateView kind="empty" title={t("lists.noResults")} description={t("lists.noResultsHint")} />
      ) : (
        <StateView
          kind="empty"
          title={t("receipts.empty")}
          description={t("receipts.emptyHint")}
          action={
            <Button onPress={() => router.push(routes.newReceipt)}>
              <ButtonText>{t("receipts.new")}</ButtonText>
            </Button>
          }
        />
      )}
    </Box>
  );

  const totals = summary.byCurrency.map((row) => formatCurrency(row.gross, row.currency as ReceiptRecord["currency"])).join(" + ");
  const footer =
    !loading && filtered.length > 0 ? (
      <ListFooterBar
        testID="receipt-list-stats"
        countLabel={t("lists.footer.receipts", { count: filtered.length })}
        totalsLabel={t("lists.footer.grossTotal")}
        totals={totals}
      />
    ) : null;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("nav.receipts")}
          subtitle={t("receipts.subtitle")}
          actions={
            <Button testID="receipts-new" onPress={() => router.push(routes.newReceipt)}>
              <ButtonText>{t("receipts.new")}</ButtonText>
            </Button>
          }
        />
      }
    >
      <VStack space="md">
        <ListSearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("receipts.search")}
          testID="receipts-search"
        />
        {error && receipts.length === 0 && !loading ? (
          <Box className="overflow-hidden rounded-card bg-surface shadow-card">
            <StateView kind="error" title={t("states.errorTitle")} description={error} onRetry={() => void refresh()} />
          </Box>
        ) : (
          <ListTable
            testID="receipt-list-table"
            columns={columns}
            rows={filtered}
            keyExtractor={(r) => r.id}
            onRowPress={(r) => router.push(routes.receiptDetail(r.id))}
            rowMenu={menu}
            loading={loading}
            empty={emptyState}
            footer={footer}
            renderCard={(r) => (
              <ListCardRow
                title={r.clientName ?? r.receiptNumber}
                amount={formatCurrency(r.totalAmount, r.currency)}
                meta={`${r.clientName ? `${r.receiptNumber} · ` : ""}${formatDateOnly(r.issuedAt)}`}
                badges={<NavStateIcon status={navStatus(r)} testID="receipt-card-nav" />}
                menu={menu(r)}
                onPress={() => router.push(routes.receiptDetail(r.id))}
                testID="receipt-card"
              />
            )}
          />
        )}
      </VStack>
    </ScreenLayout>
  );
}
