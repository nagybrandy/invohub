import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { CurrencyPicker } from "@/components/settings/CurrencyPicker";

let mockCurrencies = ["HUF", "EUR", "USD", "GBP", "CHF", "PLN"];
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock("@/hooks/useSupportedCurrencies", () => ({ useSupportedCurrencies: () => mockCurrencies }));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(value: string | undefined, clearable = false) {
  const onChange = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<CurrencyPicker value={value} onChange={onChange} clearable={clearable} testIDPrefix="c" />);
  });
  const find = (id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPress === "function")[0];
  return { tree, onChange, find };
}

describe("CurrencyPicker", () => {
  it("shows HUF, EUR, USD, GBP as chips and hides the rest behind 'other'", () => {
    const { find } = render("HUF");
    for (const c of ["HUF", "EUR", "USD", "GBP"]) expect(find(`c-${c}`)).toBeDefined();
    expect(find("c-CHF")).toBeUndefined();
    act(() => find("c-more").props.onPress());
    expect(find("c-CHF")).toBeDefined();
  });

  it("picks a primary and an 'other' currency (closing the list)", () => {
    const { find, onChange } = render("HUF");
    act(() => find("c-USD").props.onPress());
    expect(onChange).toHaveBeenLastCalledWith("USD");
    act(() => find("c-more").props.onPress());
    act(() => find("c-PLN").props.onPress());
    expect(onChange).toHaveBeenLastCalledWith("PLN");
    expect(find("c-PLN")).toBeUndefined(); // list closed again
  });

  it("keeps a selected non-primary currency visible as a chip", () => {
    const { find } = render("CHF");
    expect(find("c-CHF")).toBeDefined();
  });

  it("clears on the second press only when clearable", () => {
    const a = render("EUR", true);
    act(() => a.find("c-EUR").props.onPress());
    expect(a.onChange).toHaveBeenCalledWith(undefined);
    const b = render("EUR", false);
    act(() => b.find("c-EUR").props.onPress());
    expect(b.onChange).toHaveBeenCalledWith("EUR");
  });

  it("offers no 'other' button when the list has only the primaries", () => {
    mockCurrencies = ["HUF", "EUR", "USD", "GBP"];
    const { find } = render("HUF");
    expect(find("c-more")).toBeUndefined();
    mockCurrencies = ["HUF", "EUR", "USD", "GBP", "CHF", "PLN"];
  });
});
