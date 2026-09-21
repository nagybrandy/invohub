// components/invoices/composer/LineItemRow.tsx
// One row of the step-2 grid: inline-editable cells, no per-line card
// header and no separate FormControl per field (INV-desktop grid, spec
// §2.4). Stacks into a 2-column mobile card below md (768px).
import * as React from "react";
import { Trash2 } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { UNIT_OPTIONS } from "@/components/invoices/composer/composer-logic";
import { COMPOSER_GRID_COLUMNS } from "@/components/invoices/composer/grid-columns";
import { VatCategoryPicker } from "@/components/invoices/composer/VatCategoryPicker";
import {
  formatCurrency,
  lineItemGrossTotal,
  lineItemNetTotal,
} from "@/lib/invoices/calculations";
import type { InvoiceCurrency, InvoiceLineItem, VatCategory, VatRate } from "@/lib/invoices/types";
import type { Product } from "@/lib/products/service";
import { useIconColors } from "@/lib/theme/icon-colors";
import { confirmAsync } from "@/lib/ui/confirm";
import { TAP_TARGET_DROPDOWN_TOP } from "@/lib/ui/tap-target";

export function LineItemRow({
  index,
  item,
  currency,
  products,
  canDelete,
  onChange,
  onRemove,
  onFillFromProduct,
  t,
}: {
  index: number;
  item: InvoiceLineItem;
  currency: InvoiceCurrency;
  products: Product[];
  canDelete: boolean;
  onChange: (patch: Partial<InvoiceLineItem>) => void;
  onRemove: () => void;
  onFillFromProduct: (product: Product) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icons = useIconColors();
  const [descFocused, setDescFocused] = React.useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = React.useState(false);

  const matches = React.useMemo(() => {
    const q = item.description.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [item.description, products]);

  async function handleRemove() {
    if (item.description.trim()) {
      const confirmed = await confirmAsync({
        title: t("invoices.lineItemEditor.deleteTitle"),
        message: t("invoices.lineItemEditor.deleteMessage", { description: item.description }),
        confirmLabel: t("common.delete"),
        cancelLabel: t("common.cancel"),
        destructive: true,
      });
      if (!confirmed) return;
    }
    onRemove();
  }

  return (
    <VStack className="border-b border-subtle py-3 md:border-0 md:py-2" space="sm">
      {/* Desktop grid row — 6 cells, widths from COMPOSER_GRID_COLUMNS
          (grid-columns.ts) so this can never drift from StepLineItems'
          header (composer-line-item-horizontal-scroll-1440). */}
      <HStack space="sm" className="hidden items-start md:flex">
        {/* description */}
        <VStack className={`relative ${COMPOSER_GRID_COLUMNS[0].className}`}>
          <Input>
            <InputField
              testID={`lineItem-${index}-description`}
              placeholder={t("invoices.lineItemEditor.descriptionPlaceholder")}
              value={item.description}
              onChangeText={(value) => onChange({ description: value })}
              onFocus={() => setDescFocused(true)}
              onBlur={() => setTimeout(() => setDescFocused(false), 120)}
            />
          </Input>
          {descFocused && matches.length > 0 ? (
            <VStack className={`absolute ${TAP_TARGET_DROPDOWN_TOP} z-10 w-full rounded-lg border border-border bg-card shadow-sm`}>
              {matches.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => onFillFromProduct(product)}
                  className="border-b border-subtle px-2 py-1.5 last:border-b-0"
                >
                  <Text size="sm">{product.name}</Text>
                </Pressable>
              ))}
            </VStack>
          ) : null}
        </VStack>

        {/* quantity + unit, merged — "2 óra" is one thought (INV-6) */}
        <VStack className={`relative ${COMPOSER_GRID_COLUMNS[1].className}`}>
          <HStack space="xs">
            <Input className="flex-1">
              <InputField
                keyboardType="decimal-pad"
                value={String(item.quantity)}
                onChangeText={(value) => onChange({ quantity: Math.max(0, Number(value) || 0) })}
                className="tabular-nums"
              />
            </Input>
            <Pressable
              onPress={() => setUnitMenuOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t("invoices.fields.unit")}
              hitSlop={8}
              className="h-11 w-[44px] items-center justify-center rounded-lg border border-border bg-card"
            >
              <Text size="sm">{item.unit || "db"}</Text>
            </Pressable>
          </HStack>
          {unitMenuOpen ? (
            <VStack className={`absolute ${TAP_TARGET_DROPDOWN_TOP} z-10 w-full rounded-lg border border-border bg-card shadow-sm`}>
              {UNIT_OPTIONS.map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => {
                    onChange({ unit });
                    setUnitMenuOpen(false);
                  }}
                  className="px-2 py-1.5"
                >
                  <Text size="sm">{unit}</Text>
                </Pressable>
              ))}
            </VStack>
          ) : null}
        </VStack>

        {/* unit price */}
        <VStack className={COMPOSER_GRID_COLUMNS[2].className}>
          <Input>
            <InputField
              keyboardType="decimal-pad"
              value={String(item.unitPrice)}
              onChangeText={(value) => onChange({ unitPrice: Math.max(0, Number(value) || 0) })}
              className="tabular-nums"
            />
          </Input>
        </VStack>

        {/* VAT category + rate */}
        <VStack className={COMPOSER_GRID_COLUMNS[3].className}>
          <VatCategoryPicker
            category={item.vatCategory}
            rate={item.vatRate}
            onChangeCategory={(category: VatCategory) =>
              onChange({ vatCategory: category, vatRate: category === "normal" ? item.vatRate || 27 : 0 })
            }
            onChangeRate={(rate: VatRate) => onChange({ vatRate: rate })}
            t={t}
          />
        </VStack>

        {/* amount: bruttó + nettó, merged — neither figure disappears (AC8) */}
        <VStack className={COMPOSER_GRID_COLUMNS[4].className}>
          <Text size="sm" className="font-semibold tabular-nums text-foreground">
            {formatCurrency(lineItemGrossTotal(item), currency)}
          </Text>
          <Text size="xs" className="tabular-nums text-muted-foreground">
            {t("invoices.lineItemEditor.netAbbrev")} {formatCurrency(lineItemNetTotal(item), currency)}
          </Text>
        </VStack>

        {/* delete */}
        <VStack className={COMPOSER_GRID_COLUMNS[5].className}>
          {canDelete ? (
            <Pressable
              onPress={() => void handleRemove()}
              accessibilityRole="button"
              accessibilityLabel={t("invoices.lineItemEditor.deleteAction")}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center"
            >
              <Trash2 size={16} color={icons.muted} />
            </Pressable>
          ) : null}
        </VStack>
      </HStack>

      {/* Mobile card */}
      <VStack space="sm" className="md:hidden">
        <HStack className="items-center justify-between">
          <Text className="font-medium text-foreground">
            {t("invoices.lineItemEditor.lineLabel", { index: index + 1 })}
          </Text>
          {canDelete ? (
            <Pressable
              onPress={() => void handleRemove()}
              accessibilityRole="button"
              accessibilityLabel={t("invoices.lineItemEditor.deleteAction")}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center"
            >
              <Trash2 size={18} color={icons.muted} />
            </Pressable>
          ) : null}
        </HStack>
        <Input>
          <InputField
            placeholder={t("invoices.lineItemEditor.descriptionPlaceholder")}
            value={item.description}
            onChangeText={(value) => onChange({ description: value })}
          />
        </Input>
        <HStack space="sm">
          <VStack className="flex-1">
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.lineItemEditor.quantity")}
            </Text>
            <Input>
              <InputField
                keyboardType="decimal-pad"
                value={String(item.quantity)}
                onChangeText={(value) => onChange({ quantity: Math.max(0, Number(value) || 0) })}
              />
            </Input>
          </VStack>
          <VStack className="flex-1">
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.fields.unit")}
            </Text>
            <Input>
              <InputField value={item.unit || "db"} onChangeText={(value) => onChange({ unit: value })} />
            </Input>
          </VStack>
        </HStack>
        <HStack space="sm">
          <VStack className="flex-1">
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.lineItemEditor.unitPrice")}
            </Text>
            <Input>
              <InputField
                keyboardType="decimal-pad"
                value={String(item.unitPrice)}
                onChangeText={(value) => onChange({ unitPrice: Math.max(0, Number(value) || 0) })}
              />
            </Input>
          </VStack>
          <VStack className="flex-1">
            <Text size="xs" className="text-muted-foreground">
              {t("invoices.vat.categoryLabel")}
            </Text>
            <VatCategoryPicker
              category={item.vatCategory}
              rate={item.vatRate}
              onChangeCategory={(category: VatCategory) =>
                onChange({ vatCategory: category, vatRate: category === "normal" ? item.vatRate || 27 : 0 })
              }
              onChangeRate={(rate: VatRate) => onChange({ vatRate: rate })}
              t={t}
            />
          </VStack>
        </HStack>
        <Text size="sm" className="text-muted-foreground">
          {t("invoices.lineItemEditor.lineTotal")}: {formatCurrency(lineItemGrossTotal(item), currency)}
        </Text>
      </VStack>
    </VStack>
  );
}
