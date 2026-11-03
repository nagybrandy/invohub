// components/settings/ThemeCards.test.tsx
// Világos / Sötét / Rendszer szerint: a radiogroup with one tab stop. Arrow
// keys move and select, Home / End jump, pressing the chosen card does nothing.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ThemeCards } from "@/components/settings/ThemeCards";
import type { ThemePreference } from "@/lib/theme-preference";

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
for (const m of ["box", "pressable", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}

const OPTIONS = [
  { value: "light" as const, label: "Világos" },
  { value: "dark" as const, label: "Sötét" },
  { value: "system" as const, label: "Rendszer szerint" },
];

function render(value: ThemePreference = "system") {
  const onChange = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeCards value={value} onChange={onChange} options={OPTIONS} accessibilityLabel="Téma" />,
    );
  });
  const card = (v: string) => tree.root.findAll((n) => n.props?.testID === `theme-cards-${v}` && n.props.accessibilityRole === "radio")[0];
  return { tree, onChange, card };
}

describe("ThemeCards", () => {
  it("is a radiogroup of three radios, exactly one checked", () => {
    const { tree, card } = render("dark");
    const group = tree.root.findAll((n) => n.props?.accessibilityRole === "radiogroup")[0];
    expect(group.props.accessibilityLabel).toBe("Téma");
    expect(card("light").props.accessibilityState.checked).toBe(false);
    expect(card("dark").props.accessibilityState.checked).toBe(true);
    expect(card("system").props.accessibilityState.checked).toBe(false);
    expect(card("dark").props.accessibilityLabel).toBe("Sötét");
  });

  it("picking another card reports its value", () => {
    const { card, onChange } = render("system");
    act(() => card("dark").props.onPress());
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("pressing the card that is already chosen changes nothing", () => {
    const { card, onChange } = render("light");
    act(() => card("light").props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("arrow keys move and select, wrapping at the ends", () => {
    const { card, onChange } = render("light");
    act(() => card("light").props.onKeyDown({ key: "ArrowRight", preventDefault: jest.fn() }));
    expect(onChange).toHaveBeenLastCalledWith("dark");
    act(() => card("light").props.onKeyDown({ key: "ArrowLeft", preventDefault: jest.fn() }));
    expect(onChange).toHaveBeenLastCalledWith("system");
  });

  it("Home and End jump to the first and last card", () => {
    const { card, onChange } = render("dark");
    act(() => card("dark").props.onKeyDown({ key: "End", preventDefault: jest.fn() }));
    expect(onChange).toHaveBeenLastCalledWith("system");
    act(() => card("dark").props.onKeyDown({ key: "Home", preventDefault: jest.fn() }));
    expect(onChange).toHaveBeenLastCalledWith("light");
  });

  it("ignores other keys", () => {
    const { card, onChange } = render("dark");
    act(() => card("dark").props.onKeyDown({ key: "a", preventDefault: jest.fn() }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
