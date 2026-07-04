// app/(app)/products/[id]/edit.tsx
// Edit an existing product.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { FormScreen } from "@/components/layout/FormScreen";
import { PageHeader } from "@/components/layout/PageHeader";
import { routes } from "@/lib/navigation";
import { useProducts } from "@/hooks/useProducts";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { update, getById } = useProducts();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [vatRate, setVatRate] = React.useState("27");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    void getById(id)
      .then((product) => {
        setName(product.name);
        setDescription(product.description ?? "");
        setUnitPrice(String(product.unitPrice));
        setVatRate(String(product.vatRate));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [id, getById]);

  async function handleSave() {
    if (!id || !name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await update(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        unitPrice: Number(unitPrice) || 0,
        vatRate: Number(vatRate) || 27,
      });
      router.replace(routes.products);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormScreen header={<PageHeader title="Edit product" />}>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<PageHeader title="Edit product" subtitle={name} />}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Name</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>Description</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={description} onChangeText={setDescription} />
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
            />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>VAT rate (%)</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={vatRate} onChangeText={setVatRate} keyboardType="number-pad" />
          </Input>
        </FormControl>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>Save changes</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
