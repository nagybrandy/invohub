// components/clients/TaxNumberLookupField.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TaxNumberLookupField } from "@/components/clients/TaxNumberLookupField";

const mockLookup = { lookup: jest.fn(), loading: false, error: null as string | null };
jest.mock("@/hooks/useTaxpayerLookup", () => ({ useTaxpayerLookup: () => mockLookup }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Lazy requires: the component import is hoisted above any module-level const.
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    Button: ({ children, onPress, disabled, testID }: any) => (
      <Pressable testID={testID} onPress={onPress} disabled={disabled}>{children}</Pressable>
    ),
    ButtonText: ({ children }: any) => <Text>{children}</Text>,
    ButtonSpinner: () => <View testID="spinner" />,
  };
});
jest.mock("@/components/ui/form-control", () => {
  const { Text, View } = require("react-native");
  return {
    FormControl: ({ children }: any) => <View>{children}</View>,
    FormControlLabel: ({ children }: any) => <View>{children}</View>,
    FormControlLabelText: ({ children }: any) => <Text>{children}</Text>,
  };
});
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return {
    Input: ({ children }: any) => <View>{children}</View>,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  mockLookup.lookup.mockReset();
  mockLookup.error = null;
});

describe("TaxNumberLookupField", () => {
  it("hands the taxpayer to the parent on a hit", async () => {
    mockLookup.lookup.mockResolvedValue({ name: "Minta Kft.", city: "Budapest" });
    const onFound = jest.fn();
    const tree = render(<TaxNumberLookupField value="12345678-1-42" onChangeText={jest.fn()} onFound={onFound} />);
    act(() => tree.root.findByProps({ testID: "client-tax-number-lookup" }).props.onPress());
    await flush();
    expect(mockLookup.lookup).toHaveBeenCalledWith("12345678-1-42");
    expect(onFound).toHaveBeenCalledWith({ name: "Minta Kft.", city: "Budapest" });
  });

  it("says when NAV knows no such taxpayer, and clears it when the number changes", async () => {
    mockLookup.lookup.mockResolvedValue(null);
    const onChangeText = jest.fn();
    const tree = render(<TaxNumberLookupField value="12345678-1-42" onChangeText={onChangeText} onFound={jest.fn()} />);
    act(() => tree.root.findByProps({ testID: "client-tax-number-lookup" }).props.onPress());
    await flush();
    expect(JSON.stringify(tree.toJSON())).toContain("partners.lookupNotFound");
    act(() => tree.root.findByProps({ testID: "client-tax-number" }).props.onChangeText("12345678-1-43"));
    expect(onChangeText).toHaveBeenCalledWith("12345678-1-43");
    expect(JSON.stringify(tree.toJSON())).not.toContain("partners.lookupNotFound");
  });

  it("shows the lookup failure through the shared key, not the not-found one", async () => {
    mockLookup.error = "NAV unavailable";
    mockLookup.lookup.mockResolvedValue(null);
    const tree = render(<TaxNumberLookupField value="12345678-1-42" onChangeText={jest.fn()} onFound={jest.fn()} />);
    act(() => tree.root.findByProps({ testID: "client-tax-number-lookup" }).props.onPress());
    await flush();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("settings.companySettings.lookupFailed");
    expect(json).not.toContain("partners.lookupNotFound");
  });

  it("keeps the button disabled with nothing to look up", () => {
    const tree = render(<TaxNumberLookupField value="   " onChangeText={jest.fn()} onFound={jest.fn()} />);
    expect(tree.root.findByProps({ testID: "client-tax-number-lookup" }).props.disabled).toBe(true);
  });
});
