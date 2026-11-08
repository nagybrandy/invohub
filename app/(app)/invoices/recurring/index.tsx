// app/(app)/invoices/recurring/index.tsx
// Ismétlődő számlák: the recurring templates under Számlák, in the same list
// pattern as Termékek/Számlák (Dóri 2026-11): header, search, one card that is
// a table above 820px and cards below. Rows: partner, amount, schedule, next
// draft date, status; menu: pause/resume, edit schedule, delete.
// Templates only ever produce DRAFTS — see lib/recurring/service.ts.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pause, Pencil, Play, Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListCardRow } from "@/components/lists/ListCardRow";
import { ListFooterBar } from "@/components/lists/ListFooterBar";
import { ListSearchField } from "@/components/lists/ListSearchField";
import { ListTable, type ListColumn } from "@/components/lists/ListTable";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { RecurringStatusPill } from "@/components/recurring/RecurringStatusPill";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";
import { getBreadcrumb } from "@/lib/app-navigation";
import { formatDateOnly } from "@/lib/dates/format";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { templateSummary } from "@/lib/recurring/form";
import type { RecurringTemplate } from "@/lib/recurring/service";
import { confirmAsync } from "@/lib/ui/confirm";

export default function RecurringInvoicesScreen() {
  const { t } = useTranslation();
  const { templates, loading, error, refresh, update, remove } = useRecurringInvoices();
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((tpl) => {
      const s = templateSummary(tpl);
      return s.title.toLowerCase().includes(q) || s.partner.toLowerCase().includes(q);
    });
  }, [templates, search]);

  async function handleDelete(tpl: RecurringTemplate) {
    const confirmed = await confirmAsync({
      title: t("recurring.deleteConfirmTitle"),
      message: t("recurring.deleteConfirmMessage", { name: templateSummary(tpl).title }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (confirmed) await remove(tpl.id);
  }

  function menuItemsFor(tpl: RecurringTemplate): OverflowMenuItem[] {
    const items: OverflowMenuItem[] = [];
    if (tpl.status === "active") {
      items.push({ label: t("recurring.actions.pause"), icon: Pause, onPress: () => void update(tpl.id, { status: "paused" }) });
    } else if (tpl.status === "paused") {
      items.push({ label: t("recurring.actions.resume"), icon: Play, onPress: () => void update(tpl.id, { status: "active" }) });
    }
    items.push(
      { label: t("recurring.actions.edit"), icon: Pencil, onPress: () => router.push(routes.recurringInvoiceEdit(tpl.id)) },
      { label: t("recurring.actions.delete"), icon: Trash2, destructive: true, onPress: () => void handleDelete(tpl) }
    );
    return items;
  }

  const scheduleLabel = (tpl: RecurringTemplate) => t(`recurring.frequency.${tpl.frequency}`);
  const nextRunLabel = (tpl: RecurringTemplate) =>
    tpl.nextRunDate && tpl.status !== "completed" ? formatDateOnly(tpl.nextRunDate) : t("recurring.noNextRun");
  const amountLabel = (tpl: RecurringTemplate) => formatCurrency(templateSummary(tpl).gross, tpl.currency);

  const columns: ListColumn<RecurringTemplate>[] = [
    {
      key: "partner",
      header: t("recurring.columnPartner"),
      render: (tpl) => (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {templateSummary(tpl).title}
        </Text>
      ),
    },
    {
      key: "amount",
      header: t("recurring.columnAmount"),
      width: 160,
      align: "right",
      render: (tpl) => (
        <Text numeric className="whitespace-nowrap text-sm font-bold text-ink">
          {amountLabel(tpl)}
        </Text>
      ),
    },
    {
      key: "schedule",
      header: t("recurring.columnSchedule"),
      width: 150,
      render: (tpl) => <Text className="text-sm text-ink">{scheduleLabel(tpl)}</Text>,
    },
    {
      key: "next",
      header: t("recurring.columnNextRun"),
      width: 170,
      render: (tpl) => (
        <Text numeric className="whitespace-nowrap text-sm text-ink">
          {nextRunLabel(tpl)}
        </Text>
      ),
    },
    {
      key: "status",
      header: t("recurring.columnStatus"),
      width: 140,
      render: (tpl) => <RecurringStatusPill status={tpl.status} />,
    },
  ];

  const menu = (tpl: RecurringTemplate) => (
    <OverflowMenu items={menuItemsFor(tpl)} label={t("recurring.rowMenuLabel")} />
  );

  // Empty state is rendered through ListTable's `empty` slot, never as a
  // FlatList child (AGENTS.md §3).
  const emptyState = (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      {search.trim() ? (
        <StateView kind="empty" title={t("lists.noResults")} description={t("lists.noResultsHint")} />
      ) : (
        <StateView
          kind="empty"
          title={t("recurring.empty")}
          description={t("recurring.emptyDesc")}
          action={
            <Button testID="recurring-empty-action" onPress={() => router.push(routes.invoices)}>
              <ButtonText>{t("recurring.emptyAction")}</ButtonText>
            </Button>
          }
        />
      )}
    </Box>
  );

  const footer =
    !loading && filtered.length > 0 ? (
      <ListFooterBar testID="recurring-list-stats" countLabel={t("recurring.footer", { count: filtered.length })} />
    ) : null;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("recurring.title")}
          subtitle={t("recurring.subtitle")}
          breadcrumb={getBreadcrumb("/invoices/recurring", t)}
        />
      }
    >
      <VStack space="md">
        <ListSearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("recurring.search")}
          testID="recurring-search"
        />
        {error && templates.length === 0 && !loading ? (
          <Box className="overflow-hidden rounded-card bg-surface shadow-card">
            <StateView kind="error" title={t("states.errorTitle")} description={error} onRetry={() => void refresh()} />
          </Box>
        ) : (
          <ListTable
            testID="recurring-list-table"
            columns={columns}
            rows={filtered}
            keyExtractor={(tpl) => tpl.id}
            onRowPress={(tpl) => router.push(routes.recurringInvoiceEdit(tpl.id))}
            rowMenu={menu}
            loading={loading}
            empty={emptyState}
            footer={footer}
            renderCard={(tpl) => (
              <ListCardRow
                title={templateSummary(tpl).title}
                amount={amountLabel(tpl)}
                meta={`${scheduleLabel(tpl)} · ${t("recurring.nextRun", { date: nextRunLabel(tpl) })}`}
                badges={<RecurringStatusPill status={tpl.status} />}
                menu={menu(tpl)}
                onPress={() => router.push(routes.recurringInvoiceEdit(tpl.id))}
                testID="recurring-card"
              />
            )}
          />
        )}
        <Text className="text-[13px] text-muted-ink">{t("recurring.draftOnlyNote")}</Text>
      </VStack>
    </ScreenLayout>
  );
}
