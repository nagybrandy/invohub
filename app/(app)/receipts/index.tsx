// app/(app)/receipts/index.tsx
// Receipt list with link to create new receipt.
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListScreen } from "@/components/layout/ListScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { useReceipts } from "@/hooks/useReceipts";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const { receipts, loading, error, refresh } = useReceipts();

  return (
    <ListScreen
      data={receipts}
      keyExtractor={(item) => item.id}
      loading={loading}
      refreshing={loading}
      onRefresh={refresh}
      emptyTitle={t("receipts.empty")}
      emptyDescription={t("receipts.emptyHint")}
      emptyAction={
        <Button onPress={() => router.push(routes.newReceipt)}>
          <ButtonText>{t("receipts.new")}</ButtonText>
        </Button>
      }
      header={
        <VStack space="sm">
          <PageHeader
            title={t("nav.receipts")}
            subtitle={t("receipts.subtitle")}
            actions={
              <Button size="sm" onPress={() => router.push(routes.newReceipt)}>
                <ButtonText>{t("receipts.newShort")}</ButtonText>
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
        </VStack>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(routes.receiptDetail(item.id))}>
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
                  {new Date(item.issuedAt).toLocaleString()}
                </Text>
              </VStack>
              <Text className="font-semibold text-foreground">
                {formatCurrency(item.totalAmount, item.currency)}
              </Text>
            </HStack>
          </Card>
        </Pressable>
      )}
    />
  );
}
