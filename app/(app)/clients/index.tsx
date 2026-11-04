// app/(app)/clients/index.tsx
// Partnerek (redesign 2026-11, SPEC §6): the same list pattern as Számlák
// without KPI strip, alert or tabs — header with "Új partner", search, one
// card that is a table (Név sortable, Adószám, E-mail, Város) above 820px and
// cards below. Row menu: Szerkesztés, Új számla neki, Számlái, Törlés (with
// the existing confirm).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FilePlus2, FileText, Pencil, Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListCardRow } from "@/components/lists/ListCardRow";
import { ListFooterBar } from "@/components/lists/ListFooterBar";
import { ListSearchField } from "@/components/lists/ListSearchField";
import { ListTable, type ListColumn, type ListSort } from "@/components/lists/ListTable";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { routes } from "@/lib/navigation";
import { useClients } from "@/hooks/useClients";
import { confirmAsync } from "@/lib/ui/confirm";
import type { Client } from "@/lib/clients/service";

function Cell({ value }: { value?: string }) {
  return (
    <Text numberOfLines={1} className={`whitespace-nowrap text-sm ${value ? "text-ink" : "text-faint"}`}>
      {value || "—"}
    </Text>
  );
}

export default function ClientsScreen() {
  const { t } = useTranslation();
  const { clients, loading, error, remove } = useClients();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<ListSort>({ key: "name", direction: "asc" });

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? clients.filter((c) => c.name.toLowerCase().includes(q) || (c.taxNumber ?? "").toLowerCase().includes(q))
      : clients;
    return [...list].sort((a, b) => {
      const diff = a.name.localeCompare(b.name, "hu");
      return sort.direction === "asc" ? diff : -diff;
    });
  }, [clients, search, sort]);

  async function handleDelete(client: Client) {
    const confirmed = await confirmAsync({
      title: t("partners.deleteConfirmTitle"),
      message: t("partners.deleteConfirmMessage", { name: client.name }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (confirmed) await remove(client.id);
  }

  function menuItemsFor(client: Client): OverflowMenuItem[] {
    return [
      { label: t("partners.edit"), icon: Pencil, onPress: () => router.push(routes.clientEdit(client.id)) },
      { label: t("partners.invoiceFor"), icon: FilePlus2, onPress: () => router.push(routes.newInvoiceForClient(client.id)) },
      { label: t("partners.invoicesOf"), icon: FileText, onPress: () => router.push(routes.invoicesForClient(client.name)) },
      { label: t("common.delete"), icon: Trash2, destructive: true, onPress: () => void handleDelete(client) },
    ];
  }

  const columns: ListColumn<Client>[] = [
    {
      key: "name",
      header: t("partners.columnName"),
      sortable: true,
      render: (c) => <Cell value={c.name} />,
    },
    { key: "taxNumber", header: t("partners.columnTaxNumber"), width: 170, render: (c) => <Cell value={c.taxNumber} /> },
    { key: "email", header: t("partners.columnEmail"), width: 240, render: (c) => <Cell value={c.email} /> },
    { key: "city", header: t("partners.columnCity"), width: 160, render: (c) => <Cell value={c.city} /> },
  ];

  const menu = (c: Client) => <OverflowMenu items={menuItemsFor(c)} label={t("partners.rowMenuLabel")} />;

  const emptyState = (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      {search.trim() ? (
        <StateView kind="empty" title={t("lists.noResults")} description={t("lists.noResultsHint")} />
      ) : (
        <StateView
          kind="empty"
          title={t("clients.empty")}
          description={t("clients.emptyDesc")}
          action={
            <Button onPress={() => router.push(routes.newClient)}>
              <ButtonText>{t("partners.add")}</ButtonText>
            </Button>
          }
        />
      )}
    </Box>
  );

  const footer =
    !loading && filtered.length > 0 ? (
      <ListFooterBar testID="partner-list-stats" countLabel={t("lists.footer.partners", { count: filtered.length })} />
    ) : null;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("partners.title")}
          subtitle={t("clients.subtitle")}
          actions={
            <Button testID="partners-new" onPress={() => router.push(routes.newClient)}>
              <ButtonText>{t("partners.add")}</ButtonText>
            </Button>
          }
        />
      }
    >
      <VStack space="md">
        <ListSearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("partners.search")}
          testID="partners-search"
        />
        {error && clients.length === 0 && !loading ? (
          <Box className="overflow-hidden rounded-card bg-surface shadow-card">
            <StateView kind="error" title={t("states.errorTitle")} description={error} />
          </Box>
        ) : (
          <ListTable
            testID="partner-list-table"
            columns={columns}
            rows={filtered}
            keyExtractor={(c) => c.id}
            onRowPress={(c) => router.push(routes.clientEdit(c.id))}
            rowMenu={menu}
            sort={sort}
            onSortChange={() => setSort((prev) => ({ key: "name", direction: prev.direction === "asc" ? "desc" : "asc" }))}
            loading={loading}
            empty={emptyState}
            footer={footer}
            renderCard={(c) => (
              <ListCardRow
                title={c.name}
                meta={[c.taxNumber, c.email].filter(Boolean).join(" · ") || undefined}
                menu={menu(c)}
                onPress={() => router.push(routes.clientEdit(c.id))}
                testID="partner-card"
              />
            )}
          />
        )}
      </VStack>
    </ScreenLayout>
  );
}
