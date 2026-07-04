// app/(app)/products/index.tsx
// Product catalog list screen (accountants only).
import * as React from "react";
import { router } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListScreen } from "@/components/layout/ListScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { useProducts } from "@/hooks/useProducts";

export default function ProductsScreen() {
  const { products, loading, refresh, create } = useProducts();
  const [name, setName] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        unitPrice: Number(unitPrice) || 0,
      });
      setName("");
      setUnitPrice("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ListScreen
      data={products}
      keyExtractor={(item) => item.id}
      loading={loading}
      refreshing={loading}
      onRefresh={refresh}
      emptyTitle="No products yet"
      emptyDescription="Build a product catalog for faster invoicing."
      header={
        <VStack space="md" className="pb-2">
          <PageHeader title="Products" subtitle="Services and goods for invoice line items." />
          <Card className="p-4">
            <VStack space="sm">
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Quick add</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField value={name} onChangeText={setName} placeholder="Consulting hour" />
                </Input>
              </FormControl>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>Unit price</FormControlLabelText>
                </FormControlLabel>
                <Input>
                  <InputField
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="decimal-pad"
                    placeholder="100"
                  />
                </Input>
              </FormControl>
              <Button onPress={handleAdd} disabled={saving}>
                <ButtonText>Add product</ButtonText>
              </Button>
            </VStack>
          </Card>
        </VStack>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(routes.productEdit(item.id))}>
          <Card className="p-4 active:opacity-80">
            <VStack space="xs">
              <Text className="font-semibold text-foreground">{item.name}</Text>
              <Text size="sm" className="text-muted-foreground">
                {formatCurrency(item.unitPrice, item.currency as "EUR" | "HUF")} · VAT {item.vatRate}%
              </Text>
            </VStack>
          </Card>
        </Pressable>
      )}
    />
  );
}
