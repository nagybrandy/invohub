// components/invoices/composer/ComposerSideLayout.test.tsx
import * as React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { ComposerSideLayout } from "@/components/invoices/composer/ComposerSideLayout";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => ({
  Button: require("@/__tests__/mocks/gluestack-ui").Pressable,
  ButtonText: require("@/__tests__/mocks/gluestack-ui").Text,
}));
const mockPreview = jest.fn();
jest.mock("@/components/invoices/InvoicePdfPreview", () => ({
  InvoicePdfPreview: (props: { headerAction?: React.ReactNode }) => {
    mockPreview(props);
    const { View } = require("react-native");
    return <View testID="pdf-preview">{props.headerAction}</View>;
  },
}));

const t = (key: string) => key;

describe("ComposerSideLayout", () => {
  beforeEach(() => mockPreview.mockClear());

  it("puts the form on the left and the live draft PDF in a sticky right column", () => {
    const invoice = makeInvoice({ invoiceNumber: "" });
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ComposerSideLayout invoice={invoice} previewWidth={460} previewHeight={750} onHidePreview={() => {}} t={t}>
          <Text testID="form">form</Text>
        </ComposerSideLayout>
      );
    });

    const byId = (id: string) => tree!.root.findAll((n) => n.props.testID === id)[0]!;
    expect(byId("composer-side-layout").props.className).toContain("flex-row");
    expect(byId("composer-form-column").findAllByProps({ testID: "form" }).length).toBeGreaterThan(0);
    const previewColumn = byId("composer-side-preview");
    expect(previewColumn.props.className).toContain("sticky");
    expect(previewColumn.props.style).toEqual({ width: 460 });
    // Form first (left), preview second (right).
    const json = JSON.stringify(tree!.toJSON());
    expect(json.indexOf("composer-form-column")).toBeLessThan(json.indexOf("composer-side-preview"));

    expect(mockPreview).toHaveBeenCalledWith(
      expect.objectContaining({ source: { kind: "draft", invoice }, height: 750 })
    );
  });

  it("offers a hide control that hands the full width back", () => {
    const onHide = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ComposerSideLayout invoice={makeInvoice()} previewWidth={380} previewHeight={600} onHidePreview={onHide} t={t}>
          <Text>form</Text>
        </ComposerSideLayout>
      );
    });
    const hide = tree!.root.findAll((n) => n.props.testID === "composer-hide-preview" && !!n.props.onPress)[0]!;
    act(() => hide.props.onPress());
    expect(onHide).toHaveBeenCalled();
  });
});
