// components/invoices/composer/LineItemRow.tsx
// One line item of step 2, in one of two container-driven layouts
// (responsive-line-item-grid — StepLineItems measures the form column with
// onLayout and picks via lineItemLayoutForWidth()):
//   - "grid": the single inline-editable row under StepLineItems' column
//     header, widths from COMPOSER_GRID_COLUMNS (spec §2.4);
//   - "card": a compact labelled card for any column narrower than the
//     grid (phones, and a 1440px laptop with the sidebar AND the live PDF
//     side preview open): description / qty + unit + unit price / VAT +
//     total + delete. No fixed widths, so it never scrolls sideways.
// Autocomplete, the UNIT_OPTIONS picker and delete-confirmation are shared
// by both layouts.
import * as React from "react";
import { Trash2 } from "lucide-react-native";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { UNIT_OPTIONS } from "@/components/invoices/composer/composer-logic";
import { COMPOSER_GRID_COLUMNS, type LineItemLayout } from "@/components/invoices/composer/grid-columns";
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
import { TAP_TARGET_DROPDOWN_TOP, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

export function LineItemRow({
  layout,
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
  layout: LineItemLayout;
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

  // A line whose dropdown is open must paint above the lines after it,
  // otherwise the next card/row covers the menu.
  const stackClass = (descFocused && matches.length > 0) || unitMenuOpen ? "relative z-30" : "relative z-0";

  // --- shared fields (identical behaviour in both layouts) ---------------

  const descriptionField = (
    <>
      <Input>
        <InputField
          testID={`lineItem-${index}-description`}
          placeholder={t("invoices.lineItemEditor.descriptionPlaceholder")}
          value={item.description}
          onChangeText={(value) => onChange({ description: value })}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setTimeout(() => setDescFocused(false), 120)}
          className="min-w-0"
        />
      </Input>
      {descFocused && matches.length > 0 ? (
        <VStack className={`absolute ${TAP_TARGET_DROPDOWN_TOP} z-10 w-full rounded-lg border border-border bg-card shadow-sm`}>
          {matches.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => onFillFromProduct(product)}
              className={`${TAP_TARGET_MIN_H} justify-center border-b border-subtle px-2 py-1.5 last:border-b-0`}
            >
              <Text size="sm">{product.name}</Text>
            </Pressable>
          ))}
        </VStack>
      ) : null}
    </>
  );

  const quantityField = (
    <Input className="min-w-0 flex-1">
      <InputField
        testID={`lineItem-${index}-quantity`}
        keyboardType="decimal-pad"
        value={String(item.quantity)}
        onChangeText={(value) => onChange({ quantity: Math.max(0, Number(value) || 0) })}
        className="min-w-0 tabular-nums"
      />
    </Input>
  );

  const unitButton = (extraClassName: string) => (
    <Pressable
      onPress={() => setUnitMenuOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={t("invoices.fields.unit")}
      hitSlop={8}
      className={`h-11 items-center justify-center rounded-lg border border-border bg-card ${extraClassName}`}
    >
      <Text size="sm">{item.unit || "db"}</Text>
    </Pressable>
  );

  const unitMenu = unitMenuOpen ? (
    <VStack className={`absolute ${TAP_TARGET_DROPDOWN_TOP} z-10 w-full min-w-[96px] rounded-lg border border-border bg-card shadow-sm`}>
      {UNIT_OPTIONS.map((unit) => (
        <Pressable
          key={unit}
          onPress={() => {
            onChange({ unit });
            setUnitMenuOpen(false);
          }}
          className={`${TAP_TARGET_MIN_H} justify-center px-2 py-1.5`}
        >
          <Text size="sm">{unit}</Text>
        </Pressable>
      ))}
    </VStack>
  ) : null;

  const unitPriceField = (
    <Input>
      <InputField
        testID={`lineItem-${index}-unitPrice`}
        keyboardType="decimal-pad"
        value={String(item.unitPrice)}
        onChangeText={(value) => onChange({ unitPrice: Math.max(0, Number(value) || 0) })}
        className="min-w-0 tabular-nums"
      />
    </Input>
  );

  const vatPicker = (
    <VatCategoryPicker
      category={item.vatCategory}
      rate={item.vatRate}
      onChangeCategory={(category: VatCategory) =>
        onChange({ vatCategory: category, vatRate: category === "normal" ? item.vatRate || 27 : 0 })
      }
      onChangeRate={(rate: VatRate) => onChange({ vatRate: rate })}
      t={t}
    />
  );

  // amount: bruttó + nettó, merged — neither figure disappears (AC8)
  const amount = (
    <>
      <Text size="sm" className="font-semibold tabular-nums text-foreground">
        {formatCurrency(lineItemGrossTotal(item), currency)}
      </Text>
      <Text size="xs" className="tabular-nums text-muted-foreground">
        {t("invoices.lineItemEditor.netAbbrev")} {formatCurrency(lineItemNetTotal(item), currency)}
      </Text>
    </>
  );

  if (layout === "card") {
    const label = (text: string) => (
      <Text size="xs" className="mb-1 text-muted-foreground">
        {text}
      </Text>
    );
    return (
      <VStack
        space="sm"
        className={`${stackClass} rounded-lg border border-border bg-card p-3`}
        testID={`lineItem-${index}-card`}
      >
        {/* row 1 — description (+ product autocomplete). z-20 keeps the
            dropdown above the rows below it. */}
        <VStack className="relative z-20" testID={`lineItem-${index}-card-description`}>
          <Text size="xs" className="mb-1 font-medium text-foreground">
            {t("invoices.lineItemEditor.lineLabel", { index: index + 1 })}
            <Text size="xs" className="font-normal text-muted-foreground">
              {" · "}
              {t("invoices.lineItemEditor.description")}
            </Text>
          </Text>
          <VStack className="relative">{descriptionField}</VStack>
        </VStack>

        {/* row 2 — quantity + unit + unit price */}
        <HStack space="sm" className="relative z-10 items-end" testID={`lineItem-${index}-card-amounts`}>
          <VStack className="min-w-0 flex-1">
            {label(t("invoices.lineItemEditor.quantity"))}
            <HStack>{quantityField}</HStack>
          </VStack>
          <VStack className="w-16 shrink-0">
            {label(t("invoices.lineItemEditor.unitShort"))}
            <VStack className="relative">
              {unitButton("w-full")}
              {unitMenu}
            </VStack>
          </VStack>
          <VStack className="min-w-0 flex-[1.4]">
            {label(t("invoices.lineItemEditor.unitPrice"))}
            {unitPriceField}
          </VStack>
        </HStack>

        {/* row 3 — ÁFA picker + computed total + delete. Wraps: side by
            side when the card is wide enough, total + delete drop under
            the picker on the narrowest phones. */}
        <HStack className="flex-wrap items-start gap-x-3 gap-y-2" testID={`lineItem-${index}-card-vat`}>
          <VStack className="min-w-[200px] flex-1">
            {label(t("invoices.vat.categoryLabel"))}
            {vatPicker}
          </VStack>
          <HStack space="xs" className="ml-auto shrink-0 items-start">
            <VStack className="items-end">
              {label(t("invoices.lineItemEditor.amountColumn"))}
              {amount}
            </VStack>
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
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack className={`${stackClass} py-2`}>
      {/* Grid row — 6 cells, widths from COMPOSER_GRID_COLUMNS
          (grid-columns.ts) so this can never drift from StepLineItems'
          header (composer-line-item-horizontal-scroll-1440). */}
      <HStack space="sm" className="items-start" testID={`lineItem-${index}-grid-row`}>
        <VStack className={`relative ${COMPOSER_GRID_COLUMNS[0].className}`}>{descriptionField}</VStack>

        {/* quantity + unit, merged — "2 óra" is one thought (INV-6) */}
        <VStack className={`relative ${COMPOSER_GRID_COLUMNS[1].className}`}>
          <HStack space="xs">
            {quantityField}
            {unitButton("w-[44px]")}
          </HStack>
          {unitMenu}
        </VStack>

        <VStack className={COMPOSER_GRID_COLUMNS[2].className}>{unitPriceField}</VStack>

        <VStack className={COMPOSER_GRID_COLUMNS[3].className}>{vatPicker}</VStack>

        <VStack className={COMPOSER_GRID_COLUMNS[4].className}>{amount}</VStack>

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
    </VStack>
  );
}
