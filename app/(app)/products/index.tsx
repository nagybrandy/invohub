// app/(app)/products/index.tsx
// Termékek (redesign 2026-11, SPEC §6): the same list pattern as Számlák
// without KPI strip, alert or tabs — header with "Új termék" (which opens the
// existing quick-add form), search, one card that is a table (Név, Egység,
// Nettó egységár, ÁFA) above 820px and cards below. Prices show in the
// company's currency, not a hardcoded EUR next to a Hungarian 27% VAT rate.
import * as React from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
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
import { formatCurrency } from "@/lib/invoices/calculations";
import { routes } from "@/lib/navigation";
import { useProducts } from "@/hooks/useProducts";
import { confirmAsync } from "@/lib/ui/confirm";
import type { Product } from "@/lib/products/service";

// No company.defaultCurrency field exists yet (P2's fallback rule) — HUF
// matches the dashboard's own default currency constant.
const COMPANY_CURRENCY = "HUF";

export default function ProductsScreen() {
  const { t } = useTranslation();
  const { products, loading, error, create, remove } = useProducts();
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
      { label: t("lists.menu.edit"), icon: Pencil, onPress: () => router.push(routes.productEdit(product.id)) },
      { label: t("common.delete"), icon: Trash2, destructive: true, onPress: () => void handleDelete(product) },
    ];
  }

  const columns: ListColumn<Product>[] = [
    {
      key: "name",
      header: t("products.columnName"),
      render: (p) => (
        <Text numberOfLines={1} className="whitespace-nowrap text-sm text-ink">
          {p.name}
        </Text>
      ),
    },
    {
      key: "unit",
      header: t("products.columnUnit"),
      width: 120,
      render: (p) => <Text className="text-sm text-ink">{p.unit ?? "db"}</Text>,
    },
    {
      key: "unitPrice",
      header: t("products.columnNetPrice"),
      width: 170,
      align: "right",
      render: (p) => (
        <Text numeric className="whitespace-nowrap text-sm font-bold text-ink">
          {formatCurrency(p.unitPrice, COMPANY_CURRENCY)}
        </Text>
      ),
    },
    {
      key: "vatRate",
      header: t("products.columnVat"),
      width: 100,
      align: "right",
      render: (p) => (
        <Text numeric className="text-sm text-ink">
          {`${p.vatRate ?? 27}%`}
        </Text>
      ),
    },
  ];

  const menu = (p: Product) => <OverflowMenu items={menuItemsFor(p)} label={t("products.rowMenuLabel")} />;

  const emptyState = (
    <Box className="overflow-hidden rounded-card bg-surface shadow-card">
      {search.trim() ? (
        <StateView kind="empty" title={t("lists.noResults")} description={t("lists.noResultsHint")} />
      ) : (
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
      )}
    </Box>
  );

  const footer =
    !loading && filtered.length > 0 ? (
      <ListFooterBar testID="product-list-stats" countLabel={t("lists.footer.products", { count: filtered.length })} />
    ) : null;

  return (
    <ScreenLayout
      header={
        <PageHeader
          title={t("products.title")}
          subtitle={t("products.subtitle")}
          actions={
            <Button testID="products-new" onPress={() => setShowQuickAdd((v) => !v)}>
              <ButtonText>{t("products.add")}</ButtonText>
            </Button>
          }
        />
      }
    >
      <VStack space="md">
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
                <Button variant="secondary" onPress={() => setShowQuickAdd(false)}>
                  <ButtonText>{t("common.cancel")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>
        ) : null}
        <ListSearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t("products.search")}
          testID="products-search"
        />
        {error && products.length === 0 && !loading ? (
          <Box className="overflow-hidden rounded-card bg-surface shadow-card">
            <StateView kind="error" title={t("states.errorTitle")} description={error} />
          </Box>
        ) : (
          <ListTable
            testID="product-list-table"
            columns={columns}
            rows={filtered}
            keyExtractor={(p) => p.id}
            onRowPress={(p) => router.push(routes.productEdit(p.id))}
            rowMenu={menu}
            loading={loading}
            empty={emptyState}
            footer={footer}
            renderCard={(p) => (
              <ListCardRow
                title={p.name}
                amount={formatCurrency(p.unitPrice, COMPANY_CURRENCY)}
                meta={`${p.unit ?? "db"} · ${t("invoices.fields.vat")} ${p.vatRate ?? 27}%`}
                menu={menu(p)}
                onPress={() => router.push(routes.productEdit(p.id))}
                testID="product-card"
              />
            )}
          />
        )}
      </VStack>
    </ScreenLayout>
  );
}
