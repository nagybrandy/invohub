// components/invoices/composer/StepLineItems.tsx
// "Mit számlázol?" — the line items section of the one-page composer
// (redesign 2026-11, SPEC §8.5): a header line and one row per item when the
// section is wide enough, Megnevezés-over-numbers cards otherwise (the choice
// is CONTAINER-driven: the section measures itself with onLayout, the window
// width ignores the sidebar and the preview column). Below the rows: "+ Új
// tétel", the "Gyors hozzáadás" chips (the user's first five products) and the
// totals block. The "Bruttó összegek megadása" switch flips the unit-price
// field between net and gross entry (the stored price is always net).
import * as React from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { ComposerSection } from "@/components/invoices/composer/ComposerSection";
import { ComposerTotals } from "@/components/invoices/composer/ComposerTotals";
import { LineItemRow } from "@/components/invoices/composer/LineItemRow";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { QUICK_PRODUCT_COUNT } from "@/components/invoices/composer/composer-view";
import {
  COMPOSER_GRID_COLUMNS,
  isCompactWidth,
  lineItemLayoutForWidth,
} from "@/components/invoices/composer/grid-columns";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { InvoiceCurrency, InvoiceLineItem } from "@/lib/invoices/types";
import type { UnitPriceMode } from "@/lib/invoices/unit-price";
import type { Product } from "@/lib/products/service";
import { useMeasuredWidth } from "@/lib/ui/use-measured-width";

export function StepLineItems({
  lineItems,
  currency,
  products,
  onUpdate,
  onAdd,
  onAddFromProduct,
  onRemove,
  isModification = false,
  error,
  focusField,
  onFocusHandled,
  t,
}: {
  lineItems: InvoiceLineItem[];
  currency: InvoiceCurrency;
  products: Product[];
  onUpdate: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onAdd: () => void;
  onAddFromProduct: (product: Product) => void;
  onRemove: (id: string) => void;
  /**
   * Helyesbítő (modify) draft: it starts as reversing line + editable copy
   * per original line (lib/invoices/modification-lines.ts). Shows the hint
   * and lets a quantity stay negative instead of being clamped to 0.
   */
  isModification?: boolean;
  /** "Legalább egy tételt adj meg." — shown under the rows. */
  error?: string;
  /** The composer's focusField; "lineItem-0-description" focuses the first description. */
  focusField?: string | null;
  onFocusHandled?: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totals = calculateInvoiceTotals(lineItems);
  const vatRows = groupVatRows(lineItems);
  const [priceMode, setPriceMode] = React.useState<UnitPriceMode>("net");
  const { width, onLayout } = useMeasuredWidth();
  const layout = lineItemLayoutForWidth(width);
  const compact = layout === "stacked" && isCompactWidth(width);
  const quickProducts = products.slice(0, QUICK_PRODUCT_COUNT);
  const grossEntry = priceMode === "gross";

  const unitPriceHeader = `${t("invoices.lineItemEditor.unitPrice")} (${t(
    grossEntry ? "invoices.lineItemEditor.priceGross" : "invoices.lineItemEditor.priceNet"
  )})`;

  return (
    <ComposerSection
      title={t("invoices.sections.lineItems")}
      testID="composer-section-items"
      action={
        <HStack className="items-center gap-2" testID="unit-price-mode">
          <Text className="text-[13px] font-semibold text-ink">{t("invoices.fields.grossToggle")}</Text>
          <Switch
            value={grossEntry}
            onValueChange={(on) => setPriceMode(on ? "gross" : "net")}
            accessibilityLabel={t("invoices.fields.grossToggle")}
            testID="unit-price-mode-switch"
          />
        </HStack>
      }
    >
      <Box onLayout={onLayout} testID="line-items-container">
        {isModification ? (
          <Box
            className="mb-3 rounded-control border border-line-strong bg-neutral-wash px-3 py-2"
            testID="modification-draft-hint"
          >
            <Text className="text-sm text-ink">{t("invoices.correction.draftHint")}</Text>
          </Box>
        ) : null}

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
                    {col.key === "unitPrice" ? unitPriceHeader : t(col.labelKey)}
                  </Text>
                ) : null}
              </Box>
            ))}
          </Box>
        ) : null}

        <Box>
          {lineItems.map((item, index) => (
            <LineItemRow
              key={item.id}
              layout={layout}
              compact={compact}
              index={index}
              item={item}
              currency={currency}
              products={products}
              canDelete={lineItems.length > 1}
              allowNegativeQuantity={isModification}
              priceMode={priceMode}
              focusDescription={index === 0 && focusField === "lineItem-0-description"}
              onFocusHandled={onFocusHandled}
              onChange={(patch) => onUpdate(item.id, patch)}
              onRemove={() => onRemove(item.id)}
              onFillFromProduct={(product) =>
                onUpdate(item.id, {
                  description: product.name,
                  unitPrice: product.unitPrice,
                  unit: product.unit ?? "db",
                })
              }
              t={t}
            />
          ))}
        </Box>

        {error ? (
          <Text accessibilityRole="alert" className="mt-2 text-[13px] font-semibold text-err" testID="composer-items-error">
            {error}
          </Text>
        ) : null}

        <Box className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-2">
          <Button variant="secondary" size="sm" onPress={onAdd} testID="composer-add-item">
            <ButtonText>+ {t("composer.addItem")}</ButtonText>
          </Button>
          {quickProducts.length > 0 ? (
            <Box className="flex-row flex-wrap items-center gap-2" testID="composer-quick-add">
              <Text className="text-[13px] text-muted-ink">{t("composer.quickAdd")}</Text>
              {quickProducts.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => onAddFromProduct(product)}
                  accessibilityRole="button"
                  testID={`composer-quick-add-${product.id}`}
                  className="min-h-10 justify-center rounded-full border border-dashed border-line-strong px-3 data-[hover=true]:bg-neutral-wash"
                >
                  <Text className="text-[13px] text-ink">{product.name}</Text>
                </Pressable>
              ))}
            </Box>
          ) : null}
        </Box>

        <ComposerTotals
          netLabel={t("invoices.totals.netTotal")}
          net={totals.subtotal}
          vatRows={
            vatRows.length > 0
              ? vatRows.map((row) => ({
                  key: row.key,
                  label: t("invoices.composer.vatRowLabel", { label: row.label }),
                  amount: row.vat,
                }))
              : [{ key: "empty", label: t("invoices.composer.vatRowEmpty"), amount: 0 }]
          }
          grossLabel={t("invoices.totals.grossTotal")}
          gross={totals.totalAmount}
          currency={currency}
        />
      </Box>
    </ComposerSection>
  );
}
