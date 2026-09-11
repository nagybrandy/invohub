// app/(app)/invoices/index.tsx
// Invoice list with stats, filters, and preview modal.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoicePreviewModal } from "@/components/invoices/InvoicePreviewModal";
import { ListScreen } from "@/components/layout/ListScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { formatCurrency } from "@/lib/invoices/calculations";
import {
  filterInvoicesByStatus,
  invoiceStatusFilterI18nKey,
  INVOICE_STATUS_FILTERS,
  type InvoiceStatusFilter,
} from "@/lib/invoices/filter-invoices";
import type { Invoice } from "@/lib/invoices/types";
import { routes } from "@/lib/navigation";
import { useInvoices } from "@/hooks/useInvoices";

export default function InvoiceListScreen() {
  const { t } = useTranslation();
  const { invoices, loading, stats, total, refresh, remove } = useInvoices();
  const [previewInvoice, setPreviewInvoice] = React.useState<Invoice | null>(
    null
  );
  const [filter, setFilter] = React.useState<InvoiceStatusFilter>("all");

  const filtered = filterInvoicesByStatus(invoices, filter);

  return (
    <>
      <ListScreen
        data={filtered}
        keyExtractor={(item) => item.id}
        loading={loading}
        refreshing={loading}
        onRefresh={refresh}
        emptyTitle={t("invoices.empty")}
        emptyDescription={t("invoices.emptyHint")}
        emptyAction={
          <VStack space="sm" className="items-center">
            <Button onPress={() => router.push(routes.newInvoice)}>
              <ButtonText>{t("nav.newInvoice")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              onPress={() => router.push(routes.settings)}
            >
              <ButtonText>{t("invoices.loadDemo")}</ButtonText>
            </Button>
          </VStack>
        }
        header={
          <VStack space="md" className="pb-2">
            <PageHeader
              title={t("invoices.title")}
              actions={
                <Button size="sm" onPress={() => router.push(routes.newInvoice)}>
                  <ButtonText>{t("common.new")}</ButtonText>
                </Button>
              }
            />
            <HStack space="md" className="flex-wrap">
              <StatCard label={t("invoices.stats.total")} value={stats.count} />
              <StatCard
                label={t("invoices.stats.thisMonth")}
                value={stats.thisMonthCount}
              />
              <StatCard
                label={t("invoices.stats.monthlyTotal")}
                value={formatCurrency(stats.monthlyTotal, "EUR")}
              />
            </HStack>
            {total > invoices.length ? (
              <Text size="xs" className="text-muted-foreground">
                {t("invoices.showingPartial", {
                  shown: invoices.length,
                  total,
                })}
              </Text>
            ) : null}
            <HStack space="xs" className="flex-wrap">
              {INVOICE_STATUS_FILTERS.map((f) => (
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
                    className={
                      filter === f
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {t(invoiceStatusFilterI18nKey(f))}
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
