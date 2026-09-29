// components/invoices/composer/StepLineItems.tsx
// Step 2: an inline-editable grid (spec §2.4) when the form column is wide
// enough, compact per-line cards otherwise. The choice is CONTAINER-driven
// (responsive-line-item-grid): the form column is measured with onLayout,
// because the window width ignores the app sidebar and the live PDF side
// preview (≈620px column on a 1440px laptop with both open). Neither layout
// ever scrolls sideways — the totals bar below
// the grid is sticky and carries the "Előnézet" previewSlot (a drawer with
// the live PDF) whenever the composer's side PDF panel isn't shown
// (< 1024px or hidden — see docs/decisions/2026-09-22-single-live-pdf-preview.md).
import * as React from "react";
import type { LayoutChangeEvent } from "react-native";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { LineItemRow } from "@/components/invoices/composer/LineItemRow";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { COMPOSER_GRID_COLUMNS, lineItemLayoutForWidth } from "@/components/invoices/composer/grid-columns";
import { TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency, InvoiceLineItem } from "@/lib/invoices/types";
import type { Product } from "@/lib/products/service";

export function StepLineItems({
  lineItems,
  currency,
  products,
  onUpdate,
  onAdd,
  onAddFromProduct,
  onRemove,
  previewSlot,
  isModification = false,
  t,
}: {
  lineItems: InvoiceLineItem[];
  currency: InvoiceCurrency;
  products: Product[];
  onUpdate: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onAdd: () => void;
  onAddFromProduct: (product: Product) => void;
  onRemove: (id: string) => void;
  /** "Teljes előnézet" button, rendered in the sticky totals bar (AC10). */
  previewSlot?: React.ReactNode;
  /**
   * Helyesbítő (modify) draft: it starts as reversing line + editable copy
   * per original line (lib/invoices/modification-lines.ts). Shows the hint
   * and lets a quantity stay negative instead of being clamped to 0.
   */
  isModification?: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totals = calculateInvoiceTotals(lineItems);
  const vatRows = groupVatRows(lineItems);
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState<number | null>(null);
  const layout = lineItemLayoutForWidth(containerWidth);
  const isCard = layout === "card";

  const handleLayout = React.useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === width ? prev : width));
  }, []);

  const buttonClass = `${TAP_TARGET_MIN_H} items-center justify-center rounded-lg border border-border bg-card px-4 py-2`;

  return (
    <VStack space="md" onLayout={handleLayout} testID="line-items-container">
      {isModification ? (
        <VStack className="rounded-lg border border-border bg-muted/50 px-3 py-2" testID="modification-draft-hint">
          <Text size="sm" className="text-foreground">
            {t("invoices.correction.draftHint")}
          </Text>
        </VStack>
      ) : null}
      {/* Grid only when the measured column fits the full row
          (composerGridMinWidth = 860px); otherwise every line is a
          compact card — no min-width, no horizontal scroll. */}
      <VStack space={isCard ? "sm" : "md"}>
        {isCard ? null : (
          <HStack space="sm" className="border-b border-subtle pb-2" testID="line-items-grid-header">
            {COMPOSER_GRID_COLUMNS.map((col) => (
              <VStack key={col.key} className={col.className}>
                {col.labelKey ? (
                  <Text size="xs" className="font-medium uppercase tracking-wide text-muted-foreground">
                    {t(col.labelKey)}
                  </Text>
                ) : null}
              </VStack>
            ))}
          </HStack>
        )}

        <VStack space={isCard ? "sm" : "xs"}>
          {lineItems.map((item, index) => (
            <LineItemRow
              key={item.id}
              layout={layout}
              index={index}
              item={item}
              currency={currency}
              products={products}
              canDelete={lineItems.length > 1}
              allowNegativeQuantity={isModification}
              onChange={(patch) => onUpdate(item.id, patch)}
              onRemove={() => onRemove(item.id)}
              onFillFromProduct={(product) => onUpdate(item.id, {
                description: product.name,
                unitPrice: product.unitPrice,
                unit: product.unit ?? "db",
              })}
              t={t}
            />
          ))}
        </VStack>
      </VStack>

      <HStack space="sm" className={isCard ? "flex-col" : "flex-wrap"}>
        <Pressable onPress={onAdd} className={isCard ? `w-full ${buttonClass}` : buttonClass}>
          <Text size="sm" className="font-medium text-foreground">
            {t("invoices.lineItemEditor.addLineItem")}
          </Text>
        </Pressable>
        <VStack className={isCard ? "relative w-full" : "relative"}>
          <Pressable
            onPress={() => setCatalogOpen((v) => !v)}
            className={isCard ? `w-full ${buttonClass}` : buttonClass}
          >
            <Text size="sm" className="font-medium text-foreground">
              {t("invoices.composer.addFromCatalog")}
            </Text>
          </Pressable>
          {catalogOpen ? (
            <VStack className="absolute top-11 z-10 w-64 max-w-full rounded-lg border border-border bg-card shadow-sm">
              {products.length === 0 ? (
                <Text size="sm" className="px-3 py-2 text-muted-foreground">
                  {t("invoices.composer.noProducts")}
                </Text>
              ) : (
                products.map((product) => (
                  <Pressable
                    key={product.id}
                    onPress={() => {
                      onAddFromProduct(product);
                      setCatalogOpen(false);
                    }}
                    className={`${TAP_TARGET_MIN_H} justify-center border-b border-subtle px-3 py-2 last:border-b-0`}
                  >
                    <Text size="sm">{product.name}</Text>
                  </Pressable>
                ))
              )}
            </VStack>
          ) : null}
        </VStack>
      </HStack>

      {/* Sticky totals bar: live totals stay one glance away and the
          "Előnézet" (live PDF) one click away, now that step 2 has no
          sticky ComposerSummary column beside it (INV-9, INV-13 both hold —
          docs/decisions/2026-09-18-composer-items-step-full-width-grid.md). */}
      <HStack
        className="w-full flex-wrap items-end justify-between gap-3 border-t border-subtle pt-3 md:sticky md:bottom-0 md:z-10 md:bg-background"
        space="sm"
      >
        {previewSlot ? <VStack className="hidden md:flex">{previewSlot}</VStack> : null}
        <VStack className="ml-auto items-end gap-1" space="xs">
          <HStack className="w-full max-w-[280px] justify-between gap-4 md:w-[280px]">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.totals.netTotal")}
            </Text>
            <Text size="sm" className="tabular-nums text-foreground">
              {formatCurrency(totals.subtotal, currency)}
            </Text>
          </HStack>
          {vatRows.map((row) => (
            <HStack key={row.key} className="w-full max-w-[280px] justify-between gap-4 md:w-[280px]">
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.composer.vatRowLabel", { label: row.label })}
              </Text>
              <Text size="sm" className="tabular-nums text-foreground">
                {formatCurrency(row.vat, currency)}
              </Text>
            </HStack>
          ))}
          <HStack className="w-full max-w-[280px] justify-between gap-4 md:w-[280px]">
            <Text size="sm" className="font-semibold text-foreground">
              {t("invoices.totals.grossTotal")}
            </Text>
            <Text size="sm" className="font-semibold tabular-nums text-foreground">
              {formatCurrency(totals.totalAmount, currency)}
            </Text>
          </HStack>
        </VStack>
      </HStack>
    </VStack>
  );
}
