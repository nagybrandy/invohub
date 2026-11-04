// components/ui/sheet/sheet.test.tsx
// Native Sheet: presentation by width, labelled content, and the three ways
// to close (scrim, close button, Android back via onRequestClose).
import TestRenderer, { act } from "react-test-renderer";
import { Modal } from "react-native";

const mockDims = { width: 375 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));

import { Sheet, resolvePresentation } from "@/components/ui/sheet";

function render(props: Partial<React.ComponentProps<typeof Sheet>> = {}) {
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Sheet open onClose={onClose} title="Szűrés és rendezés" {...props}>
        <></>
      </Sheet>,
    );
  });
  return { tree, onClose };
}

describe("resolvePresentation", () => {
  it("is a sheet up to 700 and a dialog above", () => {
    expect(resolvePresentation("auto", 375)).toBe("sheet");
    expect(resolvePresentation("auto", 700)).toBe("sheet");
    expect(resolvePresentation("auto", 701)).toBe("dialog");
    expect(resolvePresentation(undefined, 1440)).toBe("dialog");
  });

  it("an explicit presentation wins", () => {
    expect(resolvePresentation("sheet", 1440)).toBe("sheet");
    expect(resolvePresentation("dialog", 375)).toBe("dialog");
  });
});

describe("Sheet (native)", () => {
  beforeEach(() => {
    mockDims.width = 375;
  });

  it("is hidden while closed", () => {
    const { tree } = render({ open: false });
    expect(tree.root.findByType(Modal).props.visible).toBe(false);
  });

  it("slides up as a bottom sheet with a grab handle on phones", () => {
    const { tree } = render();
    const modal = tree.root.findByType(Modal);
    expect(modal.props.animationType).toBe("slide");
    expect(JSON.stringify(tree.toJSON())).toContain("Szűrés és rendezés");
    const root = tree.root.findByProps({ testID: "sheet" });
    expect(root.props.accessibilityViewIsModal).toBe(true);
    expect(root.props.accessibilityLabel).toBe("Szűrés és rendezés");
    expect(root.props.className).not.toContain("items-center");
  });

  it("is a centred dialog on wider screens", () => {
    mockDims.width = 820;
    const { tree } = render();
    expect(tree.root.findByType(Modal).props.animationType).toBe("fade");
    expect(tree.root.findByProps({ testID: "sheet" }).props.className).toContain("items-center");
  });

  it("closes from the scrim, the close button and the hardware back button", () => {
    const { tree, onClose } = render();
    act(() => tree.root.findByProps({ testID: "sheet-scrim" }).props.onPress());
    act(() => tree.root.findByProps({ testID: "sheet-close" }).props.onPress());
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("labels the close controls with the translated close label", () => {
    const { tree } = render();
    expect(tree.root.findByProps({ testID: "sheet-close" }).props.accessibilityLabel).toBe("ui.close");
    const custom = render({ closeLabel: "Bezár" });
    expect(custom.tree.root.findByProps({ testID: "sheet-close" }).props.accessibilityLabel).toBe("Bezár");
  });

  it("can hide the header and render a footer", () => {
    const { tree } = render({ hideHeader: true, footer: <></> });
    expect(() => tree.root.findByProps({ testID: "sheet-close" })).toThrow();
  });
});
