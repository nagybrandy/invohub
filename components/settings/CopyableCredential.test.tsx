// components/settings/CopyableCredential.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { CopyableCredential } from "@/components/settings/CopyableCredential";

jest.mock("@/lib/clipboard", () => ({
  copyText: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666" }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return { Copy: View, Check: View };
});

jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return {
    Button: mockUi.Pressable,
    ButtonText: mockUi.Text,
  };
});

const { copyText } = jest.requireMock("@/lib/clipboard") as {
  copyText: jest.Mock;
};

describe("CopyableCredential", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    copyText.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders label and credential value", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CopyableCredential label="Secret key" value="sk_live_abc" hint="Save this now" />
      );
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Secret key");
    expect(json).toContain("sk_live_abc");
    expect(json).toContain("Save this now");
  });

  it("copies value when Copy is pressed", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <CopyableCredential label="Public key" value="pk_test_123" />
      );
    });

    const copyButton = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) =>
        node.findAll((child) => child.props?.children === "Copy").length > 0
      );

    await act(async () => {
      await copyButton?.props.onPress?.();
    });

    expect(copyText).toHaveBeenCalledWith("pk_test_123");
  });
});
