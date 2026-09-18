// components/invoices/composer/StepLineItems.tsx
// Step 2: an inline-editable grid instead of a stack of per-line cards
// (spec §2.4). Desktop column header + rows; mobile falls back to cards
// inside LineItemRow itself. On desktop this step spans the full content
// width (composer-line-item-horizontal-scroll-1440) — the totals bar below
// the grid is sticky and carries the "Teljes előnézet" previewSlot, since
// the 400px ComposerSummary that used to show both isn't rendered here.
import * as React from "react";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { LineItemRow } from "@/components/invoices/composer/LineItemRow";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { COMPOSER_GRID_COLUMNS, composerGridMinWidth } from "@/components/invoices/composer/grid-columns";
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
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totals = calculateInvoiceTotals(lineItems);
  const vatRows = groupVatRows(lineItems);
  const [catalogOpen, setCatalogOpen] = React.useState(false);

  return (
    <VStack space="md">
      {/* The grid's row (description + 5 more columns, composerGridMinWidth
          = 860px) fits the full content column at 1440px now that the
          items step has no 720px form cap or 400px summary beside it
          (composerDesktopLayout, composer-line-item-horizontal-scroll-1440).
          Below ~1188px it still scrolls horizontally within its own card
          instead of overflowing the page — accepted, see the plan's "Out
          of scope". */}
      <VStack className="md:overflow-x-auto">
        <VStack style={{ minWidth: composerGridMinWidth() }} space="md">
          <HStack space="sm" className="hidden border-b border-subtle pb-2 md:flex">
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

          <VStack space="xs">
            {lineItems.map((item, index) => (
              <LineItemRow
                key={item.id}
                index={index}
                item={item}
                currency={currency}
                products={products}
                canDelete={lineItems.length > 1}
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
      </VStack>

      <HStack space="sm" className="flex-wrap">
        <Pressable onPress={onAdd} className="rounded-lg border border-border bg-card px-4 py-2">
          <Text size="sm" className="font-medium text-foreground">
            {t("invoices.lineItemEditor.addLineItem")}
          </Text>
        </Pressable>
        <VStack className="relative">
          <Pressable
            onPress={() => setCatalogOpen((v) => !v)}
            className="rounded-lg border border-border bg-card px-4 py-2"
          >
            <Text size="sm" className="font-medium text-foreground">
              {t("invoices.composer.addFromCatalog")}
            </Text>
          </Pressable>
          {catalogOpen ? (
            <VStack className="absolute top-11 z-10 w-64 rounded-lg border border-border bg-card shadow-sm">
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
                    className="border-b border-subtle px-3 py-2 last:border-b-0"
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
          "Teljes előnézet" preview one click away, now that step 2 has no
          sticky ComposerSummary column beside it (INV-9, INV-13 both hold —
          docs/decisions/2026-09-18-composer-items-step-full-width-grid.md). */}
      <HStack
        className="w-full flex-wrap items-end justify-between gap-3 border-t border-subtle pt-3 md:sticky md:bottom-0 md:z-10 md:bg-background"
        space="sm"
      >
        {previewSlot ? <VStack>{previewSlot}</VStack> : null}
        <VStack className="ml-auto items-end gap-1" space="xs">
          <HStack className="w-full max-w-[280px] justify-between md:w-[280px]">
            <Text size="sm" className="text-muted-foreground">
              {t("invoices.totals.netTotal")}
            </Text>
            <Text size="sm" className="tabular-nums text-foreground">
              {formatCurrency(totals.subtotal, currency)}
            </Text>
          </HStack>
          {vatRows.map((row) => (
            <HStack key={row.key} className="w-full max-w-[280px] justify-between md:w-[280px]">
              <Text size="sm" className="text-muted-foreground">
                {t("invoices.composer.vatRowLabel", { label: row.label })}
              </Text>
              <Text size="sm" className="tabular-nums text-foreground">
                {formatCurrency(row.vat, currency)}
              </Text>
            </HStack>
          ))}
          <HStack className="w-full max-w-[280px] justify-between md:w-[280px]">
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
