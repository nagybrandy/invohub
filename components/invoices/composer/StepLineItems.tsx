// components/invoices/composer/StepLineItems.tsx
// Step 2: an inline-editable grid instead of a stack of per-line cards
// (spec §2.4). Desktop column header + rows; mobile falls back to cards
// inside LineItemRow itself.
import * as React from "react";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { VStack } from "@/components/ui/vstack";
import { LineItemRow } from "@/components/invoices/composer/LineItemRow";
import { groupVatRows } from "@/components/invoices/composer/composer-logic";
import { calculateInvoiceTotals, formatCurrency } from "@/lib/invoices/calculations";
import type { InvoiceCurrency, InvoiceLineItem } from "@/lib/invoices/types";
import type { Product } from "@/lib/products/service";

const HEADER_COLUMNS: { key: string; labelKey: string; className: string }[] = [
  { key: "description", labelKey: "invoices.lineItemEditor.description", className: "min-w-[240px] flex-1" },
  { key: "quantity", labelKey: "invoices.lineItemEditor.quantity", className: "w-[88px]" },
  { key: "unit", labelKey: "invoices.fields.unit", className: "w-[96px]" },
  { key: "unitPrice", labelKey: "invoices.lineItemEditor.unitPrice", className: "w-[140px]" },
  { key: "vat", labelKey: "invoices.vat.categoryLabel", className: "w-[160px]" },
  { key: "net", labelKey: "invoices.totals.netTotal", className: "w-[132px] items-end" },
  { key: "gross", labelKey: "invoices.totals.grossTotal", className: "w-[140px] items-end" },
  { key: "menu", labelKey: "", className: "w-11" },
];

export function StepLineItems({
  lineItems,
  currency,
  products,
  onUpdate,
  onAdd,
  onAddFromProduct,
  onRemove,
  t,
}: {
  lineItems: InvoiceLineItem[];
  currency: InvoiceCurrency;
  products: Product[];
  onUpdate: (id: string, patch: Partial<InvoiceLineItem>) => void;
  onAdd: () => void;
  onAddFromProduct: (product: Product) => void;
  onRemove: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const totals = calculateInvoiceTotals(lineItems);
  const vatRows = groupVatRows(lineItems);
  const [catalogOpen, setCatalogOpen] = React.useState(false);

  return (
    <VStack space="md">
      {/* The grid's row (description + 6 more columns) is naturally wider
          than the 720px form-field cap — it scrolls horizontally within its
          own card on narrower desktop widths instead of overflowing the
          page (spec §2.4 shows the full row; AC15's 720px cap is about
          individual fields, not this table). */}
      <VStack className="md:overflow-x-auto">
        <VStack className="md:min-w-[1040px]" space="md">
          <HStack space="sm" className="hidden border-b border-subtle pb-2 md:flex">
            {HEADER_COLUMNS.map((col) => (
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

      <VStack className="items-end gap-1 border-t border-subtle pt-3" space="xs">
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
    </VStack>
  );
}
