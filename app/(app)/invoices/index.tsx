// app/(app)/invoices/index.tsx
// Invoice list with stats, filters, and preview modal.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal";
import { ListScreen } from "@/components/layout/ListScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";

const FILTERS: Array<InvoiceStatus | "all"> = [
  "all",
  "draft",
  "proforma",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

export default function InvoiceListScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = React.useState<InvoiceStatus | "all">("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const { invoices, loading, stats, total, refresh, remove } = useInvoices({
    status: filter,
    search,
  });
  const [previewInvoice, setPreviewInvoice] = React.useState<Invoice | null>(null);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(handle);
  }, [searchInput]);

  return (
    <>
      <ListScreen
        data={invoices}
        keyExtractor={(item) => item.id}
        loading={loading}
        refreshing={loading}
        onRefresh={refresh}
        emptyTitle={t("invoices.empty")}
        emptyDescription="Create your first NAV-ready invoice or load demo data from Settings."
        emptyAction={
          <VStack space="sm" className="items-center">
            <Button onPress={() => router.push(routes.newInvoice)}>
              <ButtonText>{t("nav.newInvoice")}</ButtonText>
            </Button>
            <Button variant="outline" onPress={() => router.push(routes.settings)}>
              <ButtonText>Load demo data</ButtonText>
            </Button>
          </VStack>
        }
        header={
          <VStack space="md" className="pb-2">
            <PageHeader
              title={t("invoices.title")}
              actions={
                <Button size="sm" onPress={() => router.push(routes.newInvoice)}>
                  <ButtonText>New</ButtonText>
                </Button>
              }
            />
            <HStack space="md" className="flex-wrap">
              <StatCard label="Total" value={stats.count} />
              <StatCard label="This month" value={stats.thisMonthCount} />
              <StatCard
                label="Monthly total"
                value={formatCurrency(stats.monthlyTotal, "EUR")}
              />
            </HStack>
            <Input>
              <InputField
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={t("invoices.searchPlaceholder", {
                  defaultValue: "Keresés partner, számlaszám vagy adószám alapján",
                })}
                className="font-light"
                testID="invoice-list-search"
              />
            </Input>
            {total > invoices.length ? (
              <Text size="xs" className="text-muted-foreground">
                Showing {invoices.length} of {total} invoices (most recent first).
              </Text>
            ) : null}
            <HStack space="xs" className="flex-wrap">
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1.5 ${
                    filter === f
                      ? "border-primary bg-primary"
                      : "border-border bg-secondary"
                  }`}
                >
                  <Text
                    size="xs"
                    className={filter === f ? "text-primary-foreground" : "text-muted-foreground"}
                  >
                    {f === "all" ? "All" : f}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </VStack>
        }
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            onDelete={remove}
            onPress={(inv) => router.push(routes.invoiceDetail(inv.id))}
            onPreview={(inv) => setPreviewInvoice(inv)}
          />
        )}
      />
      <InvoicePreviewModal
        invoice={previewInvoice}
        open={previewInvoice !== null}
        onClose={() => setPreviewInvoice(null)}
      />
    </>
  );
}
