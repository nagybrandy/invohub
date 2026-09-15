// app/(app)/products/index.tsx
// Product catalog list (accountants only). Desktop table + search + row
// menu + a consistent "Új termék" primary button (C3, P1). Prices show in
// the company's currency, not a hardcoded EUR next to a Hungarian 27% VAT
// rate (P2).
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DataTable, type Column } from "@/components/layout/DataTable";
import { OverflowMenu, type OverflowMenuItem } from "@/components/layout/OverflowMenu";
import { PageHeader } from "@/components/layout/PageHeader";
import { ScreenLayout } from "@/components/layout/ScreenLayout";
import { StateView } from "@/components/layout/StateView";
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { useProducts } from "@/hooks/useProducts";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { confirmAsync } from "@/lib/ui/confirm";
import type { Product } from "@/lib/products/service";

// No company.defaultCurrency field exists yet (P2's fallback rule) — HUF
// matches the dashboard's own default currency constant.
const COMPANY_CURRENCY = "HUF";

export default function ProductsScreen() {
  const { t } = useTranslation();
  const { products, loading, create, remove } = useProducts();
  const isDesktop = useIsDesktop();
  const [search, setSearch] = React.useState("");
  const [showQuickAdd, setShowQuickAdd] = React.useState(false);
  const [name, setName] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await create({ name: name.trim(), unitPrice: Number(unitPrice) || 0 });
      setName("");
      setUnitPrice("");
      setShowQuickAdd(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = await confirmAsync({
      title: t("products.deleteConfirmTitle"),
      message: t("products.deleteConfirmMessage", { name: product.name }),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (confirmed) await remove(product.id);
  }

  function menuItemsFor(product: Product): OverflowMenuItem[] {
    return [
      { label: t("common.save"), icon: Pencil, onPress: () => router.push(routes.productEdit(product.id)) },
      {
        label: t("common.delete"),
        icon: Trash2,
        destructive: true,
        onPress: () => void handleDelete(product),
      },
    ];
  }

  const columns: Column<Product>[] = [
    { key: "name", header: t("products.columnName"), render: (p) => p.name },
    { key: "unit", header: t("products.columnUnit"), width: 100, render: (p) => p.unit ?? "db" },
    {
      key: "unitPrice",
      header: t("products.columnNetPrice"),
      width: 140,
      numeric: true,
      render: (p) => formatCurrency(p.unitPrice, COMPANY_CURRENCY),
    },
    { key: "vatRate", header: t("products.columnVat"), width: 90, align: "right", render: (p) => `${p.vatRate ?? 27}%` },
  ];

  const emptyState = (
    <StateView
      kind="empty"
      title={t("products.empty")}
      description={t("products.emptyDesc")}
      action={
        <Button onPress={() => setShowQuickAdd(true)}>
          <ButtonText>{t("products.add")}</ButtonText>
        </Button>
      }
    />
  );

  return (
    <ScreenLayout
      header={
        <VStack space="md" className="pb-4">
          <PageHeader
            title={t("products.title")}
            subtitle={t("products.subtitle")}
            primaryAction={
              <Button size="sm" onPress={() => setShowQuickAdd((v) => !v)}>
                <ButtonText>{t("products.add")}</ButtonText>
              </Button>
            }
          />
          {showQuickAdd ? (
            <Card className="p-4">
              <VStack space="sm">
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t("products.quickAdd")}</FormControlLabelText>
                  </FormControlLabel>
                  <Input>
                    <InputField value={name} onChangeText={setName} placeholder={t("products.namePlaceholder")} />
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
                      placeholder={t("products.unitPricePlaceholder")}
                    />
                  </Input>
                </FormControl>
                <HStack space="sm">
                  <Button onPress={() => void handleAdd()} disabled={saving}>
                    <ButtonText>{t("products.quickAddSubmit")}</ButtonText>
                  </Button>
                  <Button variant="outline" onPress={() => setShowQuickAdd(false)}>
                    <ButtonText>{t("common.cancel")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            </Card>
          ) : null}
          <Input>
            <InputField
              value={search}
              onChangeText={setSearch}
              placeholder={t("products.search")}
              testID="products-search"
            />
          </Input>
        </VStack>
      }
    >
      {isDesktop ? (
        <DataTable
          columns={columns}
          rows={filtered}
          keyExtractor={(p) => p.id}
          onRowPress={(p) => router.push(routes.productEdit(p.id))}
          rowActions={(p) => <OverflowMenu items={menuItemsFor(p)} label={t("products.rowMenuLabel")} />}
          loading={loading}
          empty={emptyState}
        />
      ) : loading && filtered.length === 0 ? (
        <StateView kind="loading" title="" />
      ) : filtered.length === 0 ? (
        emptyState
      ) : (
        <VStack space="sm">
          {filtered.map((product) => (
            <Pressable key={product.id} onPress={() => router.push(routes.productEdit(product.id))}>
              <Card className="p-4 active:opacity-80">
                <HStack className="items-center justify-between">
                  <VStack space="xs" className="flex-1">
                    <Text className="font-semibold text-foreground">{product.name}</Text>
                    <Text size="sm" className="text-muted-foreground">
                      {formatCurrency(product.unitPrice, COMPANY_CURRENCY)} · {t("invoices.fields.vat")}{" "}
                      {product.vatRate ?? 27}%
                    </Text>
                  </VStack>
                  <OverflowMenu items={menuItemsFor(product)} label={t("products.rowMenuLabel")} />
                </HStack>
              </Card>
            </Pressable>
          ))}
        </VStack>
      )}
    </ScreenLayout>
  );
}
