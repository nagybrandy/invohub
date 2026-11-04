// __tests__/screens/settings/nav.test.tsx
// /settings/nav: the NAV connection moved here from the company page with the
// same API calls; the data-export card sits in its own section.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockApiFetch = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useCompany", () => ({
  useCompany: () => ({ company: { id: "c1", name: "Demo Kft.", navEnvironment: "test" }, loading: false, save: jest.fn() }),
}));
jest.mock("@/lib/api/client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    code?: string;
  },
}));
jest.mock("@/components/settings/TaxAuditExportCard", () => ({
  TaxAuditExportCard: () => {
    const { View } = require("react-native");
    return <View testID="tax-audit-export-card" />;
  },
}));
jest.mock("@/components/settings/NavEnvironmentPicker", () => ({
  NavEnvironmentPicker: () => null,
}));
jest.mock("@/components/settings/SettingsSheet", () => {
  const { View } = require("react-native");
  const Pass = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <View testID={testID}>{children}</View>
  );
  return { SettingsNote: Pass, SettingsPage: Pass, SettingsSection: Pass, SettingsSheet: Pass };
});
jest.mock("@/components/settings/SaveBar", () => ({ SaveBar: () => null }));
for (const m of ["box", "text", "pressable", "vstack", "hstack"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}
jest.mock("@/components/ui/button", () => {
  const ui = require("@/__tests__/mocks/gluestack-ui");
  return { Button: ui.Pressable, ButtonText: ui.Text };
});
jest.mock("@/components/layout/FormField", () => ({
  FormField: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return { Input: View, InputField: (props: Record<string, unknown>) => <TextInput {...props} /> };
});

import NavSettingsScreen from "@/app/(app)/settings/nav";

describe("NavSettingsScreen", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue({ ok: true });
  });

  it("loads the NAV config and renders the export section", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<NavSettingsScreen />);
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/nav/config");
    expect(tree.root.findAll((n) => n.props?.testID === "tax-audit-export-card").length).toBeGreaterThan(0);
    expect(tree.root.findAll((n) => n.props?.testID === "nav-connection").length).toBeGreaterThan(0);
  });

  it("checks the connection through /api/nav/check with the form values", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(<NavSettingsScreen />);
    });
    const btn = tree.root.findAll((n) => n.props?.testID === "nav-check-connection" && typeof n.props.onPress === "function")[0];
    await act(async () => {
      btn.props.onPress();
    });
    const call = mockApiFetch.mock.calls.find((c) => c[0] === "/api/nav/check");
    expect(call).toBeTruthy();
    expect(JSON.parse(call![1].body)).toMatchObject({ navEnvironment: "test" });
  });
});
