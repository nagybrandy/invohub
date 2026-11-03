// components/invoices/composer/LineItemRow.tsx
// One line item of "Mit számlázol?", in one of two container-driven layouts
// (StepLineItems measures the form column with onLayout and picks via
// lineItemLayoutForWidth()), redesign 2026-11, tokens.md §6.18:
//   - "row": a single row under StepLineItems' one header line — Megnevezés
//     grows, then Menny., Egység, Egységár, ÁFA, Összesen and the delete icon;
//   - "stacked": Megnevezés full width (delete icon beside it), then Menny.,
//     Egység, Egységár, ÁFA on one LABELLED line; in a narrow container
//     Összesen drops to its own line under a dashed rule.
// No row numbers. Cells are 38px. Autocomplete from the product list, the
// unit options and the delete confirmation are shared by both layouts.
import * as React from "react";
import { Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { ItemSelect } from "@/components/invoices/composer/ItemSelect";
import { UNIT_OPTIONS } from "@/components/invoices/composer/composer-logic";
import { COMPOSER_GRID_COLUMNS, type LineItemLayout } from "@/components/invoices/composer/grid-columns";
import { VatCategoryPicker } from "@/components/invoices/composer/VatCategoryPicker";
import {
  formatCurrency,
  lineItemGrossTotal,
  lineItemNetTotal,
} from "@/lib/invoices/calculations";
import { displayUnitPrice, netFromGross, storedUnitPrice, type UnitPriceMode } from "@/lib/invoices/unit-price";
import type { InvoiceCurrency, InvoiceLineItem, VatCategory, VatRate } from "@/lib/invoices/types";
import type { Product } from "@/lib/products/service";
import { useIconColors } from "@/lib/theme/icon-colors";
import { confirmAsync } from "@/lib/ui/confirm";

const CELL = "h-[38px]";
const LABEL_CLASS = "mb-1 text-xs text-muted-ink";

function colClass(key: (typeof COMPOSER_GRID_COLUMNS)[number]["key"]): string {
  return COMPOSER_GRID_COLUMNS.find((col) => col.key === key)!.className;
}

export function LineItemRow({
  layout,
  compact = false,
  index,
  item,
  currency,
  products,
  canDelete,
  onChange,
  onRemove,
  onFillFromProduct,
  allowNegativeQuantity = false,
  priceMode = "net",
  focusDescription = false,
  onFocusHandled,
  t,
}: {
  layout: LineItemLayout;
  /** Stacked layout in a narrow container: smaller cells, Összesen on its own line. */
  compact?: boolean;
  index: number;
  item: InvoiceLineItem;
  currency: InvoiceCurrency;
  products: Product[];
  canDelete: boolean;
  onChange: (patch: Partial<InvoiceLineItem>) => void;
  onRemove: () => void;
  onFillFromProduct: (product: Product) => void;
  /** Helyesbítő reversing lines carry a negative quantity — keep it. */
  allowNegativeQuantity?: boolean;
  /** Whether the unit-price field is typed/shown as net or gross (the stored value is always net). */
  priceMode?: UnitPriceMode;
  /** Focus this row's description (a failed save asks for it). */
  focusDescription?: boolean;
  onFocusHandled?: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const icons = useIconColors();
  const [descFocused, setDescFocused] = React.useState(false);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const descriptionRef = React.useRef<{ focus?: () => void } | null>(null);

  React.useEffect(() => {
    if (!focusDescription) return;
    descriptionRef.current?.focus?.();
    onFocusHandled?.();
  }, [focusDescription, onFocusHandled]);

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

  // A line whose autocomplete is open must paint above the lines after it.
  const stackClass = descFocused && matches.length > 0 ? "relative z-30" : "relative z-0";

  const unitOptions = React.useMemo(() => {
    const current = item.unit || "db";
    const units = UNIT_OPTIONS.includes(current) ? UNIT_OPTIONS : [current, ...UNIT_OPTIONS];
    return units.map((unit) => ({ value: unit, label: unit }));
  }, [item.unit]);

  // --- shared fields (identical behaviour in both layouts) ---------------

  const descriptionField = (
    <Box className="relative">
      <Input className={CELL}>
        <InputField
          ref={descriptionRef as never}
          testID={`lineItem-${index}-description`}
          accessibilityLabel={t("invoices.lineItemEditor.description")}
          placeholder={t("invoices.lineItemEditor.descriptionPlaceholder")}
          value={item.description}
          onChangeText={(value) => onChange({ description: value })}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setTimeout(() => setDescFocused(false), 120)}
          className="min-w-0"
        />
      </Input>
      {descFocused && matches.length > 0 ? (
        <Box className="absolute left-0 right-0 top-[42px] z-10 overflow-hidden rounded-menu border border-line-strong bg-surface p-1.5 shadow-menu">
          {matches.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => onFillFromProduct(product)}
              className="min-h-11 justify-center rounded-control px-2.5 py-1.5 data-[hover=true]:bg-neutral-wash"
            >
              <Text className="text-sm text-ink">{product.name}</Text>
            </Pressable>
          ))}
        </Box>
      ) : null}
      {item.comment || noteOpen ? (
        <Input className={`${CELL} mt-2`}>
          <InputField
            testID={`lineItem-${index}-comment`}
            accessibilityLabel={t("invoices.lineItemEditor.commentPlaceholder")}
            placeholder={t("invoices.lineItemEditor.commentPlaceholder")}
            value={item.comment ?? ""}
            onChangeText={(value) => onChange({ comment: value })}
            className="min-w-0 text-sm"
          />
        </Input>
      ) : (
        <Pressable
          onPress={() => setNoteOpen(true)}
          accessibilityRole="button"
          testID={`lineItem-${index}-comment-add`}
          className="mt-1 min-h-8 justify-center self-start"
        >
          <Text className="text-xs font-semibold text-primary">{t("composer.itemNoteAdd")}</Text>
        </Pressable>
      )}
    </Box>
  );

  const quantityField = (
    <Input className={CELL}>
      <InputField
        testID={`lineItem-${index}-quantity`}
        accessibilityLabel={t("invoices.lineItemEditor.quantity")}
        keyboardType="decimal-pad"
        value={String(item.quantity)}
        onChangeText={(value) => {
          const parsed = Number(value) || 0;
          onChange({ quantity: allowNegativeQuantity ? parsed : Math.max(0, parsed) });
        }}
        className="min-w-0 text-right tabular-nums"
      />
    </Input>
  );

  const unitField = (
    <ItemSelect
      value={item.unit || "db"}
      options={unitOptions}
      accessibilityLabel={t("invoices.fields.unit")}
      testID={`lineItem-${index}-unit`}
      onChange={(unit) => onChange({ unit })}
    />
  );

  const unitPriceField = (
    <Input className={CELL}>
      <InputField
        testID={`lineItem-${index}-unitPrice`}
        accessibilityLabel={t("invoices.lineItemEditor.unitPrice")}
        placeholder={t(priceMode === "net" ? "invoices.lineItemEditor.priceNet" : "invoices.lineItemEditor.priceGross")}
        keyboardType="decimal-pad"
        value={String(displayUnitPrice(item, priceMode))}
        onChangeText={(value) =>
          onChange({ unitPrice: storedUnitPrice(Math.max(0, Number(value) || 0), item, priceMode) })
        }
        className="min-w-0 text-right tabular-nums"
      />
    </Input>
  );

  // Typing gross: changing the VAT treatment must not move the price the user
  // typed — re-derive the stored net so the gross stays put.
  function keepGross(next: Pick<InvoiceLineItem, "vatCategory" | "vatRate">): Partial<InvoiceLineItem> {
    if (priceMode !== "gross") return {};
    return { unitPrice: netFromGross(displayUnitPrice(item, "gross"), next) };
  }

  const vatPicker = (
    <VatCategoryPicker
      category={item.vatCategory}
      rate={item.vatRate}
      testID={`lineItem-${index}-vat`}
      onChange={({ category, rate }: { category: VatCategory; rate: VatRate }) =>
        onChange({ vatCategory: category, vatRate: rate, ...keepGross({ vatCategory: category, vatRate: rate }) })
      }
      t={t}
    />
  );

  // Összesen: bruttó + nettó, merged — neither figure disappears (AC8)
  const amount = (
    <>
      <Text className="text-sm font-semibold tabular-nums text-ink" testID={`lineItem-${index}-total`}>
        {formatCurrency(lineItemGrossTotal(item), currency)}
      </Text>
      <Text className="text-xs tabular-nums text-muted-ink">
        {t("invoices.lineItemEditor.netAbbrev")} {formatCurrency(lineItemNetTotal(item), currency)}
      </Text>
    </>
  );

  const deleteButton = canDelete ? (
    <Pressable
      onPress={() => void handleRemove()}
      accessibilityRole="button"
      accessibilityLabel={t("invoices.lineItemEditor.deleteAction")}
      testID={`lineItem-${index}-delete`}
      className="h-10 w-10 items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash tab:h-[34px] tab:w-[34px]"
    >
      <Trash2 size={16} color={icons.muted} />
    </Pressable>
  ) : null;

  if (layout === "row") {
    return (
      <Box className={`${stackClass} flex-row items-start gap-2 py-2`} testID={`lineItem-${index}-row`}>
        <Box className={colClass("description")}>{descriptionField}</Box>
        <Box className={colClass("quantity")}>{quantityField}</Box>
        <Box className={colClass("unit")}>{unitField}</Box>
        <Box className={colClass("unitPrice")}>{unitPriceField}</Box>
        <Box className={colClass("vat")}>{vatPicker}</Box>
        <Box className={`${colClass("total")} min-h-[38px] justify-center`}>{amount}</Box>
        <Box className={`${colClass("actions")} h-[38px] justify-center`}>{deleteButton}</Box>
      </Box>
    );
  }

  const label = (text: string) => <Text className={LABEL_CLASS}>{text}</Text>;

  return (
    <Box
      className={`${stackClass} gap-3 py-3 ${index > 0 ? "border-t border-line" : ""}`}
      testID={`lineItem-${index}-stacked`}
    >
      <Box className="flex-row items-start gap-2">
        <Box className="min-w-0 flex-1">
          {label(t("invoices.lineItemEditor.description"))}
          {descriptionField}
        </Box>
        <Box className="mt-[22px] h-[38px] justify-center">{deleteButton}</Box>
      </Box>

      <Box className="flex-row items-end gap-2" testID={`lineItem-${index}-numbers`}>
        <Box className={compact ? "w-14" : "w-[72px]"}>
          {label(t("invoices.lineItemEditor.quantity"))}
          {quantityField}
        </Box>
        <Box className={compact ? "w-[76px]" : "w-[84px]"}>
          {label(t("invoices.lineItemEditor.unitShort"))}
          {unitField}
        </Box>
        <Box className="min-w-0 flex-1">
          {label(
            `${t("invoices.lineItemEditor.unitPrice")} (${t(
              priceMode === "net" ? "invoices.lineItemEditor.priceNet" : "invoices.lineItemEditor.priceGross"
            )})`
          )}
          {unitPriceField}
        </Box>
        <Box className={compact ? "w-[100px]" : "w-[112px]"}>
          {label(t("invoices.fields.vat"))}
          {vatPicker}
        </Box>
        {compact ? null : (
          <Box className="w-[128px] items-end">
            {label(t("invoices.lineItemEditor.amountColumn"))}
            <Box className="min-h-[38px] items-end justify-center">{amount}</Box>
          </Box>
        )}
      </Box>

      {compact ? (
        <Box
          className="flex-row items-start justify-between gap-3 border-t border-dashed border-line-strong pt-2"
          testID={`lineItem-${index}-total-line`}
        >
          <Text className="text-xs text-muted-ink">{t("invoices.lineItemEditor.amountColumn")}</Text>
          <Box className="items-end">{amount}</Box>
        </Box>
      ) : null}
    </Box>
  );
}
