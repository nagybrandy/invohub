// components/dashboard/RecentInvoices.tsx
// "Legutóbbi számlák" (tokens.md §6.16): the title and the "Összes" link sit
// OUTSIDE the box; inside is the same list as Számlák (table from 820px of
// container width, cards below).
// TODO(lists track): switch to the shared components/lists list once it has
// landed; until then this reuses InvoiceListTable / InvoiceCard.
import { useTranslation } from "react-i18next";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceListTable } from "@/components/invoices/InvoiceListTable";
import { LAYOUT } from "@/lib/theme/layout";
import type { Invoice } from "@/lib/invoices/types";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";
import { type } from "@/lib/ui/type";

export type RecentInvoicesProps = {
  invoices: Invoice[];
  loading?: boolean;
  onOpenInvoice: (id: string) => void;
  onOpenAll: () => void;
  onDelete: (id: string) => void;
};

export function RecentInvoices({ invoices, loading = false, onOpenInvoice, onOpenAll, onDelete }: RecentInvoicesProps) {
  const { t } = useTranslation();
  const { width, measured, onLayout } = useMeasuredWidth();
  // Cards until measured: a phone never flashes the wide table.
  const asTable = measured && width > LAYOUT.listCardsMax;

  const empty = <Text className="p-4 text-muted-ink">{t("dashboard.table.noInvoices")}</Text>;

  return (
    <VStack space="sm" testID="dashboard-recent">
      <HStack className="items-center justify-between gap-3">
        <Heading className={type.sectionTitle}>{t("dashboard.recentInvoices")}</Heading>
        <Pressable
          testID="dashboard-recent-all"
          accessibilityRole="link"
          accessibilityLabel={t("home.recent.allA11y")}
          onPress={onOpenAll}
          className="min-h-10 justify-center px-1 data-[hover=true]:opacity-80"
        >
          <Text className="text-sm font-semibold text-primary">{t("home.recent.all")}</Text>
        </Pressable>
      </HStack>

      <Box onLayout={onLayout} className="w-full">
        {asTable ? (
          <InvoiceListTable
            invoices={invoices}
            loading={loading}
            onRowPress={(invoice) => onOpenInvoice(invoice.id)}
            menuItemsFor={() => []}
            empty={empty}
          />
        ) : loading && invoices.length === 0 ? (
          <Box testID="dashboard-recent-loading" className="h-24 animate-pulse rounded-card bg-surface" />
        ) : invoices.length === 0 ? (
          <Box className="rounded-card bg-surface">{empty}</Box>
        ) : (
          <VStack space="sm">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onDelete={onDelete}
                onPress={(inv) => onOpenInvoice(inv.id)}
              />
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
