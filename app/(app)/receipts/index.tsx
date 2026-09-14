// app/(app)/receipts/index.tsx
// Receipt list. Desktop table + search + row menu + a consistent
// "Új nyugta" primary button (C3, R6).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Eye } from "lucide-react-native";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DataTable, type Column } from "@/components/layout/DataTable";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { useReceipts } from "@/hooks/useReceipts";
import { formatCurrency } from "@/lib/invoices/calculations";
import { formatDateOnly, formatDateWithTime } from "@/lib/dates/format";
import { routes } from "@/lib/navigation";
import { useIsDesktop } from "@/lib/useIsDesktop";
import type { ReceiptRecord } from "@/lib/receipts/service";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const { receipts, loading, error } = useReceipts();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) => r.receiptNumber.toLowerCase().includes(q) || (r.clientName ?? "").toLowerCase().includes(q)
    );
  }, [receipts, search]);

  function menuItemsFor(receipt: ReceiptRecord): OverflowMenuItem[] {
    return [
      { label: t("receipts.viewDetail"), icon: Eye, onPress: () => router.push(routes.receiptDetail(receipt.id)) },
    ];
  }

  const columns: Column<ReceiptRecord>[] = [
    { key: "receiptNumber", header: t("receipts.columnNumber"), width: 160, render: (r) => r.receiptNumber },
    { key: "clientName", header: t("receipts.columnClient"), render: (r) => r.clientName ?? "—" },
    { key: "issuedAt", header: t("receipts.columnIssued"), width: 120, render: (r) => formatDateOnly(r.issuedAt) },
    {
      key: "totalAmount",
      header: t("receipts.columnGross"),
      width: 140,
      numeric: true,
      render: (r) => formatCurrency(r.totalAmount, r.currency),
    },
  ];

  const emptyState = (
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
  );

  return (
    <ScreenLayout
      header={
        <VStack space="md" className="pb-4">
          <PageHeader
            title={t("nav.receipts")}
            subtitle={t("receipts.subtitle")}
            primaryAction={
              <Button size="sm" onPress={() => router.push(routes.newReceipt)}>
                <ButtonText>{t("receipts.new")}</ButtonText>
              </Button>
            }
          />
          {error ? (
            <Card className="border-destructive/30 bg-destructive/5 p-3">
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            </Card>
          ) : null}
          <Input>
            <InputField
              value={search}
              onChangeText={setSearch}
              placeholder={t("receipts.search")}
              testID="receipts-search"
            />
          </Input>
        </VStack>
      }
    >
      {isDesktop ? (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(r) => r.id}
          onRowPress={(r) => router.push(routes.receiptDetail(r.id))}
          rowActions={(r) => <OverflowMenu items={menuItemsFor(r)} label={t("receipts.rowMenuLabel")} />}
          loading={loading}
          empty={emptyState}
        />
      ) : loading && filtered.length === 0 ? (
        <StateView kind="loading" title="" />
      ) : filtered.length === 0 ? (
        emptyState
      ) : (
        <VStack space="sm">
          {filtered.map((item) => (
            <Pressable key={item.id} onPress={() => router.push(routes.receiptDetail(item.id))}>
              <Card className="p-4 active:opacity-80">
                <HStack className="items-center justify-between">
                  <VStack space="xs">
                    <Text className="font-semibold text-foreground">{item.receiptNumber}</Text>
                    {item.clientName ? (
                      <Text size="sm" className="text-muted-foreground">
                        {item.clientName}
                      </Text>
                    ) : null}
                    <Text size="xs" className="text-muted-foreground">
                      {formatDateWithTime(item.issuedAt)}
                    </Text>
                  </VStack>
                  <VStack space="xs" className="items-end">
                    <Text className="font-semibold text-foreground">
                      {formatCurrency(item.totalAmount, item.currency)}
                    </Text>
                    {item.navSubmitted ? (
                      <Badge variant="outline" className="rounded-full border-primary/40 px-2 py-0.5">
                        <BadgeText className="text-[10px] text-primary">NAV ✓</BadgeText>
                      </Badge>
                    ) : null}
                  </VStack>
                </HStack>
              </Card>
            </Pressable>
          ))}
        </VStack>
      )}
    </ScreenLayout>
  );
}
