// app/(app)/products/[id]/edit.tsx
// Edit an existing product.
import * as React from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
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
import { useRouteParam } from "@/lib/routing/route-param";
import { useProducts } from "@/hooks/useProducts";

export default function EditProductScreen() {
  const id = useRouteParam("id");
  const { t } = useTranslation();
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
      .catch((e) => setError(e instanceof Error ? e.message : t("products.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, getById, t]);

  async function handleSave() {
    if (!id || !name.trim()) {
      setError(t("products.nameRequired"));
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
      setError(e instanceof Error ? e.message : t("products.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <FormScreen header={<PageHeader title={t("products.edit")} />}>
        <ActivityIndicator />
      </FormScreen>
    );
  }

  return (
    <FormScreen header={<PageHeader title={t("products.edit")} subtitle={name} />}>
      <VStack space="md">
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("products.name")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={name} onChangeText={setName} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("products.description")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={description} onChangeText={setDescription} />
          </Input>
        </FormControl>
        <FormControl>
          <FormControlLabel>
            <FormControlLabelText>{t("products.unitPrice")}</FormControlLabelText>
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
            <FormControlLabelText>{t("products.vatRate")}</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField value={vatRate} onChangeText={setVatRate} keyboardType="number-pad" />
          </Input>
        </FormControl>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <Button onPress={handleSave} disabled={saving}>
          <ButtonText>{t("products.saveChanges")}</ButtonText>
        </Button>
      </VStack>
    </FormScreen>
  );
}
