// app/(app)/clients/index.tsx
// Client list screen (accountants only — hidden from nav for entrepreneurs).
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListScreen } from "@/components/layout/ListScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { routes } from "@/lib/navigation";
import { useClients } from "@/hooks/useClients";

export default function ClientsScreen() {
  const { t } = useTranslation();
  const { clients, loading, refresh } = useClients();

  return (
    <ListScreen
      data={clients}
      keyExtractor={(item) => item.id}
      loading={loading}
      refreshing={loading}
      onRefresh={refresh}
      emptyTitle={t("clients.empty")}
      emptyDescription={t("clients.emptyDesc")}
      emptyAction={
        <Button onPress={() => router.push(routes.newClient)}>
          <ButtonText>{t("clients.add")}</ButtonText>
        </Button>
      }
      header={
        <PageHeader
          title={t("nav.clients")}
          subtitle={t("clients.subtitle")}
          actions={
            <Button size="sm" onPress={() => router.push(routes.newClient)}>
              <ButtonText>{t("clients.addShort")}</ButtonText>
            </Button>
          }
        />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(routes.clientEdit(item.id))}>
          <Card className="p-4 active:opacity-80">
            <VStack space="xs">
              <Text className="font-semibold text-foreground">{item.name}</Text>
              {item.email ? (
                <Text size="sm" className="text-muted-foreground">
                  {item.email}
                </Text>
              ) : null}
              {item.taxNumber ? (
                <Text size="sm" className="text-muted-foreground">
                  {item.taxNumber}
                </Text>
              ) : null}
            </VStack>
          </Card>
        </Pressable>
      )}
    />
  );
}
