// __tests__/screens/settings/billing.test.tsx
// Számlázási beállítások: loads the stored profile into the form and saves
// exactly what the owner chose (null clears a value).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockSave = jest.fn(async (input: unknown) => input);
let mockCompany: Record<string, unknown> | null = null;

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: mockCompany, loading: false, save: mockSave }),
}));
jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => {
    const { View } = require("react-native");
    return (
      <View>
        {header}
        {children}
      </View>
    );
  },
}));
for (const m of ["button", "card", "heading", "pressable", "text", "vstack", "hstack"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}
// The dropdown is exercised through its onChange (the native one opens a sheet).
jest.mock("@/components/ui/select", () => ({
  Select: (props: Record<string, unknown>) => {
    const { View } = require("react-native");
    return <View {...props} />;
  },
}));
jest.mock("@/hooks/useSupportedCurrencies", () => ({ useSupportedCurrencies: () => ["HUF", "EUR"] }));
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return { Input: View, InputField: (props: Record<string, unknown>) => <TextInput {...props} /> };
});
jest.mock("@/components/ui/textarea", () => {
  const { TextInput, View } = require("react-native");
  return { Textarea: View, TextareaInput: (props: Record<string, unknown>) => <TextInput {...props} /> };
});

import BillingSettingsScreen from "@/app/(app)/settings/billing";

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<BillingSettingsScreen />);
  });
  const byId = (id: string) => tree.root.findAll((n) => n.props?.testID === id)[0];
  /** Pick a value in one of the dropdowns ("" is the "Nincs megadva" row). */
  const choose = (id: string, value: string) => act(() => {
      // The innermost match is the Select itself (OptionSelect maps "" to "not set").
      const matches = tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onChange === "function");
      matches[matches.length - 1].props.onChange(value);
    });
  return { tree, byId, choose };
}

describe("BillingSettingsScreen", () => {
  beforeEach(() => {
    mockSave.mockClear();
    mockCompany = {
      id: "c1", name: "Demo Kft.", taxMode: "tao", vatRegime: "monthly", invoicePrefix: "SG",
      defaultPaymentTermDays: 15, defaultVatRate: 27, defaultNote: "Régi megjegyzés",
    };
  });

  it("loads the stored profile into the form", () => {
    const { byId } = render();
    expect(byId("billing-prefix-input").props.value).toBe("SG");
    expect(byId("billing-term-days").props.value).toBe("15");
    expect(byId("billing-note").props.value).toBe("Régi megjegyzés");
  });

  it("saves the choices, normalising the prefix and clearing what was cleared", async () => {
    const { byId, choose } = render();
    choose("billing-tax-mode", "kiva"); // switch TAO -> KIVA
    choose("billing-vat-regime", ""); // the "not set" row clears it
    act(() => byId("billing-prefix-input").props.onChangeText("dc"));
    act(() => byId("billing-term-days").props.onChangeText("30"));
    choose("billing-language", "en");
    await act(async () => {
      byId("billing-save").props.onPress();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      name: "Demo Kft.", taxMode: "kiva", vatRegime: null, invoicePrefix: "DC",
      defaultPaymentTermDays: 30, defaultLanguage: "en", defaultVatRate: 27, defaultNote: "Régi megjegyzés",
    });
  });

  it("shows the sticky save bar only while there are unsaved changes", () => {
    const { byId, tree } = render();
    const hasBar = () => tree.root.findAll((n) => n.props?.testID === "billing-save").length > 0;
    expect(hasBar()).toBe(false);
    act(() => byId("billing-term-days").props.onChangeText("30"));
    expect(hasBar()).toBe(true);
    act(() => byId("billing-term-days").props.onChangeText("15"));
    expect(hasBar()).toBe(false);
  });

  it("discard puts the saved values back", () => {
    const { byId } = render();
    act(() => byId("billing-term-days").props.onChangeText("45"));
    act(() => byId("settings-discard").props.onPress());
    expect(byId("billing-term-days").props.value).toBe("15");
  });

  it("blocks saving an invalid prefix and shows the live example", () => {
    const { byId } = render();
    act(() => byId("billing-prefix-input").props.onChangeText("a-b"));
    expect(byId("billing-save").props.disabled).toBe(true);
    act(() => byId("billing-prefix-input").props.onChangeText("dc"));
    expect(byId("billing-save").props.disabled).toBe(false);
    expect(JSON.stringify(byId("billing-prefix-example").props.children)).toBeDefined();
  });

  it("asks for the company profile first when there is none", () => {
    mockCompany = null;
    const { tree } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("billing.needCompany");
  });
});
