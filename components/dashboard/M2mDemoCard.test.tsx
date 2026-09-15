// components/dashboard/M2mDemoCard.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { M2mDemoCard } from "@/components/dashboard/M2mDemoCard";
import { useM2mDemo } from "@/hooks/useM2mDemo";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/hooks/useM2mDemo");
jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return { Button: mockUi.Pressable, ButtonText: mockUi.Text };
});

const mockUseM2mDemo = useM2mDemo as jest.MockedFunction<typeof useM2mDemo>;

function baseHook(overrides: Partial<ReturnType<typeof useM2mDemo>> = {}) {
  return {
    snapshot: {
      taxpayer: { id: "12345678", label: "Teszt Kft." },
      environment: "demo",
      checks: [{ name: "getTaxpayer", ok: true, resultCode: null }],
      taxSummary: null,
      missingDeclarations: [],
      publicDebt: null,
      detailedTaxpayer: null,
      allEndpointsReachable: true,
    },
    mode: "demo" as const,
    loading: false,
    error: null,
    load: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function render() {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<M2mDemoCard />);
  });
  return tree!;
}

describe("M2mDemoCard", () => {
  beforeEach(() => {
    mockUseM2mDemo.mockReturnValue(baseHook());
  });

  it("is collapsed by default", () => {
    const tree = render();
    expect(() => tree.root.findByProps({ testID: "m2m-demo-content" })).toThrow();
  });

  it("expands to show the snapshot when toggled", () => {
    const tree = render();
    const toggle = tree.root.findByProps({ testID: "m2m-demo-toggle" });
    act(() => {
      toggle.props.onPress?.();
    });
    expect(tree.root.findByProps({ testID: "m2m-demo-content" })).toBeTruthy();
  });

  it("is labeled as developer diagnostics (demo)", () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("dashboard.devDiagnostics");
  });

  it("never renders any green classnames (A2, V5 — green is for `paid` only)", () => {
    const tree = render();
    const toggle = tree.root.findByProps({ testID: "m2m-demo-toggle" });
    act(() => {
      toggle.props.onPress?.();
    });
    const greenNodes = tree.root.findAll(
      (node) => typeof node.props?.className === "string" && node.props.className.includes("green")
    );
    expect(greenNodes).toHaveLength(0);
  });
});
