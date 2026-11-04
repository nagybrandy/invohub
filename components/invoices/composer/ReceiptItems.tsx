// components/invoices/composer/ReceiptItems.tsx
// "Mit számlázol?" of Új nyugta (redesign 2026-11, SPEC §8.11): the receipt
// form's existing entry modes (Egyszerű: one amount, Részletes: line items)
// in the composer's section style. The detailed mode uses the same container-
// driven layout as the invoice items — a header line and one row per item from
// 820px, Megnevezés over one labelled numbers line below that — with 38px
// cells, no row numbers and a delete icon. Which fields exist (description,
// quantity, unit, net unit price, VAT rate) and how they are stored is the
// receipt form's own and is unchanged.
import * as React from "react";
import { Trash2 } from "lucide-react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { FormField } from "@/components/layout/FormField";
import { ComposerSection } from "@/components/invoices/composer/ComposerSection";
import { ComposerTotals } from "@/components/invoices/composer/ComposerTotals";
import { ItemSelect } from "@/components/invoices/composer/ItemSelect";
import { UNIT_OPTIONS } from "@/components/invoices/composer/composer-logic";
import {
  COMPOSER_GRID_COLUMNS,
  isCompactWidth,
  lineItemLayoutForWidth,
  type LineItemLayout,
} from "@/components/invoices/composer/grid-columns";
import { formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency } from "@/lib/invoices/types";
import { HU_VAT_RATES } from "@/lib/receipts/types";
import { useIconColors } from "@/lib/theme/icon-colors";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export type ReceiptEntryMode = "simple" | "detailed";

export type ReceiptItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  unit?: string;
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

const CELL = "h-[38px]";
const LABEL_CLASS = "mb-1 text-xs text-muted-ink";

function colClass(key: (typeof COMPOSER_GRID_COLUMNS)[number]["key"]): string {
  return COMPOSER_GRID_COLUMNS.find((col) => col.key === key)!.className;
}

/** Gross of one line, exactly as the receipt form always showed it. */
export function receiptLineGross(item: Pick<ReceiptItem, "quantity" | "unitPrice" | "vatRate">): number {
  return item.quantity * item.unitPrice * (1 + item.vatRate / 100);
}

function ReceiptItemRow({
  layout,
  compact,
  index,
  item,
  currency,
  canDelete,
  onChange,
  onRemove,
  t,
}: {
  layout: LineItemLayout;
  compact: boolean;
  index: number;
  item: ReceiptItem;
  currency: InvoiceCurrency;
  canDelete: boolean;
  onChange: (patch: Partial<ReceiptItem>) => void;
  onRemove: () => void;
  t: Translate;
}) {
  const icons = useIconColors();

  const unitOptions = React.useMemo(() => {
    const current = item.unit || "db";
    const units = UNIT_OPTIONS.includes(current) ? UNIT_OPTIONS : [current, ...UNIT_OPTIONS];
    return units.map((unit) => ({ value: unit, label: unit }));
  }, [item.unit]);

  const vatOptions = React.useMemo(() => {
    const rates: number[] = [...HU_VAT_RATES];
    if (!rates.includes(item.vatRate)) rates.unshift(item.vatRate);
    return rates.map((rate) => ({ value: String(rate), label: `${rate}%` }));
  }, [item.vatRate]);

  const description = (
    <Input className={CELL}>
      <InputField
        testID={`receipt-item-${index}-description`}
        accessibilityLabel={t("invoices.lineItemEditor.description")}
        placeholder={t("receipts.productPlaceholder")}
        value={item.description}
        onChangeText={(value) => onChange({ description: value })}
        className="min-w-0"
      />
    </Input>
  );

  const quantity = (
    <Input className={CELL}>
      <InputField
        testID={`receipt-item-${index}-quantity`}
        accessibilityLabel={t("invoices.lineItemEditor.quantity")}
        keyboardType="decimal-pad"
        value={String(item.quantity)}
        onChangeText={(value) => onChange({ quantity: Math.max(0, Number(value) || 0) })}
        className="min-w-0 text-right tabular-nums"
      />
    </Input>
  );

  const unit = (
    <ItemSelect
      value={item.unit || "db"}
      options={unitOptions}
      accessibilityLabel={t("invoices.fields.unit")}
      testID={`receipt-item-${index}-unit`}
      onChange={(next) => onChange({ unit: next })}
    />
  );

  const unitPrice = (
    <Input className={CELL}>
      <InputField
        testID={`receipt-item-${index}-unitPrice`}
        accessibilityLabel={t("receipts.netPrice")}
        placeholder={t("invoices.lineItemEditor.priceNet")}
        keyboardType="decimal-pad"
        value={String(item.unitPrice)}
        onChangeText={(value) => onChange({ unitPrice: Math.max(0, Number(value) || 0) })}
        className="min-w-0 text-right tabular-nums"
      />
    </Input>
  );

  const vat = (
    <ItemSelect
      value={String(item.vatRate)}
      options={vatOptions}
      accessibilityLabel={t("receipts.vatRate")}
      testID={`receipt-item-${index}-vat`}
      onChange={(next) => onChange({ vatRate: Number(next) })}
    />
  );

  const total = (
    <Text className="text-sm font-semibold tabular-nums text-ink" testID={`receipt-item-${index}-total`}>
      {formatCurrency(receiptLineGross(item), currency)}
    </Text>
  );

  const deleteButton = canDelete ? (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={t("invoices.lineItemEditor.deleteAction")}
      testID={`receipt-item-${index}-delete`}
      className="h-10 w-10 items-center justify-center rounded-control data-[hover=true]:bg-neutral-wash tab:h-[34px] tab:w-[34px]"
    >
      <Trash2 size={16} color={icons.muted} />
    </Pressable>
  ) : null;

  if (layout === "row") {
    return (
      <Box className="flex-row items-start gap-2 py-2" testID={`receipt-item-${index}-row`}>
        <Box className={colClass("description")}>{description}</Box>
        <Box className={colClass("quantity")}>{quantity}</Box>
        <Box className={colClass("unit")}>{unit}</Box>
        <Box className={colClass("unitPrice")}>{unitPrice}</Box>
        <Box className={colClass("vat")}>{vat}</Box>
        <Box className={`${colClass("total")} min-h-[38px] justify-center`}>{total}</Box>
        <Box className={`${colClass("actions")} h-[38px] justify-center`}>{deleteButton}</Box>
      </Box>
    );
  }

  const label = (text: string) => <Text className={LABEL_CLASS}>{text}</Text>;

  return (
    <Box className={`gap-3 py-3 ${index > 0 ? "border-t border-line" : ""}`} testID={`receipt-item-${index}-stacked`}>
      <Box className="flex-row items-start gap-2">
        <Box className="min-w-0 flex-1">
          {label(t("invoices.lineItemEditor.description"))}
          {description}
        </Box>
        <Box className="mt-[22px] h-[38px] justify-center">{deleteButton}</Box>
      </Box>
      <Box className="flex-row items-end gap-2" testID={`receipt-item-${index}-numbers`}>
        <Box className={compact ? "w-14" : "w-[72px]"}>
          {label(t("invoices.lineItemEditor.quantity"))}
          {quantity}
        </Box>
        <Box className={compact ? "w-[76px]" : "w-[84px]"}>
          {label(t("invoices.lineItemEditor.unitShort"))}
          {unit}
        </Box>
        <Box className="min-w-0 flex-1">
          {label(`${t("invoices.lineItemEditor.unitPrice")} (${t("invoices.lineItemEditor.priceNet")})`)}
          {unitPrice}
        </Box>
        <Box className={compact ? "w-[84px]" : "w-[96px]"}>
          {label(t("composer.receiptVatRate"))}
          {vat}
        </Box>
        {compact ? null : (
          <Box className="w-[112px] items-end">
            {label(t("invoices.lineItemEditor.amountColumn"))}
            <Box className="min-h-[38px] items-end justify-center">{total}</Box>
          </Box>
        )}
      </Box>
      {compact ? (
        <Box
          className="flex-row items-start justify-between gap-3 border-t border-dashed border-line-strong pt-2"
          testID={`receipt-item-${index}-total-line`}
        >
          <Text className="text-xs text-muted-ink">{t("invoices.lineItemEditor.amountColumn")}</Text>
          {total}
        </Box>
      ) : null}
    </Box>
  );
}

export function ReceiptItems({
  entryMode,
  onEntryModeChange,
  currency,
  totalAmount,
  onTotalAmountChange,
  items,
  onUpdate,
  onAdd,
  onRemove,
  totals,
  t,
}: {
  entryMode: ReceiptEntryMode;
  onEntryModeChange: (mode: ReceiptEntryMode) => void;
  currency: InvoiceCurrency;
  totalAmount: string;
  onTotalAmountChange: (value: string) => void;
  items: ReceiptItem[];
  onUpdate: (id: string, patch: Partial<ReceiptItem>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  /** Net / VAT-per-rate / gross of the detailed items (the receipt's own calculation). */
  totals: { netTotal: number; vatBreakdown: { vatRate: number; vatAmount: number }[]; grossTotal: number };
  t: Translate;
}) {
  const { width, onLayout } = useMeasuredWidth();
  const layout = lineItemLayoutForWidth(width);
  const compact = layout === "stacked" && isCompactWidth(width);

  return (
    <ComposerSection
      title={t("composer.receiptItemsTitle")}
      testID="composer-section-items"
      action={
        <SegmentedControl
          size="sm"
          value={entryMode}
          onChange={(value) => onEntryModeChange(value as ReceiptEntryMode)}
          accessibilityLabel={t("receipts.lineItems")}
          options={[
            { value: "simple", label: t("receipts.simpleMode"), testID: "receipt-mode-simple" },
            { value: "detailed", label: t("receipts.detailedMode"), testID: "receipt-mode-detailed" },
          ]}
          testID="receipt-entry-mode"
        />
      }
    >
      <Box onLayout={onLayout} testID="line-items-container">
        {entryMode === "simple" ? (
          <Box className="max-w-[320px]">
            <FormField label={t("receipts.amount")}>
              <Input className="h-[42px]">
                <InputField
                  testID="receipt-total-amount"
                  accessibilityLabel={t("receipts.amount")}
                  placeholder="0"
                  value={totalAmount}
                  onChangeText={onTotalAmountChange}
                  keyboardType="decimal-pad"
                  className="tabular-nums"
                />
              </Input>
            </FormField>
          </Box>
        ) : (
          <>
            {layout === "row" ? (
              <Box className="flex-row gap-2 pb-1" testID="line-items-grid-header">
                {COMPOSER_GRID_COLUMNS.map((col) => (
                  <Box key={col.key} className={col.className}>
                    {col.labelKey ? (
                      <Text
                        className={`text-xs text-muted-ink ${col.key === "total" ? "text-right" : ""} ${
                          col.key === "quantity" || col.key === "unitPrice" ? "pr-1" : ""
                        }`}
                      >
                        {col.key === "unitPrice"
                          ? `${t("invoices.lineItemEditor.unitPrice")} (${t("invoices.lineItemEditor.priceNet")})`
                          : col.key === "vat"
                            ? t("composer.receiptVatRate")
                            : t(col.labelKey)}
                      </Text>
                    ) : null}
                  </Box>
                ))}
              </Box>
            ) : null}

            <Box>
              {items.map((item, index) => (
                <ReceiptItemRow
                  key={item.id}
                  layout={layout}
                  compact={compact}
                  index={index}
                  item={item}
                  currency={currency}
                  canDelete={items.length > 1}
                  onChange={(patch) => onUpdate(item.id, patch)}
                  onRemove={() => onRemove(item.id)}
                  t={t}
                />
              ))}
            </Box>

            <Box className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-2">
              <Button variant="secondary" size="sm" onPress={onAdd} testID="receipt-add-item">
                <ButtonText>+ {t("composer.addItem")}</ButtonText>
              </Button>
            </Box>

            <ComposerTotals
              netLabel={t("receipts.netTotal")}
              net={totals.netTotal}
              vatRows={totals.vatBreakdown.map((entry) => ({
                key: String(entry.vatRate),
                label: t("receipts.vatRatePercent", { rate: entry.vatRate }),
                amount: entry.vatAmount,
              }))}
              grossLabel={t("receipts.grossTotal")}
              gross={totals.grossTotal}
              currency={currency}
            />
          </>
        )}
      </Box>
    </ComposerSection>
  );
}
