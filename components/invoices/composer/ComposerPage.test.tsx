// components/invoices/composer/ComposerPage.test.tsx
// The preview is closed on load and only rendered (so only fetched) once
// "Előnézet" is pressed: a 420px side column from 1100px, a Sheet below.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { ComposerPage } from "@/components/invoices/composer/ComposerPage";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseWindowDimensions = useWindowDimensions as jest.Mock;

function render(renderPreview = jest.fn(() => null)) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ComposerPage breadcrumb={[{ label: "A" }]} title="Új bizonylat kiállítása" bottomBar={null} renderPreview={renderPreview}>
        {null}
      </ComposerPage>,
    );
  });
  return { tree, renderPreview };
}

const press = (tree: TestRenderer.ReactTestRenderer) =>
  act(() => {
    tree.root.findAll((n) => n.props?.testID === "composer-open-preview" && n.props.onPress)[0].props.onPress();
  });

describe("ComposerPage — preview", () => {
  it.each([
    [1440, 900, "composer-side-preview"],
  ])("is closed on load and opens as a side column at %ipx", (width, height, id) => {
    mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
    const { tree, renderPreview } = render();
    expect(renderPreview).not.toHaveBeenCalled();
    expect(tree.root.findAll((n) => n.props?.testID === id)).toHaveLength(0);

    press(tree);
    expect(renderPreview).toHaveBeenCalled();
    expect(tree.root.findAll((n) => n.props?.testID === id).length).toBeGreaterThan(0);
  });

  it("does not render the side column below 1100px (the sheet handles it)", () => {
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 800, scale: 1, fontScale: 1 });
    const { tree, renderPreview } = render();
    expect(renderPreview).not.toHaveBeenCalled();
    press(tree);
    expect(tree.root.findAll((n) => n.props?.testID === "composer-side-preview")).toHaveLength(0);
  });
});
