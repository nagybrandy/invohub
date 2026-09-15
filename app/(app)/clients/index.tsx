// app/(app)/clients/index.tsx
// Partner list (accountants only — hidden from nav for entrepreneurs).
// Desktop table + search + row menu, "Partnerek" terminology everywhere
// (C1), and a "Számla ennek a partnernek" row action (C4).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FileText, Pencil, Trash2 } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DataTable, type Column } from "@/components/layout/DataTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import type { OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { OverflowMenu } from "@/components/layout/OverflowMenu";
import { routes } from "@/lib/navigation";
import { useClients } from "@/hooks/useClients";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { confirmAsync } from "@/lib/ui/confirm";
import type { Client } from "@/lib/clients/service";

export default function ClientsScreen() {
  const { t } = useTranslation();
  const { clients, loading, refresh, remove } = useClients();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.taxNumber ?? "").toLowerCase().includes(q)
    );
  }, [clients, search]);

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
      {
        label: t("partners.invoiceFor"),
        icon: FileText,
        onPress: () => router.push(routes.newInvoiceForClient(client.id)),
      },
      { label: t("partners.edit"), icon: Pencil, onPress: () => router.push(routes.clientEdit(client.id)) },
      {
        label: t("common.delete"),
        icon: Trash2,
        destructive: true,
        onPress: () => void handleDelete(client),
      },
    ];
  }

  const columns: Column<Client>[] = [
    { key: "name", header: t("partners.columnName"), render: (c) => c.name },
    { key: "taxNumber", header: t("partners.columnTaxNumber"), width: 160, render: (c) => c.taxNumber ?? "—" },
    { key: "email", header: t("partners.columnEmail"), width: 200, render: (c) => c.email ?? "—" },
    { key: "city", header: t("partners.columnCity"), width: 140, render: (c) => c.city ?? "—" },
  ];

  const emptyState = (
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
  );

  return (
    <ScreenLayout
      header={
        <VStack space="md" className="pb-4">
          <PageHeader
            title={t("partners.title")}
            subtitle={t("clients.subtitle")}
            primaryAction={
              <Button size="sm" onPress={() => router.push(routes.newClient)}>
                <ButtonText>{t("partners.add")}</ButtonText>
              </Button>
            }
          />
          <Input>
            <InputField
              value={search}
              onChangeText={setSearch}
              placeholder={t("partners.search")}
              testID="partners-search"
            />
          </Input>
        </VStack>
      }
    >
      {isDesktop ? (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(c) => c.id}
          onRowPress={(c) => router.push(routes.clientEdit(c.id))}
          rowActions={(c) => <OverflowMenu items={menuItemsFor(c)} label={t("partners.rowMenuLabel")} />}
          loading={loading}
          empty={emptyState}
        />
      ) : loading && filtered.length === 0 ? (
        <StateView kind="loading" title="" />
      ) : filtered.length === 0 ? (
        emptyState
      ) : (
        <VStack space="sm">
          {filtered.map((client) => (
            <Pressable key={client.id} onPress={() => router.push(routes.clientEdit(client.id))}>
              <Card className="p-4 active:opacity-80">
                <HStack className="items-center justify-between">
                  <VStack space="xs" className="flex-1">
                    <Text className="font-semibold text-foreground">{client.name}</Text>
                    {client.email ? (
                      <Text size="sm" className="text-muted-foreground">
                        {client.email}
                      </Text>
                    ) : null}
                    {client.taxNumber ? (
                      <Text size="sm" className="text-muted-foreground">
                        {client.taxNumber}
                      </Text>
                    ) : null}
                  </VStack>
                  <OverflowMenu items={menuItemsFor(client)} label={t("partners.rowMenuLabel")} />
                </HStack>
              </Card>
            </Pressable>
          ))}
        </VStack>
      )}
    </ScreenLayout>
  );
}
