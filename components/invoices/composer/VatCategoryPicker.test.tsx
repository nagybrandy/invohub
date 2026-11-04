// components/invoices/composer/VatCategoryPicker.test.tsx
// The ÁFA cell is ONE select (redesign 2026-11): taxed rates first, then the
// special categories by their full names; the closed field stays short.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { VatCategoryPicker } from "@/components/invoices/composer/VatCategoryPicker";
import { VAT_CATEGORIES, VAT_RATES } from "@/lib/invoices/vat";

type SelectProps = {
  value: string;
  display?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  accessibilityLabel: string;
};
let lastSelect: SelectProps | null = null;
jest.mock("@/components/invoices/composer/ItemSelect", () => ({
  ItemSelect: (props: SelectProps) => {
    lastSelect = props;
    return null;
  },
}));

const t = (key: string) => key;

function render(props: Partial<React.ComponentProps<typeof VatCategoryPicker>> = {}) {
  const onChange = props.onChange ?? jest.fn();
  act(() => {
    TestRenderer.create(
      <VatCategoryPicker category={props.category ?? "normal"} rate={props.rate ?? 27} onChange={onChange} t={t} />
    );
  });
  return { select: lastSelect!, onChange };
}

describe("VatCategoryPicker", () => {
  beforeEach(() => {
    lastSelect = null;
  });

  it("offers every taxed rate and every special category, nothing else", () => {
    const { select } = render();
    const values = select.options.map((o) => o.value);
    for (const rate of VAT_RATES) expect(values).toContain(`normal:${rate}`);
    for (const category of VAT_CATEGORIES.filter((c) => c !== "normal")) expect(values).toContain(category);
    expect(values).toHaveLength(VAT_RATES.length + VAT_CATEGORIES.length - 1);
  });

  it("lists the rates first (highest to lowest), then the categories with their full existing names", () => {
    const { select } = render();
    expect(select.options.slice(0, 4).map((o) => o.label)).toEqual(["27%", "18%", "5%", "0%"]);
    expect(select.options.find((o) => o.value === "AAM")?.label).toBe("invoices.vat.category.AAM");
    expect(select.options.find((o) => o.value === "FAD")?.label).toBe("invoices.vat.category.FAD");
  });

  it("keeps the closed field short: the rate for a taxed line, the code for a special one", () => {
    expect(render({ category: "normal", rate: 18 }).select.display).toBe("18%");
    expect(render({ category: "AAM", rate: 0 }).select.display).toBe("AAM");
  });

  it("selects the current treatment and labels itself 'ÁFA kezelés'", () => {
    const taxed = render({ category: "normal", rate: 5 }).select;
    expect(taxed.value).toBe("normal:5");
    expect(taxed.accessibilityLabel).toBe("invoices.vat.categoryLabel");
    expect(render({ category: "TAM", rate: 0 }).select.value).toBe("TAM");
  });

  it("reports a rate pick as one change: category normal with that rate", () => {
    const { select, onChange } = render({ category: "AAM", rate: 0 });
    act(() => select.onChange("normal:18"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ category: "normal", rate: 18 });
  });

  it("reports a special category pick as category with a 0% rate", () => {
    const { select, onChange } = render({ category: "normal", rate: 27 });
    act(() => select.onChange("AAM"));
    expect(onChange).toHaveBeenCalledWith({ category: "AAM", rate: 0 });
  });
});
