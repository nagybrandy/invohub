// components/invoices/composer/VatCategoryPicker.tsx
// The ÁFA cell of a line item: ONE select (redesign 2026-11, tokens.md §6.18)
// instead of the category pills + rate pills + "Speciális adózás" expander of
// INV-7. The list offers the taxed rates (27 / 18 / 5 / 0 %) first, then the
// special categories (AAM, TAM, ...) by their full NAV names; the closed field
// stays short ("27%", "AAM"). The categories and their tax meaning are
// unchanged (lib/invoices/vat.ts) — only the control is.
import * as React from "react";
import { ItemSelect } from "@/components/invoices/composer/ItemSelect";
import { parseVatSelectValue, vatSelectValue } from "@/components/invoices/composer/composer-view";
import { ADVANCED_VAT_CATEGORIES, COMMON_VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";
import type { VatCategory, VatRate } from "@/lib/invoices/types";

/** Taxed rates, highest first, as they read in an invoice dropdown. */
const RATE_OPTIONS_DESC: VatRate[] = [...VAT_RATES].sort((a, b) => b - a);

/** The exempt / special categories, the common one (AAM) first. */
const SPECIAL_CATEGORIES: VatCategory[] = [...COMMON_VAT_CATEGORIES, ...ADVANCED_VAT_CATEGORIES].filter(
  (category) => category !== "normal"
);

export function VatCategoryPicker({
  category,
  rate,
  onChange,
  t,
  testID,
  className,
}: {
  category: VatCategory;
  rate: VatRate;
  onChange: (next: { category: VatCategory; rate: VatRate }) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  testID?: string;
  className?: string;
}) {
  const options = React.useMemo(
    () => [
      ...RATE_OPTIONS_DESC.map((r) => ({ value: vatSelectValue("normal", r), label: `${r}%` })),
      ...SPECIAL_CATEGORIES.map((c) => ({ value: vatSelectValue(c, 0), label: t(`invoices.vat.category.${c}`) })),
    ],
    [t]
  );

  const current = vatSelectValue(category, rate);
  const display = category === "normal" ? `${rate}%` : category;

  return (
    <ItemSelect
      value={current}
      display={display}
      options={options}
      accessibilityLabel={t("invoices.vat.categoryLabel")}
      testID={testID}
      className={className}
      onChange={(value) => {
        const next = parseVatSelectValue(value);
        if (next.category === "normal") {
          onChange({ category: "normal", rate: (next.rate ?? 27) as VatRate });
        } else {
          onChange({ category: next.category as VatCategory, rate: 0 });
        }
      }}
    />
  );
}
